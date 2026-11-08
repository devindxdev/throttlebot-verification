const { extractVehicleMeta } = require('../../vehicleUtils.js');

// Explicit supported manufacturers prevent the first word of any submitted name
// (a model, nickname or test text) from becoming a brand in the rankings.
// This is intentionally conservative, not an exhaustive manufacturer registry.
const BRANDS = new Set(`
    abarth|acura|alfa romeo|amc|aprilia|aston martin|audi|bajaj|bentley|bertone|bmc|bmw|boardman|bugatti|buick|
    cadillac|can am|cannondale|case|cfmoto|changan|chevrolet|chrysler|citroen|coleman|commencal|craftsman|cupra|
    dacia|daewoo|daf|daihatsu|datsun|decathlon|delorean|derbi|desoto|dodge|ducati|eagle|edsel|eunos|
    faw|ferrari|fiat|ford|genesis|geo|gmc|gt|harley davidson|hino|hitachi|holden|honda|hsv|hummer|husqvarna|hyundai|
    ibis|infiniti|international|isuzu|jaguar|jeep|john deere|kawasaki|keeway|kenworth|kimera|kinroad|koenigsegg|ktm|kubota|
    lada|lamborghini|lancia|land rover|lexus|lincoln|lotus|lucid|mahindra|man|marin|maruti|maserati|mazda|
    mclaren|mercedes benz|mercury|mg|mini|mitsubishi|morgan|nissan|nukeproof|oldsmobile|opel|orbea|packard|pagani|peel|peterbilt|peugeot|
    piaggio|plymouth|polaris|polestar|pontiac|porsche|proton|purvis|ragley|ram|renault|rolls royce|rover|royal enfield|
    saab|saipa|saturn|scania|scion|seat|shelby|skoda|smart|ssangyong|studebaker|subaru|sunbeam|superlite|suzuki|sym|
    tata|tesla|tomos|toyota|transition|trek|triumph|tvs|ural|vauxhall|volkswagen|volvo|winnebago|yamaha|zastava|zaz
`.split('|').map(brand => brand.trim()).filter(Boolean));

const ALIASES = {
    chevy: 'chevrolet', chev: 'chevrolet',
    vw: 'volkswagen',
    mercedes: 'mercedes benz', benz: 'mercedes benz', merc: 'mercedes benz', mb: 'mercedes benz',
    'mercedes amg': 'mercedes benz', mercedesbenz: 'mercedes benz',
    jag: 'jaguar',
    landrover: 'land rover', 'range rover': 'land rover',
    astonmartin: 'aston martin', rollsroyce: 'rolls royce', rolls: 'rolls royce',
    'citro n': 'citroen', koda: 'skoda', alfa: 'alfa romeo',
    harley: 'harley davidson', 'canam': 'can am',
};

function canonicalBrand(value) {
    if (typeof value !== 'string') return null;
    const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim();
    const canonical = ALIASES[key] || key;
    return BRANDS.has(canonical) ? canonical : null;
}

function statsVehicleMeta(vehicle) {
    const name = typeof vehicle.vehicle === 'string' ? vehicle.vehicle : '';
    // Normalize accents before the existing parser strips non-ASCII characters.
    const parsed = extractVehicleMeta(name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const stored = canonicalBrand(vehicle.vehicleBrand);
    const fallback = canonicalBrand(parsed.brand);
    const brandKey = stored || fallback;
    const model = stored && typeof vehicle.vehicleModel === 'string' && vehicle.vehicleModel.trim()
        ? vehicle.vehicleModel : (parsed.model || '');
    return { brandKey, model };
}

module.exports = { statsVehicleMeta, canonicalBrand };
