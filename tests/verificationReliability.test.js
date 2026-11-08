const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Verification = require('../mongodb_schema/verificationApplicationSchema');
const Garage = require('../mongodb_schema/garageSchema');
const User = require('../mongodb_schema/userProfileSchema');
const { canAutoApprove, validAnalysis } = require('../modules/verification/aiPolicy');
const { vehicleKey, vehicleFilter } = require('../modules/verification/vehicleIdentity');
const { MAX_PENDING_MS, isExpired, expiredFilter, closeExpiredApplications } = require('../modules/verification/expiry');
const { commitDecision, createAutoApproval } = require('../modules/verification/decisions');
const { estimateReviewEta } = require('../modules/verification/reviewEta');
const { applicationMetrics } = require('../modules/commandModules/stats/statsMetrics');
const { duplicateGroups, mergeGarageDocuments, migrateGarages } = require('../modules/verification/garageMaintenance');
const { databaseName } = require('../modules/verification/connection');

afterEach(() => mock.restoreAll());
const now = new Date('2026-10-10T12:00:00Z');
const valid = { requirementsMet: true, vehicleMatch: true, confidence: 95, estimatedValueUSD: 20000 };

test('AI approval requires a true vehicle match and correctly typed confidence, requirements and value', () => {
    assert.equal(canAutoApprove(valid), true);
    for (const changes of [
        { vehicleMatch: false }, { vehicleMatch: 'true' }, { requirementsMet: 'false' },
        { confidence: '95' }, { confidence: NaN }, { confidence: 101 }, { confidence: 89 },
        { estimatedValueUSD: '20000' }, { estimatedValueUSD: 0 }, { estimatedValueUSD: 50000 },
        { estimatedValueUSD: Infinity },
    ]) assert.equal(canAutoApprove({ ...valid, ...changes }), false);
    assert.equal(validAnalysis({ ...valid, requirementsMet: false }), true);
    assert.ok(!validAnalysis(null));
});

test('expiry is strictly older than 30 days and tolerates legacy submission formats', async () => {
    const boundary = new Date(now - MAX_PENDING_MS);
    assert.equal(isExpired({ status: 'open', submittedOn: boundary }, now), false);
    assert.equal(isExpired({ status: 'open', submittedOn: String(+boundary - 1) }, now), true);
    assert.equal(isExpired({ status: 'open', submittedOn: 'bad', createdAt: new Date(+boundary - 1) }, now), true);
    assert.ok(!isExpired({ status: 'open', submittedOn: 'bad' }, now));
    assert.equal(isExpired({ status: 'closed', submittedOn: new Date(0) }, now), false);
    const update = mock.method(Verification, 'updateMany', async () => ({ modifiedCount: 3 }));
    assert.equal((await closeExpiredApplications(now)).modifiedCount, 3);
    const [filter, changes] = update.mock.calls[0].arguments;
    assert.deepEqual(filter, expiredFilter(now));
    assert.equal(filter.status, 'open');
    assert.equal(changes.$set.decision, 'expired');
    assert.equal(changes.$set.decidedBy, 'system-expiry');
    assert.deepEqual(applicationMetrics([{ status: 'closed', decision: 'expired' }], now).totals,
        { approved: 0, denied: 0, excluded: 1 });
});

test('ETA includes legacy denials and staff overrides, excludes AI, expiry, departures and invalid dates', () => {
    const review = (decision = 'denied | Missing keys', extra = {}) => ({
        status: 'closed', decision, decidedBy: 'staff',
        submittedOn: '2026-10-01T00:00:00Z', decidedOn: '2026-10-01T02:00:00Z', ...extra,
    });
    const rows = [
        ...Array.from({ length: 19 }, () => review()),
        review('overridden-approved'),
        ...Array.from({ length: 100 }, () => review('approved', { status: 'auto-approved', decidedBy: 'ai-auto', decidedOn: '2026-10-01T00:00:00Z' })),
        review('expired'), review('denied | User Left'), review('approved', { decidedOn: 'bad' }),
        review('approved', { decidedOn: '2026-09-01' }), review('approved', { decidedOn: '2027-01-01' }),
        review('approved', { status: 'open' }),
    ];
    assert.equal(estimateReviewEta(rows, now), '2 hours');
    assert.equal(estimateReviewEta(rows.slice(0, 19), now), '24 - 48 Hours');
    const older = Array.from({ length: 30 }, () => review('approved', { submittedOn: '2025-01-01', decidedOn: '2025-01-02' }));
    const recent = Array.from({ length: 50 }, () => review());
    assert.equal(estimateReviewEta([...older, ...recent], now), '2 hours');
});

test('garage keys and schemas retain reasons and enforce normalized name uniqueness', async () => {
    const doc = new Garage({ guildId: 'guild', userId: 'user', vehicle: '  HONDA   Civic ' });
    await doc.validate();
    assert.equal(doc.vehicleKey, 'honda civic');
    assert.equal(vehicleKey('Honda\tCivic'), 'honda civic');
    const filter = vehicleFilter({ guildId: 'guild', userId: 'user', vehicle: 'BMW 3.0 (E36)' });
    assert.ok(filter.$or[1].vehicle.test('  bmw  3.0 (e36) '));
    assert.ok(!filter.$or[1].vehicle.test('BMW 3X0 E36'));
    assert.ok(Garage.schema.indexes().some(([fields, options]) => fields.vehicleKey === 1 && options.unique));
    const application = new Verification({ guildId: 'guild', userId: 'user', vehicle: 'Honda Civic',
        denialReason: 'Missing keys', appealReason: 'Keys visible', overrideReason: 'Reviewed by staff', closureReason: 'Expired' });
    const saved = application.toObject();
    assert.equal(saved.denialReason, 'Missing keys');
    assert.equal(saved.appealReason, 'Keys visible');
    assert.equal(saved.overrideReason, 'Reviewed by staff');
    assert.equal(saved.closureReason, 'Expired');
});

function decisionFixture() {
    const app = { _id: 'app', guildId: 'guild', userId: 'user', vehicle: 'Honda Civic',
        status: 'open', submittedOn: new Date(), vehicleImageURL: 'https://example.com/proof.jpg' };
    const state = { application: { ...app }, garage: null, user: null };
    let transactionQueue = Promise.resolve();
    const session = {
        withTransaction: callback => {
            const transaction = transactionQueue.then(async () => {
                const before = structuredClone(state);
                try { await callback(); } catch (error) { Object.assign(state, before); throw error; }
            });
            transactionQueue = transaction.catch(() => {});
            return transaction;
        }, endSession: mock.fn(async () => {}),
    };
    mock.method(mongoose, 'startSession', async () => session);
    const update = mock.method(Verification, 'findOneAndUpdate', async (filter, changes, options) => {
        assert.equal(options.session, session);
        assert.equal(filter.guildId, app.guildId);
        if (state.application.status !== filter.status) return null;
        Object.assign(state.application, changes.$set);
        return state.application;
    });
    mock.method(Garage, 'findOne', () => ({ session: async passed => {
        assert.equal(passed, session); return state.garage;
    } }));
    const create = mock.method(Garage, 'create', async (docs, options) => {
        assert.equal(options.session, session); state.garage = docs[0]; return docs;
    });
    const profile = mock.method(User, 'updateOne', async (_filter, changes, options) => {
        assert.equal(options.session, session); state.user = changes;
    });
    const remove = mock.method(Garage, 'deleteMany', async (_filter, options) => {
        assert.equal(options.session, session); state.garage = null;
    });
    return { app, state, session, update, create, profile, remove };
}

test('a competing decision cannot overwrite an approval or apply denial side effects', async () => {
    const fixture = decisionFixture();
    const results = await Promise.allSettled([
        commitDecision(fixture.app, { status: 'closed', decision: 'approved' }, 'approve'),
        commitDecision(fixture.app, { status: 'closed', decision: 'denied' }, 'remove'),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(fixture.state.application.decision, 'approved');
    assert.equal(fixture.create.mock.callCount(), 1);
    assert.equal(fixture.remove.mock.callCount(), 0);
    assert.equal(fixture.state.garage.vehicleKey, 'honda civic');
    assert.ok(fixture.update.mock.calls[0].arguments[0].$nor);
});

test('failure in an approval side effect rolls back the decision and garage together', async () => {
    const fixture = decisionFixture();
    fixture.profile.mock.mockImplementation(async () => { throw new Error('database write failed'); });
    await assert.rejects(commitDecision(fixture.app, { status: 'closed', decision: 'approved' }, 'approve'), /write failed/);
    assert.equal(fixture.state.application.status, 'open');
    assert.equal(fixture.state.garage, null);
    assert.equal(fixture.session.endSession.mock.callCount(), 1);
});

test('expired applications are rejected before any decision transaction begins', async () => {
    const fixture = decisionFixture();
    const sessionCalls = mongoose.startSession.mock.callCount();
    await assert.rejects(commitDecision({ ...fixture.app, submittedOn: new Date(0) }, { status: 'closed', decision: 'approved' }, 'approve'), /expired/);
    assert.equal(mongoose.startSession.mock.callCount(), sessionCalls);
    assert.equal(fixture.create.mock.callCount(), 0);
});

test('AI approval record and garage share a transaction and roll back on profile failure', async () => {
    const fixture = decisionFixture();
    mock.method(Verification, 'create', async (docs, options) => {
        assert.equal(options.session, fixture.session); fixture.state.application = docs[0];
    });
    fixture.profile.mock.mockImplementation(async () => { throw new Error('profile failure'); });
    await assert.rejects(createAutoApproval({ ...fixture.app, status: 'auto-approved', decision: 'approved' }), /profile failure/);
    assert.equal(fixture.state.application.status, 'open');
    assert.equal(fixture.state.garage, null);
});

test('duplicate merge retains all images, collections and populated specs without merging owners', () => {
    const docs = [
        { _id: '01', guildId: 'g', userId: 'u', vehicle: 'Honda Civic', vehicleImages: ['a'], collections: ['daily'], vehicleSpecs: { engine: '2.0L', torque: null }, updatedAt: new Date('2026-01-01') },
        { _id: '02', guildId: 'g', userId: 'u', vehicle: ' HONDA  Civic ', vehicleImages: ['a', 'b'], collections: ['project'], vehicleSpecs: { engine: null, torque: '193' }, vehicleDescription: 'Project car', updatedAt: new Date('2026-02-01') },
        { _id: '03', guildId: 'g', userId: 'different', vehicle: 'Honda Civic' },
    ];
    assert.equal(duplicateGroups(docs).length, 1);
    const { keeper, merged, removed } = mergeGarageDocuments(docs.slice(0, 2));
    assert.equal(keeper._id, '01');
    assert.deepEqual(merged.vehicleImages, ['a', 'b']);
    assert.deepEqual(merged.collections, ['daily', 'project']);
    assert.deepEqual(merged.vehicleSpecs, { engine: '2.0L', torque: '193' });
    assert.equal(merged.vehicleDescription, 'Project car');
    assert.equal(removed[0]._id, '02');
    assert.equal(docs[0].vehicleSpecs.torque, null);
});

test('migration dry-run performs no writes; archive failure prevents removal', async () => {
    const docs = [{ _id: '01', guildId: 'g', userId: 'u', vehicle: 'Honda Civic' },
        { _id: '02', guildId: 'g', userId: 'u', vehicle: 'HONDA CIVIC' }];
    let writes = 0;
    const collection = {
        find: () => ({ toArray: async () => docs }),
        createIndex: async () => { writes++; },
        deleteMany: async () => { writes++; }, replaceOne: async () => { writes++; }, bulkWrite: async () => { writes++; },
    };
    const db = { collection: name => name === 'verified vehicles' ? collection : { insertMany: async () => { throw new Error('archive unavailable'); } } };
    const session = { withTransaction: async callback => callback(), endSession: async () => {} };
    const client = { startSession: () => session };
    const dryRun = await migrateGarages(db, client);
    assert.equal(dryRun.duplicateGroups, 1);
    assert.equal(writes, 0);
    await assert.rejects(migrateGarages(db, client, { apply: true }), /archive unavailable/);
    assert.equal(writes, 1); // Only index creation; no garage record deletion or replacement.
});

test('connection selects the configured database rather than an empty test database', () => {
    assert.equal(databaseName('mongodb+srv://example.com/', ''), 'throttlebot-verification');
    assert.equal(databaseName('mongodb+srv://example.com/existing', ''), 'existing');
    assert.equal(databaseName('mongodb+srv://example.com/existing', 'override'), 'override');
});
