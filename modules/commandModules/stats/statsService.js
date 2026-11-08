const verificationSchema = require('../../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');
const { applicationMetrics, garageMetrics } = require('./statsMetrics.js');

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

async function buildStatsEmbeds({ scope, guildId, guildName, client }) {
    if (!['server', 'global'].includes(scope)) throw new Error('Invalid stats scope.');
    if (scope === 'server' && !guildId) throw new Error('Server stats must be requested in a server.');
    const matchScope = scope === 'server' ? { guildId } : {};
    // Read each collection once so all charts use the same set of records.
    const [applications, vehicles] = await Promise.all([
        verificationSchema.find(matchScope)
            .select('vehicle vehicleBrand vehicleModel decision status decidedBy submittedOn createdAt decidedOn').lean(),
        garageSchema.find(matchScope).select('vehicle vehicleBrand vehicleModel userId').lean(),
    ]);
    const { timeSeries, totals: approvalRates, ai: aiStats, turnaround, brandApproval, unknownDecisionBrands } = applicationMetrics(applications);
    const { topBrands, leastBrands, topVehicles, topUsers: users, unknownBrands } = garageMetrics(vehicles);
    const labelMap = await resolveUserLabels(users.map(user => user.label), client);
    const topUsers = { labels: users.map(user => labelMap.get(user.label) || user.label), counts: users.map(user => user.count) };
    const garageNote = scope === 'global'
        ? 'Counts garage entries across servers; the same vehicle may appear in multiple servers.'
        : 'Counts current garage entries, including sold collections.';
    const decisionNote = `${approvalRates.approved} approved, ${approvalRates.denied} denied. Pending, expired and unknown outcomes excluded (${approvalRates.excluded}). Denials include guide rejections, bans and user-left closures. Each submission counts separately.`;

    const scopeText = scopeLabel(scope, guildName);

    return Promise.all([
        createEntry({
            key: 'over_time',
            label: 'Verifications Over Time',
            title: `Verifications Over Time (${scopeText})`,
            description: `Final outcomes grouped by submission year (UTC). ${decisionNote} Missing/invalid or future submission dates excluded: ${timeSeries.missingSubmissionDates}.`,
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
            description: decisionNote,
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
            description: `AI approved: ${aiStats.autoApproved}; AI denied: ${aiStats.autoDenied}; overridden to denied: ${aiStats.overrideToDenied}; overridden to approved: ${aiStats.overrideToApproved}. These are mutually exclusive current outcomes. Pending appeals excluded; earlier AI decisions replaced by appeal handling cannot be reconstructed.`,
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
            description: `Approval percentages for the ten most-reviewed recognized brands (minimum 3 decisions, sample sizes shown). ${decisionNote} Unrecognized brands excluded: ${unknownDecisionBrands}.`,
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
            label: 'Staff Review Turnaround',
            title: `Staff Review Turnaround (${scopeText})`,
            description: `Mean hours to final staff decision, by UTC decision month (current month + previous 4). Staff: ${turnaround.staffCount} samples. AI decisions excluded (${turnaround.aiCount} in this window): their saved timestamps start after analysis and cannot measure AI processing time. Gaps mean no samples. Invalid/future dates and user-left closures excluded (${turnaround.excluded} across all history).`,
            chartConfig: lineChart(
                turnaround.labels,
                [
                    { label: 'Staff Avg Hours', data: turnaround.staffHours, color: COLORS.primary },
                ],
                { xLabel: 'Month', yLabel: 'Hours' }
            ),
        }),
        createEntry({
            key: 'brands',
            label: 'Top Brands',
            title: `Top Brands (${scopeText})`,
            description: `Most common brands. ${garageNote} Unrecognized brands excluded: ${unknownBrands}.`,
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
            key: 'brands_low',
            label: 'Least Popular Brands',
            title: `Least Popular Brands (${scopeText})`,
            description: `Ten least common recorded brands; ties sorted alphabetically. ${garageNote} Unrecognized brands excluded: ${unknownBrands}.`,
            chartConfig: barChart(leastBrands.labels, leastBrands.counts, COLORS.secondary, {
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
            description: `Vehicle names grouped by brand/model, ignoring case, spacing and leading/trailing model years; trims remain separate. ${garageNote}`,
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
            description: `Users with the most garage entries. ${garageNote}`,
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
    if (!imageUrl) {
        const values = chartConfig.data.labels.map((label, index) =>
            `${label}: ${chartConfig.data.datasets.map(dataset =>
                `${dataset.label || 'Count'} ${dataset.data[index] == null ? 'n/a' : Number(dataset.data[index].toFixed(2))}`
            ).join(', ')}`
        );
        description += `\n${values.join('\n')}`;
    }
    return {
        key,
        label,
        embed: buildEmbed({ title, description, imageUrl }),
    };
}

function buildEmbed({ title, description, imageUrl }) {
    return {
        title,
        description: (imageUrl ? description : `${description}\nChart unavailable; try again later.`).slice(0, 4096),
        ...(imageUrl ? { image: { url: imageUrl } } : {}),
        color: 0xFFFCFF,
        footer: { text: 'Live stats • ThrottleBot Verification' },
    };
}

function scopeLabel(scope, guildName) {
    return scope === 'server' ? guildName : 'Global';
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

    // A truncated URL is invalid JSON. Keep the stats usable without an image.
    return null;
}

module.exports = { buildStatsEmbeds };
