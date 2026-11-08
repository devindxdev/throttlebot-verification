function validAnalysis(analysis) {
    return Boolean(analysis && typeof analysis === 'object' &&
        typeof analysis.requirementsMet === 'boolean' && typeof analysis.vehicleMatch === 'boolean' &&
        typeof analysis.confidence === 'number' && Number.isFinite(analysis.confidence) &&
        analysis.confidence >= 0 && analysis.confidence <= 100);
}

function canAutoApprove(analysis) {
    return validAnalysis(analysis) && analysis.requirementsMet === true && analysis.vehicleMatch === true &&
        analysis.confidence >= 90 && typeof analysis.estimatedValueUSD === 'number' &&
        Number.isFinite(analysis.estimatedValueUSD) && analysis.estimatedValueUSD > 0 && analysis.estimatedValueUSD < 50000;
}

module.exports = { validAnalysis, canAutoApprove };
