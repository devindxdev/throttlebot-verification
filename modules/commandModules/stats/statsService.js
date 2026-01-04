const verificationSchema = require('../../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');
const { resolveBrandFields } = require('../../vehicleUtils.js');

const QUICKCHART_BASE = 'https://quickchart.io/chart?c=';
const COLORS = {
    primary: '#FF6961', // core bot red
    secondary: '#FF9C92', // lighter red
    soft: '#FFE8E6', // very light red
    accent: '#FFFCFF', // off-white
    text: '#333333',
    blue: '#4A90E2', // distinct for overrides
    dark: '#2C3E50', // dark for contrast
    white: '#FFFFFF',
    black: '#000000',
};

const VEHICLE_BRAND_PREFIXES = new Set([
    'acura', 'alfa', 'alfa romeo', 'aston', 'aston martin', 'audi', 'bentley', 'bmw', 'buick', 'cadillac',
    'chevrolet', 'chevy', 'chrysler', 'dodge', 'ferrari', 'fiat', 'ford', 'gmc', 'genesis', 'honda', 'hummer',
    'hyundai', 'infiniti', 'jaguar', 'jeep', 'kia', 'lamborghini', 'land', 'land rover', 'lexus', 'lincoln',
    'maserati', 'mazda', 'mclaren', 'mercedes', 'mercedes benz', 'mercedes-benz', 'mini', 'mitsubishi', 'nissan',
    'oldsmobile', 'polestar', 'pontiac', 'porsche', 'ram', 'rolls', 'rolls royce', 'saab', 'saturn', 'scion',
    'subaru', 'tesla', 'toyota', 'volkswagen', 'vw', 'volvo',
]);

async function buildStatsEmbeds({ scope, guildId, guildName, client }) {
    const matchScope = scope === 'server' && guildId ? { guildId } : {};

    const [
        timeSeries,
        approvalRates,
        aiStats,
        turnaround,
        brandApproval,
        topBrands,
        topVehicles,
        topUsers,
    ] = await Promise.all([
        verificationsOverTime(matchScope),
        approvalDenialRate(matchScope),
        aiApprovalStats(matchScope),
        averageTurnaround(matchScope),
        brandApprovalRates(matchScope),
        mostCommonBrands(matchScope),
        mostPopularVehicles(matchScope),
        topUsersByVehicles(matchScope, client),
    ]);

    const scopeText = scopeLabel(scope, guildName);

    return Promise.all([
        createEntry({
            key: 'over_time',
            label: 'Verifications Over Time',
            title: `Verifications Over Time (${scopeText})`,
            description: 'Annual counts of approvals and denials (since the start).',
            chartConfig: lineChart(
                timeSeries.labels,
                [
                    { label: 'Approved', data: timeSeries.approved, color: COLORS.primary },
                    { label: 'Denied', data: timeSeries.denied, color: COLORS.secondary },
                ],
                { xLabel: 'Year', yLabel: 'Applications' }
            ),
        }),
        createEntry({
            key: 'approval_rate',
            label: 'Approval vs Denial',
            title: `Approval vs Denial (${scopeText})`,
            description: 'Overall approval / denial split.',
            chartConfig: pieChart(
                ['Approved', 'Denied'],
                [approvalRates.approved, approvalRates.denied],
                [COLORS.primary, COLORS.secondary]
            ),
        }),
        createEntry({
            key: 'ai_stats',
            label: 'AI Approval Stats',
            title: `AI Approval Stats (${scopeText})`,
            description: 'Auto approvals/denials and overrides.',
            chartConfig: pieChart(
                ['AI Approved', 'AI Denied', 'Override (Approved→Denied)', 'Override (Denied→Approved)'],
                [aiStats.autoApproved, aiStats.autoDenied, aiStats.overrideToDenied, aiStats.overrideToApproved],
                [COLORS.primary, COLORS.secondary, COLORS.dark, COLORS.blue]
            ),
        }),
        createEntry({
            key: 'brand_approval',
            label: 'Brand Approval Rate',
            title: `Brand Approval Rate (${scopeText})`,
            description: 'Top brands by approval percentage (min 3 decisions).',
            chartConfig: barChart(brandApproval.labels, brandApproval.rates, COLORS.primary, {
                xLabel: 'Approval %',
                yLabel: 'Brand (decisions)',
                datasetLabel: 'Approval %',
                xMax: 100,
                orientation: 'horizontal',
            }),
        }),
        createEntry({
            key: 'turnaround',
            label: 'Average Turnaround',
            title: `Average Turnaround (${scopeText})`,
            description: 'Average hours from submit to decision (by decision month, last 5 months).',
            chartConfig: lineChart(
                turnaround.labels,
                [{ label: 'Avg Hours', data: turnaround.hours, color: COLORS.primary }],
                { xLabel: 'Month', yLabel: 'Hours' }
            ),
        }),
        createEntry({
            key: 'brands',
            label: 'Top Brands',
            title: `Top Brands (${scopeText})`,
            description: 'Most common brands by count.',
            chartConfig: barChart(topBrands.labels, topBrands.counts, COLORS.primary, {
                xLabel: 'Num of vehicles',
                yLabel: 'Brand',
                datasetLabel: 'Vehicles',
                orientation: 'horizontal',
                enableDatalabels: true,
                datalabelsColor: COLORS.black,
                datalabelsBackground: COLORS.white,
            }),
        }),
        createEntry({
            key: 'vehicles',
            label: 'Most Popular Vehicles',
            title: `Most Popular Vehicles (${scopeText})`,
            description: 'Top vehicles by count.',
            chartConfig: barChart(topVehicles.labels, topVehicles.counts, COLORS.primary, {
                xLabel: 'Num of vehicles',
                yLabel: 'Vehicle',
                datasetLabel: 'Vehicles',
                orientation: 'horizontal',
                enableDatalabels: true,
                datalabelsColor: COLORS.black,
                datalabelsBackground: COLORS.white,
            }),
        }),
        createEntry({
            key: 'users',
            label: 'Top Users',
            title: `Top Users (${scopeText})`,
            description: 'Users with the most verified vehicles.',
            chartConfig: barChart(topUsers.labels, topUsers.counts, COLORS.primary, {
                xLabel: 'Num of vehicles',
                yLabel: 'User',
                datasetLabel: 'Vehicles',
                orientation: 'horizontal',
            }),
        }),
    ]);
}

async function createEntry({ key, label, title, description, chartConfig }) {
    const imageUrl = await chartUrlFromConfig(chartConfig);
    return {
        key,
        label,
        embed: buildEmbed({ title, description, imageUrl }),
    };
}

function buildEmbed({ title, description, imageUrl }) {
    return {
        title,
        description,
        image: { url: imageUrl },
        color: 0xFFFCFF,
        footer: { text: 'Live stats • ThrottleBot Verification' },
    };
}

function scopeLabel(scope, guildName) {
    return scope === 'server' ? guildName : 'Global';
}

async function verificationsOverTime(matchScope) {
    const match = { ...matchScope };
    const data = await verificationSchema.aggregate([
        { $match: match },
        {
            $project: {
                decision: '$decision',
                status: '$status',
                submittedRaw: { $ifNull: ['$submittedOn', '$createdAt'] },
            },
        },
        {
            $match: {
                submittedRaw: { $ne: null },
            },
        },
        {
            $project: {
                decision: '$decision',
                status: '$status',
                submittedDate: {
                    $cond: [
                        { $isNumber: '$submittedRaw' },
                        { $toDate: '$submittedRaw' },
                        {
                            $toDate: {
                                $switch: {
                                    branches: [
                                        {
                                            case: { $regexMatch: { input: { $toString: '$submittedRaw' }, regex: /^\d+$/ } },
                                            then: { $toLong: '$submittedRaw' },
                                        },
                                    ],
                                    default: '$submittedRaw',
                                },
                            },
                        },
                    ],
                },
            },
        },
        {
            $project: {
                decision: '$decision',
                submittedDate: 1,
                decisionCategory: {
                    $cond: [
                        {
                            $or: [
                                { $eq: ['$decision', 'approved'] },
                                { $eq: ['$status', 'auto-approved'] },
                            ],
                        },
                        'approved',
                        'denied',
                    ],
                },
                year: { $year: '$submittedDate' },
            },
        },
        { $match: { submittedDate: { $ne: null }, decisionCategory: { $in: ['approved', 'denied'] } } },
        {
            $group: {
                _id: { year: '$year', decision: '$decisionCategory' },
                count: { $sum: 1 },
            },
        },
    ]);

    const yearsPresent = data.map((d) => d._id.year).filter((y) => Number.isFinite(y));
    const fallbackYear = new Date().getFullYear();
    const minYear = yearsPresent.length ? Math.min(...yearsPresent) : fallbackYear;
    const maxYear = yearsPresent.length ? Math.max(...yearsPresent) : fallbackYear;
    const labels = [];
    for (let y = minYear; y <= maxYear; y += 1) labels.push(String(y));

    const approved = labels.map((year) =>
        data.find((d) => String(d._id.year) === year && d._id.decision === 'approved')?.count || 0
    );
    const denied = labels.map((year) =>
        data.find((d) => String(d._id.year) === year && d._id.decision === 'denied')?.count || 0
    );

    const finalLabels = labels.length ? labels : [String(fallbackYear)];
    const finalApproved = labels.length ? approved : [0];
    const finalDenied = labels.length ? denied : [0];

    return { labels: finalLabels, approved: finalApproved, denied: finalDenied };
}

async function approvalDenialRate(matchScope) {
    const applications = await verificationSchema.find(matchScope).select('decision status').lean();
    let approved = 0;
    let denied = 0;

    applications.forEach((app) => {
        const bucket = decisionBucket(app.decision, app.status);
        if (bucket === 'approved') approved += 1;
        if (bucket === 'denied') denied += 1;
    });

    return { approved, denied };
}

async function aiApprovalStats(matchScope) {
    const applications = await verificationSchema
        .find(matchScope)
        .select('decision status decidedBy')
        .lean();

    let autoApproved = 0;
    let autoDenied = 0;
    let overrideToDenied = 0;
    let overrideToApproved = 0;

    applications.forEach((app) => {
        if (app.decision === 'overridden-denied') {
            overrideToDenied += 1;
            return;
        }
        if (app.decision === 'overridden-approved') {
            overrideToApproved += 1;
            return;
        }

        const isAutoApproved =
            app.status === 'auto-approved' ||
            app.decision === 'auto-approved' ||
            (app.decidedBy === 'ai-auto' && app.decision === 'approved');
        const isAutoDenied =
            app.status === 'auto-denied' ||
            app.decision === 'auto-denied' ||
            (app.decidedBy === 'ai-auto' && app.decision === 'denied');

        if (isAutoApproved) autoApproved += 1;
        else if (isAutoDenied) autoDenied += 1;
    });

    return { autoApproved, autoDenied, overrideToDenied, overrideToApproved };
}

async function averageTurnaround(matchScope) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 4);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    // Mirror ETA logic: only consider decided applications with approved/denied decisions
    const match = {
        ...matchScope,
        decidedOn: { $ne: null },
        decision: { $in: ['approved', 'denied'] },
    };

    const data = await verificationSchema.aggregate([
        { $match: match },
        {
            $project: {
                submittedDate: normalizeDateExpr('$submittedOn'),
                decidedDate: normalizeDateExpr('$decidedOn'),
            },
        },
        {
            $match: {
                submittedDate: { $type: 'date' },
                decidedDate: { $type: 'date' },
                decidedDate: { $gte: cutoff },
            },
        },
        {
            $project: {
                decidedMonth: {
                    $dateTrunc: {
                        date: '$decidedDate',
                        unit: 'month',
                    },
                },
                turnaroundMs: { $subtract: ['$decidedDate', '$submittedDate'] },
            },
        },
        { $match: { turnaroundMs: { $gte: 0 } } },
        {
            $group: {
                _id: '$decidedMonth',
                avgMs: { $avg: '$turnaroundMs' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const months = [];
    const start = startOfMonth(new Date());
    for (let i = 4; i >= 0; i -= 1) {
        const d = new Date(start);
        d.setMonth(d.getMonth() - i);
        months.push(d);
    }

    const dataMap = new Map(
        data.map((d) => [
            new Date(d._id).toISOString().slice(0, 7),
            Math.max(0, d.avgMs / 1000 / 60 / 60),
        ])
    );

    const labels = months.map((d) => d.toISOString().slice(0, 7));
    const hours = labels.map((label) => dataMap.get(label) || 0);

    return { labels, hours };
}

async function brandApprovalRates(matchScope) {
    const applications = await verificationSchema
        .find(matchScope)
        .select('vehicle vehicleBrand vehicleModel decision status')
        .lean();

    const brandStats = new Map();

    for (const app of applications) {
        const meta = resolveBrandFields({
            vehicleName: app.vehicle,
            vehicleBrand: app.vehicleBrand,
            vehicleModel: app.vehicleModel,
        });
        if (!meta.brandKey) continue;

        const bucket = brandStats.get(meta.brandKey) || { label: meta.brand || 'Unknown', approved: 0, total: 0 };
        const decision = decisionBucket(app.decision, app.status);
        if (!decision) continue;

        if (decision === 'approved') bucket.approved += 1;
        bucket.total += 1;
        if (!bucket.label && meta.brand) bucket.label = meta.brand;
        brandStats.set(meta.brandKey, bucket);
    }

    const ranked = Array.from(brandStats.values())
        .filter((b) => b.total >= 3)
        .sort((a, b) => {
            const rateA = a.approved / a.total;
            const rateB = b.approved / b.total;
            if (rateA === rateB) return b.total - a.total;
            return rateB - rateA;
        })
        .slice(0, 10);

    return {
        labels: ranked.map((b) => `${formatLabel(b.label)} (${b.total})`),
        rates: ranked.map((b) => Math.round((b.approved / b.total) * 100)),
    };
}

async function mostCommonBrands(matchScope) {
    const vehicles = await garageSchema.find(matchScope).select('vehicle vehicleBrand vehicleModel').lean();
    const brandCounts = new Map();

    for (const vehicle of vehicles) {
        const meta = resolveBrandFields({
            vehicleName: vehicle.vehicle,
            vehicleBrand: vehicle.vehicleBrand,
            vehicleModel: vehicle.vehicleModel,
        });
        if (!meta.brandKey) continue;

        const bucket = brandCounts.get(meta.brandKey) || { label: meta.brand || 'Unknown', count: 0 };
        if (!bucket.label && meta.brand) bucket.label = meta.brand;
        bucket.count += 1;
        brandCounts.set(meta.brandKey, bucket);
    }

    const sorted = Array.from(brandCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        labels: sorted.map((b) => formatLabel(b.label)),
        counts: sorted.map((b) => b.count),
    };
}

async function mostPopularVehicles(matchScope) {
    const vehicles = await garageSchema.find(matchScope).select('vehicle vehicleBrand vehicleModel').lean();
    const counts = new Map();

    for (const v of vehicles) {
        const raw = typeof v.vehicle === 'string' ? v.vehicle : '';
        const meta = resolveBrandFields({
            vehicleName: raw,
            vehicleBrand: v.vehicleBrand,
            vehicleModel: v.vehicleModel,
        });

        const brandPart = meta.brandKey ? meta.brandKey : null;
        const modelPart = meta.model ? meta.model.toLowerCase().trim() : '';
        const key = brandPart ? `${brandPart}:${modelPart}` : normalizeVehicleKey(raw);
        if (!key) continue;

        const label = brandPart
            ? [formatLabel(meta.brand), meta.model ? formatLabel(meta.model) : null].filter(Boolean).join(' ')
            : raw || key;

        const existing = counts.get(key) || { count: 0, sample: label };
        existing.count += 1;
        counts.set(key, existing);
    }

    const sorted = Array.from(counts.entries())
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    return {
        labels: sorted.map((v) => v.sample || v.key),
        counts: sorted.map((v) => v.count),
    };
}

async function topUsersByVehicles(matchScope, client) {
    const users = await garageSchema.aggregate([
        { $match: matchScope },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    const userIds = users.map((u) => u._id);
    const labelMap = await resolveUserLabels(userIds, client);

    const labels = users.map((u) => labelMap.get(u._id) || u._id);
    const counts = users.map((u) => u.count);
    return { labels, counts };
}

function lineChart(labels, datasets, options = {}) {
    const safeLabels = labels.length ? labels : ['No Data'];
    const safeDatasets = datasets.map((d) => ({
        ...d,
        data: d.data.length ? d.data : [0],
        label: d.label || 'Series',
    }));
    return {
        type: 'line',
        data: {
            labels: safeLabels,
            datasets: safeDatasets.map((d) => ({
                label: d.label,
                data: d.data,
                fill: false,
                borderColor: d.color,
                backgroundColor: d.color,
                tension: 0.3,
            })),
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: COLORS.text } },
            },
            scales: {
                x: {
                    ticks: { color: COLORS.text, maxTicksLimit: 6 },
                    grid: { color: 'rgba(51,51,51,0.08)' },
                    title: options.xLabel ? { display: true, text: options.xLabel, color: COLORS.text } : undefined,
                },
                y: {
                    ticks: { color: COLORS.text },
                    grid: { color: 'rgba(51,51,51,0.08)' },
                    title: options.yLabel ? { display: true, text: options.yLabel, color: COLORS.text } : undefined,
                },
            },
        },
        version: 3,
    };
}

function barChart(labels, data, color, options = {}) {
    const safeLabels = labels.length ? labels : ['No Data'];
    const safeData = data.length ? data : [0];
    const isHorizontal = options.orientation === 'horizontal';
    const config = {
        type: 'bar',
        data: {
            labels: safeLabels,
            datasets: [
                {
                    data: safeData,
                    backgroundColor: color,
                    label: options.datasetLabel || '',
                    barThickness: options.barThickness || 20,
                    categoryPercentage: 0.8,
                    barPercentage: 0.9,
                },
            ],
        },
        options: {
            plugins: { legend: { display: Boolean(options.datasetLabel && options.displayLegend !== false) } },
            indexAxis: isHorizontal ? 'y' : 'x',
            scales: {
                x: {
                    ticks: {
                        color: COLORS.text,
                        maxRotation: 0,
                        minRotation: 0,
                        maxTicksLimit: 6,
                        font: { size: 12 },
                    },
                    grid: { color: 'rgba(51,51,51,0.08)' },
                    title: options.xLabel ? { display: true, text: options.xLabel, color: COLORS.text } : undefined,
                    max: typeof options.xMax === 'number' ? options.xMax : undefined,
                    min: typeof options.xMin === 'number' ? options.xMin : undefined,
                },
                y: {
                    ticks: {
                        color: COLORS.text,
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: false,
                        font: { size: 12 },
                    },
                    grid: { color: 'rgba(51,51,51,0.08)' },
                    title: options.yLabel ? { display: true, text: options.yLabel, color: COLORS.text } : undefined,
                },
            },
        },
        version: 3,
    };

    if (options.enableDatalabels) {
        config.plugins = ['chartjs-plugin-datalabels'];
        config.options.plugins.datalabels = {
            anchor: 'end',
            align: 'top',
            color: options.datalabelsColor || COLORS.black,
            backgroundColor: options.datalabelsBackground || COLORS.white,
            borderColor: '#000000',
            borderWidth: 1,
            borderRadius: 4,
            padding: 4,
            font: { weight: 'bold', size: 12 },
            formatter: (value) => `${value}`,
            clamp: true,
            clip: false,
        };
    }

    return config;
}

function pieChart(labels, data, colors) {
    return {
        type: 'pie',
        data: {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: colors,
                },
            ],
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: COLORS.text } },
            },
        },
        version: 3,
    };
}

function startOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function decisionBucket(decision, status) {
    const approvedStates = ['approved', 'overridden-approved', 'auto-approved'];
    const deniedStates = ['denied', 'overridden-denied', 'auto-denied'];
    if (approvedStates.includes(decision) || approvedStates.includes(status)) return 'approved';
    if (deniedStates.includes(decision) || deniedStates.includes(status)) return 'denied';
    return null;
}

async function resolveUserLabels(userIds, client) {
    const map = new Map();
    if (!Array.isArray(userIds) || userIds.length === 0) return map;
    if (!client?.users?.fetch) {
        userIds.forEach((id) => map.set(id, id));
        return map;
    }

    await Promise.all(
        userIds.map(async (id) => {
            try {
                const user = await client.users.fetch(id);
                const label = user.globalName || user.username || id;
                map.set(id, label);
            } catch {
                map.set(id, id);
            }
        })
    );

    return map;
}

async function chartUrlFromConfig(config) {
    const json = JSON.stringify(config);
    const directUrl = QUICKCHART_BASE + encodeURIComponent(json);
    if (directUrl.length <= 1900) return directUrl;

    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    try {
        const res = await fetchFn('https://quickchart.io/chart/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chart: config }),
        });
        const data = await res.json();
        if (data?.url) return data.url;
    } catch (err) {
        console.error('QuickChart shorten failed', err.message || err);
    }

    // Fallback: truncate the encoded URL to Discord's limit
    return directUrl.slice(0, 1900);
}

function normalizeVehicleKey(vehicle = '') {
    if (!vehicle || typeof vehicle !== 'string') return null;
    const cleaned = vehicle.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!cleaned) return null;
    let tokens = cleaned.split(' ');

    // Remove leading year/number tokens
    while (tokens.length && (/^\d{2,4}$/.test(tokens[0]) || /^\d+$/.test(tokens[0]))) {
        tokens.shift();
    }

    if (!tokens.length) return cleaned;

    // Drop brand prefixes (handles multi-word brands)
    for (let i = Math.min(3, tokens.length); i >= 1; i -= 1) {
        const candidate = tokens.slice(0, i).join(' ');
        if (VEHICLE_BRAND_PREFIXES.has(candidate)) {
            tokens = tokens.slice(i);
            break;
        }
    }

    if (!tokens.length) return cleaned;

    return tokens.join(' ');
}

function formatLabel(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

module.exports = { buildStatsEmbeds };

function normalizeDateExpr(field) {
    return {
        $cond: [
            { $isNumber: field },
            { $toDate: field },
            {
                $toDate: {
                    $switch: {
                        branches: [
                            {
                                case: { $regexMatch: { input: { $toString: field }, regex: /^\d+$/ } },
                                then: { $toLong: field },
                            },
                        ],
                        default: field,
                    },
                },
            },
        ],
    };
}
