const MULTI_WORD_BRANDS = [
    'alfa romeo',
    'aston martin',
    'land rover',
    'range rover',
    'mercedes benz',
    'mercedes amg',
    'rolls royce',
    'royal enfield',
];

const STOP_BRAND_KEYS = new Set([
    'test',
    'vehicle',
    'car',
    'bike',
    'truck',
    'motorcycle',
    'scooter',
    'my',
    'your',
    'the',
    'a',
    'an',
    'ride',
    'auto',
]);

function normalizeBrand(brand) {
    if (!brand || typeof brand !== 'string') return null;
    const normalized = brand.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return normalized || null;
}

function isYearToken(token) {
    if (!/^\d{4}$/.test(token)) return false;
    const year = Number(token);
    return year >= 1900 && year <= 2099;
}

function isValidBrandKey(brandKey) {
    if (!brandKey) return false;
    if (/^\d+$/.test(brandKey)) return false;
    if (STOP_BRAND_KEYS.has(brandKey)) return false;
    return true;
}

/**
 * Extracts brand/model info from a vehicle string.
 * Hyphens/underscores are treated as spaces so "Mercedes-Benz" is parsed as "Mercedes Benz".
 * Leading year tokens (e.g., "2020") are skipped for brand detection.
 */
function extractVehicleMeta(vehicleName = '') {
    const cleaned = vehicleName.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
        return { brand: null, model: null, brandKey: null };
    }

    const tokens = cleaned.split(' ');
    const tokensLower = tokens.map((t) => t.toLowerCase());

    // Drop leading year/pure-number tokens so "2020 Transition Patrol" resolves to Transition.
    while (tokens.length && (isYearToken(tokensLower[0]) || /^\d+$/.test(tokensLower[0]))) {
        tokens.shift();
        tokensLower.shift();
    }

    if (!tokens.length) {
        return { brand: null, model: null, brandKey: null };
    }

    let brandLength = 1;

    for (const candidate of MULTI_WORD_BRANDS) {
        const parts = candidate.split(' ');
        if (tokensLower.length >= parts.length && parts.every((part, idx) => tokensLower[idx] === part)) {
            brandLength = parts.length;
            break;
        }
    }

    const brand = tokens.slice(0, brandLength).join(' ').trim() || null;
    const model = tokens.slice(brandLength).join(' ').trim() || null;
    const brandKey = normalizeBrand(brand);

    if (!isValidBrandKey(brandKey)) {
        return { brand: null, model: model || null, brandKey: null };
    }

    return {
        brand: brandKey, // store lowercase/normalized brand
        model: model || null,
        brandKey,
    };
}

/**
 * Picks the best brand/model using stored fields with a fallback to parsing the vehicle string.
 * Stored brand is used only if it looks valid; otherwise we fall back to parsed values.
 */
function resolveBrandFields({ vehicleName, vehicleBrand, vehicleModel }) {
    const parsed = extractVehicleMeta(vehicleName || '');
    const storedKey = normalizeBrand(vehicleBrand);
    const storedValid = isValidBrandKey(storedKey);

    const brand = storedValid ? storedKey : parsed.brand;
    const model = storedValid ? (vehicleModel || parsed.model) : parsed.model;

    return {
        brand: brand || null,
        model: model || null,
        brandKey: normalizeBrand(brand || parsed.brand),
    };
}

module.exports = {
    extractVehicleMeta,
    normalizeBrand,
    resolveBrandFields,
    isValidBrandKey,
};
