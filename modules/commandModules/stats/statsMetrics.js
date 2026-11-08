const { statsVehicleMeta } = require('./statsBrands.js');

const APPROVED = new Set(['approved', 'overridden-approved', 'auto-approved']);
const DENIED = new Set(['denied', 'overridden-denied', 'auto-denied', 'denied-read-guide', 'denied | user left', 'banned']);

function state(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function decisionBucket(decision, status) {
    // Open includes appealed applications: an old AI decision is not final.
    if (state(status) === 'open') return null;
    // Legacy records append free-text reasons after a pipe separator.
    const value = state(decision).split('|', 1)[0].trim();
    if (APPROVED.has(value)) return 'approved';
    if (DENIED.has(value)) return 'denied';
    // Only missing decisions can fall back to the auto status. Do not guess
    // an outcome for closed legacy records with an unknown decision.
    if (value) return null;
    if (state(status) === 'auto-approved') return 'approved';
    if (state(status) === 'auto-denied') return 'denied';
    return null;
}

function normalizeDate(value) {
    if (value == null || value === '' || typeof value === 'boolean') return null;
    if (!(value instanceof Date) && !['string', 'number'].includes(typeof value)) return null;
    const input = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
    const date = new Date(input);
    return Number.isFinite(date.getTime()) ? date : null;
}

function isAiDecision(app) {
    if (state(app.decision).startsWith('overridden-')) return false;
    return app.decidedBy === 'ai-auto' || state(app.decision).startsWith('auto-') ||
        ['auto-approved', 'auto-denied'].includes(state(app.status));
}

function applicationMetrics(applications, now = new Date()) {
    const totals = { approved: 0, denied: 0, excluded: 0 };
    const ai = { autoApproved: 0, autoDenied: 0, overrideToDenied: 0, overrideToApproved: 0 };
    const years = new Map();
    const months = Array.from({ length: 5 }, (_, index) => {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4 + index, 1));
        return date.toISOString().slice(0, 7);
    });
    const durations = new Map(months.map(month => [month, { staff: [], ai: [] }]));
    const brands = new Map();
    let missingSubmissionDates = 0;
    let excludedTurnaround = 0;
    let unknownDecisionBrands = 0;

    for (const app of applications) {
        const bucket = decisionBucket(app.decision, app.status);
        if (!bucket) { totals.excluded += 1; continue; }
        totals[bucket] += 1;
        if (state(app.decision) === 'overridden-denied') ai.overrideToDenied += 1;
        else if (state(app.decision) === 'overridden-approved') ai.overrideToApproved += 1;
        else if (isAiDecision(app)) ai[bucket === 'approved' ? 'autoApproved' : 'autoDenied'] += 1;

        const submitted = normalizeDate(app.submittedOn) || normalizeDate(app.createdAt);
        if (submitted && submitted <= now) {
            const year = submitted.getUTCFullYear();
            const counts = years.get(year) || { approved: 0, denied: 0 };
            counts[bucket] += 1;
            years.set(year, counts);
        } else missingSubmissionDates += 1;

        const decided = normalizeDate(app.decidedOn);
        const administrative = state(app.decision) === 'denied | user left';
        if (!submitted || !decided || decided < submitted || decided > now || administrative) {
            excludedTurnaround += 1;
        } else {
            const month = durations.get(decided.toISOString().slice(0, 7));
            if (month) month[isAiDecision(app) ? 'ai' : 'staff'].push((decided - submitted) / 3600000);
        }

        const meta = vehicleMeta(app);
        if (meta.brandKey) {
            const counts = brands.get(meta.brandKey) || { label: meta.brandKey, approved: 0, total: 0 };
            counts.total += 1;
            if (bucket === 'approved') counts.approved += 1;
            brands.set(meta.brandKey, counts);
        } else unknownDecisionBrands += 1;
    }

    const recordedYears = [...years.keys()];
    const minYear = recordedYears.length ? Math.min(...recordedYears) : now.getUTCFullYear();
    const maxYear = recordedYears.length ? Math.max(...recordedYears) : minYear;
    const labels = Array.from({ length: maxYear - minYear + 1 }, (_, index) => String(minYear + index));
    const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const rankedBrands = [...brands.values()].filter(b => b.total >= 3)
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
        .slice(0, 10);
    return {
        totals, ai, unknownDecisionBrands,
        timeSeries: {
            labels,
            approved: labels.map(year => years.get(Number(year))?.approved || 0),
            denied: labels.map(year => years.get(Number(year))?.denied || 0),
            missingSubmissionDates,
        },
        turnaround: {
            labels: months,
            staffHours: months.map(month => average(durations.get(month).staff)),
            aiHours: months.map(month => average(durations.get(month).ai)),
            staffCount: months.reduce((sum, month) => sum + durations.get(month).staff.length, 0),
            aiCount: months.reduce((sum, month) => sum + durations.get(month).ai.length, 0),
            excluded: excludedTurnaround,
        },
        brandApproval: {
            labels: rankedBrands.map(b => `${formatLabel(b.label)} (${b.total})`),
            rates: rankedBrands.map(b => Math.round(b.approved / b.total * 100)),
        },
    };
}

const vehicleMeta = statsVehicleMeta;

function normalizeModel(model = '') {
    // Group across model years; keep generation/trim and model numbers (e.g. BMW 2002).
    return model.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/^(?:19\d{2}|20\d{2})\s+/, '').replace(/\s+(?:19\d{2}|20\d{2})$/, '').trim();
}

function garageMetrics(vehicles) {
    const brands = new Map();
    const models = new Map();
    const users = new Map();
    let unknownBrands = 0;
    for (const vehicle of vehicles) {
        const meta = vehicleMeta(vehicle);
        if (meta.brandKey) brands.set(meta.brandKey, (brands.get(meta.brandKey) || 0) + 1);
        else unknownBrands += 1;
        const model = normalizeModel(meta.model || '');
        // Unknown brands retain the full name to avoid merging unrelated vehicles.
        const key = meta.brandKey ? `${meta.brandKey}:${model}` : state(vehicle.vehicle).replace(/\s+/g, ' ');
        if (key) {
            const label = meta.brandKey ? formatLabel(`${meta.brandKey} ${model}`) : vehicle.vehicle;
            const entry = models.get(key) || { label, count: 0 };
            entry.count += 1;
            models.set(key, entry);
        }
        if (vehicle.userId) users.set(vehicle.userId, (users.get(vehicle.userId) || 0) + 1);
    }
    const byCount = (a, b) => b.count - a.count || a.label.localeCompare(b.label);
    const brandEntries = [...brands].map(([label, count]) => ({ label: formatLabel(label), count }));
    const series = entries => ({ labels: entries.map(e => e.label), counts: entries.map(e => e.count) });
    return {
        topBrands: series([...brandEntries].sort(byCount).slice(0, 10)),
        leastBrands: series([...brandEntries].sort((a, b) => a.count - b.count || a.label.localeCompare(b.label)).slice(0, 10)),
        topVehicles: series([...models.values()].sort(byCount).slice(0, 10)),
        topUsers: [...users].map(([label, count]) => ({ label, count })).sort(byCount).slice(0, 10),
        unknownBrands,
    };
}

function formatLabel(text) {
    return text.split(' ').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

module.exports = { applicationMetrics, garageMetrics, decisionBucket, normalizeDate, isAiDecision };
