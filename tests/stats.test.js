const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { applicationMetrics, garageMetrics, decisionBucket, normalizeDate } = require('../modules/commandModules/stats/statsMetrics.js');
const verificationSchema = require('../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../mongodb_schema/garageSchema.js');
const { buildStatsEmbeds } = require('../modules/commandModules/stats/statsService.js');

afterEach(() => mock.restoreAll());
const now = new Date('2026-10-10T12:00:00Z');
const submitted = '2026-10-01T00:00:00Z';
const decided = '2026-10-02T00:00:00Z';
const application = (decision, status = 'closed', extra = {}) => ({
    vehicle: 'Honda Civic', decision, status, submittedOn: submitted, decidedOn: decided, decidedBy: 'staff', ...extra,
});

test('final decisions agree across totals, yearly series and brand rates', () => {
    const rows = [
        application('approved'), application('overridden-approved'), application('approved', 'auto-approved', { decidedBy: 'ai-auto' }),
        application('denied | Missing keys'), application('denied-read-guide'), application('denied | User Left'), application('banned'),
        application('overridden-denied'), application(null, 'auto-denied'),
        application(null, 'open'), application(null), application('approved', 'open'), application('unrecognized'),
    ];
    const metrics = applicationMetrics(rows, now);
    assert.deepEqual(metrics.totals, { approved: 3, denied: 6, excluded: 4 });
    assert.deepEqual(metrics.timeSeries.approved, [3]);
    assert.deepEqual(metrics.timeSeries.denied, [6]);
    assert.deepEqual(metrics.brandApproval, { labels: ['Honda (9)'], rates: [33] });
    assert.deepEqual(metrics.ai, { autoApproved: 1, autoDenied: 1, overrideToDenied: 1, overrideToApproved: 1 });
    assert.equal(decisionBucket('overridden-denied', 'auto-approved'), 'denied');
    assert.equal(decisionBucket('overridden-approved', 'auto-denied'), 'approved');
    assert.equal(decisionBucket(null, 'closed'), null);
});

test('dates support legacy millisecond values and reject malformed data', () => {
    for (const value of [new Date(submitted), submitted, Date.parse(submitted), String(Date.parse(submitted))]) {
        assert.equal(normalizeDate(value).toISOString(), submitted.replace('Z', '.000Z'));
    }
    for (const value of [null, undefined, '', true, {}, 'invalid', Infinity]) assert.equal(normalizeDate(value), null);
    const metrics = applicationMetrics([
        application('approved', 'closed', { submittedOn: 'bad', createdAt: submitted }),
        application('denied', 'closed', { submittedOn: 'bad' }),
        application('denied', 'closed', { submittedOn: '2027-01-01T00:00:00Z' }),
    ], now);
    assert.deepEqual(metrics.totals, { approved: 1, denied: 2, excluded: 0 });
    assert.deepEqual(metrics.timeSeries.approved, [1]);
    assert.deepEqual(metrics.timeSeries.denied, [0]);
    assert.equal(metrics.timeSeries.missingSubmissionDates, 2);
});

test('turnaround separates instant AI decisions, includes overrides and leaves empty months as gaps', () => {
    const metrics = applicationMetrics([
        application('approved'), application('overridden-denied', 'closed', { decidedOn: '2026-10-03T00:00:00Z' }),
        application('approved', 'auto-approved', { decidedBy: 'ai-auto', decidedOn: submitted }),
        application('denied', 'closed', { submittedOn: Date.parse(submitted), decidedOn: String(Date.parse(decided)) }),
        application('denied', 'closed', { decidedOn: 'bad' }),
        application('denied', 'closed', { decidedOn: '2026-09-30T00:00:00Z' }),
        application('denied', 'closed', { decidedOn: '2026-10-11T00:00:00Z' }),
        application('denied | User Left'),
        application('approved', 'closed', { submittedOn: '2026-05-01', decidedOn: '2026-05-02' }),
    ], now);
    assert.deepEqual(metrics.turnaround.labels, ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    assert.deepEqual(metrics.turnaround.staffHours, [null, null, null, null, 32]);
    assert.deepEqual(metrics.turnaround.aiHours, [null, null, null, null, 0]);
    assert.equal(metrics.turnaround.staffCount, 3);
    assert.equal(metrics.turnaround.aiCount, 1);
    assert.equal(metrics.turnaround.excluded, 4);
    assert.deepEqual(applicationMetrics([], new Date('2026-03-31T23:00:00Z')).turnaround.labels,
        ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
});

test('garage rankings work with empty specs, combine year variants and retain rare brands', () => {
    const rows = [
        { vehicle: 'Honda Civic Fn2 Type R 2007', vehicleBrand: 'honda', vehicleModel: 'Civic Fn2 Type R 2007', userId: 'a' },
        { vehicle: '2008 Honda Civic Fn2 Type R', vehicleBrand: 'Honda', vehicleModel: 'Civic Fn2 Type R', userId: 'b' },
        { vehicle: '1992 Ford Mustang GT', vehicleBrand: 'ford', vehicleModel: 'Mustang GT', userId: 'a' },
        { vehicle: 'Ford Mustang GT 1993', userId: 'c' },
        { vehicle: 'BMW 2002', userId: 'a' }, { vehicle: 'Volvo 240', userId: 'b' },
        { vehicle: 'Chevy Camaro', userId: 'a' }, { vehicle: 'Chevrolet Camaro', userId: 'b' },
        { vehicle: 'car', userId: 'c' },
    ];
    const metrics = garageMetrics(rows);
    assert.deepEqual(metrics.topVehicles.counts.slice(0, 3), [2, 2, 2]);
    assert.deepEqual(metrics.topVehicles.labels.slice(0, 3), ['Chevrolet Camaro', 'Ford Mustang Gt', 'Honda Civic Fn2 Type R']);
    assert.ok(metrics.topVehicles.labels.includes('Bmw 2002'));
    assert.deepEqual(metrics.leastBrands.labels.slice(0, 2), ['Bmw', 'Volvo']);
    assert.deepEqual(metrics.leastBrands.counts.slice(0, 2), [1, 1]);
    assert.equal(metrics.unknownBrands, 1);
    assert.deepEqual(metrics.topUsers[0], { label: 'a', count: 4 });
});

function queryFixture(rows) {
    return { select() { return this; }, async lean() { return rows; } };
}

test('stats embeds enforce server scope and charts use consistent outcome counts', async () => {
    const findApps = mock.method(verificationSchema, 'find', () => queryFixture([
        application('approved'), application('denied-read-guide'), application(null, 'open'),
    ]));
    const findGarage = mock.method(garageSchema, 'find', () => queryFixture([]));
    const charts = new Map();
    mock.method(globalThis, 'fetch', async (_url, options) => {
        const url = `https://example.com/chart/${charts.size}`;
        charts.set(url, JSON.parse(options.body).chart);
        return { json: async () => ({ url }) };
    });
    const entries = await buildStatsEmbeds({ scope: 'server', guildId: 'test-guild', guildName: 'Test' });
    const chart = key => {
        const url = entries.find(entry => entry.key === key).embed.image.url;
        return charts.get(url) || JSON.parse(new URL(url).searchParams.get('c'));
    };
    assert.deepEqual(findApps.mock.calls[0].arguments, [{ guildId: 'test-guild' }]);
    assert.deepEqual(findGarage.mock.calls[0].arguments, [{ guildId: 'test-guild' }]);
    assert.equal(findApps.mock.callCount(), 1);
    assert.equal(findGarage.mock.callCount(), 1);
    assert.deepEqual(chart('approval_rate').data.datasets[0].data, [1, 1]);
    assert.deepEqual(chart('over_time').data.datasets.map(dataset => dataset.data), [[1], [1]]);
    assert.match(entries.find(e => e.key === 'approval_rate').embed.description, /excluded \(1\)/);
    assert.equal(chart('turnaround').data.datasets.length, 1);
    assert.match(entries.find(e => e.key === 'turnaround').embed.description, /AI decisions excluded/);
    await assert.rejects(buildStatsEmbeds({ scope: 'server' }), /must be requested in a server/);
    await buildStatsEmbeds({ scope: 'global' });
    assert.deepEqual(findApps.mock.calls[1].arguments, [{}]);
});

test('chart service failure does not return truncated invalid chart JSON', async () => {
    mock.method(verificationSchema, 'find', () => queryFixture([]));
    mock.method(garageSchema, 'find', () => queryFixture(Array.from({ length: 10 }, (_, i) => ({
        vehicle: `Honda ${'Long model name '.repeat(4)}${i}`, userId: `user-${i}`,
    }))));
    mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
    mock.method(console, 'error', () => {});
    const entries = await buildStatsEmbeds({ scope: 'global' });
    const unavailable = entries.filter(entry => !entry.embed.image);
    assert.ok(unavailable.length > 0);
    for (const entry of unavailable) {
        assert.match(entry.embed.description, /Chart unavailable/);
        assert.match(entry.embed.description, /Count |Vehicles /);
        assert.ok(entry.embed.description.length <= 4096);
    }
    for (const entry of entries.filter(entry => entry.embed.image)) {
        assert.doesNotThrow(() => JSON.parse(new URL(entry.embed.image.url).searchParams.get('c')));
    }
});


test('legacy decisions classify the outcome without interpreting the free-text reason', () => {
    assert.equal(decisionBucket('denied | Please follow the procedures\nApply again', 'closed'), 'denied');
    assert.equal(decisionBucket(' DENIED | User Left ', 'closed'), 'denied');
    assert.equal(decisionBucket('approved | staff note', 'closed'), 'approved');
    assert.equal(decisionBucket('denied | approved elsewhere', 'open'), null);
    assert.equal(decisionBucket('unknown | denied', 'closed'), null);
});

test('brand charts exclude models and test text, normalize accented names and favor reviewed sample sizes', () => {
    const { canonicalBrand } = require('../modules/commandModules/stats/statsBrands');
    assert.equal(canonicalBrand('Citroën'), 'citroen');
    assert.equal(canonicalBrand('Toyota'), 'toyota');
    assert.equal(canonicalBrand('Nissan'), 'nissan');
    assert.equal(canonicalBrand('Škoda'), 'skoda');
    assert.equal(canonicalBrand('WRX'), null);
    const vehicles = [
        { vehicle: 'WRX STI', vehicleBrand: 'wrx' },
        { vehicle: 'testing car', vehicleBrand: 'testing' },
        { vehicle: 'Honda Civic', vehicleBrand: 'civic', vehicleModel: 'incorrect' },
        { vehicle: 'Citroën C4', vehicleBrand: 'citro n' },
        { vehicle: 'Škoda Octavia', vehicleBrand: 'koda' },
        { vehicle: 'Mystery Build', vehicleBrand: 'not in registry' },
    ];
    const garage = garageMetrics(vehicles);
    assert.deepEqual(garage.topBrands.labels, ['Citroen', 'Honda', 'Skoda']);
    assert.equal(garage.unknownBrands, 3);
    assert.ok(garage.topVehicles.labels.includes('Honda Civic'));
    const rows = [
        ...Array.from({ length: 10 }, (_, index) => application(index < 5 ? 'approved' : 'denied')),
        ...Array.from({ length: 3 }, () => application('approved', 'closed', { vehicle: 'Tesla Model 3' })),
        application('approved', 'closed', { vehicle: 'C4 Corvette', vehicleBrand: 'c4' }),
    ];
    const metrics = applicationMetrics(rows, now);
    assert.deepEqual(metrics.brandApproval.labels, ['Honda (10)', 'Tesla (3)']);
    assert.deepEqual(metrics.brandApproval.rates, [50, 100]);
    assert.equal(metrics.unknownDecisionBrands, 1);
});
