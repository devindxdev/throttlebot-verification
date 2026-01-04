const verificationSchema = require('../../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');

const QUICKCHART_BASE = 'https://quickchart.io/chart?c=';
const COLORS = {
    primary: '#5865F2',
    success: '#77DD77',
    danger: '#FF6961',
    accent: '#FDD66A',
};

async function buildStatsEmbeds({ scope, guildId, guildName }) {
    const matchScope = scope === 'server' && guildId ? { guildId } : {};

    const [
        timeSeries,
        approvalRates,
        aiStats,
        turnaround,
        topBrands,
        topVehicles,
        topUsers,
    ] = await Promise.all([
        verificationsOverTime(matchScope),
        approvalDenialRate(matchScope),
        aiApprovalStats(matchScope),
        averageTurnaround(matchScope),
        mostCommonBrands(matchScope),
        mostPopularVehicles(matchScope),
        topUsersByVehicles(matchScope),
    ]);

    const scopeText = scopeLabel(scope, guildName);

    return [
        {
            key: 'over_time',
            label: 'Verifications Over Time',
            embed: buildEmbed({
                title: `Verifications Over Time (${scopeText})`,
                description: 'Annual counts of approvals and denials (since the start).',
                imageUrl: lineChart(timeSeries.labels, [
                    { label: 'Approved', data: timeSeries.approved, color: COLORS.success },
                    { label: 'Denied', data: timeSeries.denied, color: COLORS.danger },
                ]),
            }),
        },
        {
            key: 'approval_rate',
            label: 'Approval vs Denial',
            embed: buildEmbed({
                title: `Approval vs Denial (${scopeText})`,
                description: 'Overall approval / denial split.',
                imageUrl: pieChart(
                    ['Approved', 'Denied'],
                    [approvalRates.approved, approvalRates.denied],
                    [COLORS.success, COLORS.danger]
                ),
            }),
        },
        {
            key: 'ai_stats',
            label: 'AI Approval Stats',
            embed: buildEmbed({
                title: `AI Approval Stats (${scopeText})`,
                description: 'Auto approvals/denials and overrides.',
                imageUrl: pieChart(
                    ['AI Approved', 'AI Denied', 'Override (Approved→Denied)', 'Override (Denied→Approved)'],
                    [aiStats.autoApproved, aiStats.autoDenied, aiStats.overrideToDenied, aiStats.overrideToApproved],
                    [COLORS.success, COLORS.danger, COLORS.accent, COLORS.primary]
                ),
            }),
        },
        {
            key: 'turnaround',
            label: 'Average Turnaround',
            embed: buildEmbed({
                title: `Average Turnaround (${scopeText})`,
                description: 'Average hours from submit to decision (last 30 days).',
                imageUrl: lineChart(turnaround.labels, [
                    { label: 'Avg Hours', data: turnaround.hours, color: COLORS.primary },
                ]),
            }),
        },
        {
            key: 'brands',
            label: 'Top Brands',
            embed: buildEmbed({
                title: `Top Brands (${scopeText})`,
                description: 'Most common brands by count.',
                imageUrl: barChart(topBrands.labels, topBrands.counts, COLORS.primary),
            }),
        },
        {
            key: 'vehicles',
            label: 'Most Popular Vehicles',
            embed: buildEmbed({
                title: `Most Popular Vehicles (${scopeText})`,
                description: 'Top vehicles by count.',
                imageUrl: barChart(topVehicles.labels, topVehicles.counts, COLORS.accent),
            }),
        },
        {
            key: 'users',
            label: 'Top Users',
            embed: buildEmbed({
                title: `Top Users (${scopeText})`,
                description: 'Users with the most verified vehicles.',
                imageUrl: barChart(topUsers.labels, topUsers.counts, COLORS.success),
            }),
        },
    ];
}

function buildEmbed({ title, description, imageUrl }) {
    return {
        title,
        description,
        image: { url: imageUrl },
        color: 0x5865F2,
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
    const data = await verificationSchema.aggregate([
        { $match: matchScope },
        {
            $project: {
                decisionBucket: {
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
            },
        },
        { $group: { _id: '$decisionBucket', count: { $sum: 1 } } },
    ]);

    return {
        approved: data.find((d) => d._id === 'approved')?.count || 0,
        denied: data.find((d) => d._id === 'denied')?.count || 0,
    };
}

async function aiApprovalStats(matchScope) {
    const data = await verificationSchema.aggregate([
        { $match: matchScope },
        {
            $group: {
                _id: '$decision',
                count: { $sum: 1 },
            },
        },
    ]);

    return {
        autoApproved: data.filter((d) => ['auto-approved'].includes(d._id)).reduce((a, b) => a + b.count, 0),
        autoDenied: data.filter((d) => ['auto-denied'].includes(d._id)).reduce((a, b) => a + b.count, 0),
        overrideToDenied: data.filter((d) => ['overridden-denied'].includes(d._id)).reduce((a, b) => a + b.count, 0),
        overrideToApproved: data.filter((d) => ['overridden-approved'].includes(d._id)).reduce((a, b) => a + b.count, 0),
    };
}

async function averageTurnaround(matchScope) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const match = { ...matchScope, decidedOn: { $ne: null } };
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
                submittedDate: { $gte: cutoff },
            },
        },
        {
            $project: {
                day: 1,
                turnaroundMs: { $subtract: ['$decidedDate', '$submittedDate'] },
            },
        },
        {
            $group: {
                _id: '$day',
                avgMs: { $avg: '$turnaroundMs' },
            },
        },
    ]);

    const days = Array.from({ length: 30 }).map((_, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - idx));
        return d.toISOString().slice(0, 10);
    });

    const hours = days.map((day) => {
        const record = data.find((d) => d._id === day);
        return record ? Math.max(0, record.avgMs / 1000 / 60 / 60) : 0;
    });

    return { labels: days, hours };
}

async function mostCommonBrands(matchScope) {
    const vehicles = await garageSchema.aggregate([
        { $match: matchScope },
        {
            $project: {
                brand: {
                    $trim: {
                        input: { $arrayElemAt: [{ $split: ['$vehicle', ' '] }, 0] },
                    },
                },
            },
        },
        { $match: { brand: { $ne: null, $ne: '' } } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    const labels = vehicles.map((v) => v._id);
    const counts = vehicles.map((v) => v.count);
    return { labels, counts };
}

async function mostPopularVehicles(matchScope) {
    const vehicles = await garageSchema.aggregate([
        { $match: matchScope },
        { $group: { _id: '$vehicle', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    const labels = vehicles.map((v) => v._id);
    const counts = vehicles.map((v) => v.count);
    return { labels, counts };
}

async function topUsersByVehicles(matchScope) {
    const users = await garageSchema.aggregate([
        { $match: matchScope },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    const labels = users.map((u) => u._id);
    const counts = users.map((u) => u.count);
    return { labels, counts };
}

function lineChart(labels, datasets) {
    const safeLabels = labels.length ? labels : ['No Data'];
    const safeDatasets = datasets.map((d) => ({
        ...d,
        data: d.data.length ? d.data : [0],
    }));
    const config = {
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
                legend: { position: 'bottom', labels: { color: '#eaeaea' } },
            },
            scales: {
                x: { ticks: { color: '#eaeaea', maxTicksLimit: 6 }, grid: { color: 'rgba(234,234,234,0.1)' } },
                y: { ticks: { color: '#eaeaea' }, grid: { color: 'rgba(234,234,234,0.1)' } },
            },
        },
    };
    return QUICKCHART_BASE + encodeURIComponent(JSON.stringify(config));
}

function barChart(labels, data, color) {
    const safeLabels = labels.length ? labels : ['No Data'];
    const safeData = data.length ? data : [0];
    const config = {
        type: 'bar',
        data: {
            labels: safeLabels,
            datasets: [
                {
                    data: safeData,
                    backgroundColor: color,
                },
            ],
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#eaeaea', maxTicksLimit: 6 }, grid: { color: 'rgba(234,234,234,0.1)' } },
                y: { ticks: { color: '#eaeaea' }, grid: { color: 'rgba(234,234,234,0.1)' } },
            },
        },
    };
    return QUICKCHART_BASE + encodeURIComponent(JSON.stringify(config));
}

function pieChart(labels, data, colors) {
    const config = {
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
                legend: { position: 'bottom', labels: { color: '#eaeaea' } },
            },
        },
    };
    return QUICKCHART_BASE + encodeURIComponent(JSON.stringify(config));
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
