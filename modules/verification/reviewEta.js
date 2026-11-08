const { decisionBucket, normalizeDate, isAiDecision } = require('../commandModules/stats/statsMetrics');

function estimateReviewEta(applications, now = new Date()) {
    const reviews = applications.filter(app => {
        if (!decisionBucket(app.decision, app.status) || isAiDecision(app)) return false;
        if (String(app.decision).trim().toLowerCase() === 'denied | user left') return false;
        const submitted = normalizeDate(app.submittedOn) || normalizeDate(app.createdAt);
        const decided = normalizeDate(app.decidedOn);
        return submitted && decided && decided >= submitted && decided <= now;
    }).sort((a, b) => normalizeDate(b.decidedOn) - normalizeDate(a.decidedOn)).slice(0, 50);
    if (reviews.length < 20) return '24 - 48 Hours';
    const averageMs = reviews.reduce((sum, app) => sum +
        (normalizeDate(app.decidedOn) - (normalizeDate(app.submittedOn) || normalizeDate(app.createdAt))), 0) / reviews.length;
    const hours = Math.floor(averageMs / 3600000);
    const minutes = Math.floor(averageMs % 3600000 / 60000);
    if (hours === 0 && minutes === 0) return 'Under 1 minute';
    return [hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
        minutes ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : ''].filter(Boolean).join(' and ');
}

module.exports = { estimateReviewEta };
