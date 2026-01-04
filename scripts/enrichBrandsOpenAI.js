require('dotenv').config();
const mongoose = require('mongoose');
const OpenAI = require('openai');
const Garage = require('../mongodb_schema/garageSchema');
const { normalizeBrand, isValidBrandKey, extractVehicleMeta } = require('../modules/vehicleUtils');

const MONGO_URI = process.env.MONGOURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.API_KEY;
const MODEL = process.env.OPENAI_BRAND_MODEL || 'gpt-4o-mini';
const BATCH_LIMIT = process.env.BRAND_ENRICH_LIMIT ? Number(process.env.BRAND_ENRICH_LIMIT) : Infinity; // default: all
const RESUME_ID = '629a2258b01dc242709d30af';
const BATCH_SIZE = process.env.BRAND_ENRICH_BATCH ? Number(process.env.BRAND_ENRICH_BATCH) : 200;
const client = new OpenAI({ apiKey: OPENAI_KEY });

const BRAND_ALIASES = {
    chevy: 'chevrolet',
    chev: 'chevrolet',
    chevrolet: 'chevrolet',
    benz: 'mercedes benz',
    mercedesbenz: 'mercedes benz',
    mercedes: 'mercedes benz',
    merc: 'mercedes benz',
    mb: 'mercedes benz',
    vw: 'volkswagen',
    volkswagen: 'volkswagen',
    jag: 'jaguar',
    bmw: 'bmw',
    ford: 'ford',
    toyota: 'toyota',
    honda: 'honda',
    hyundai: 'hyundai',
    kia: 'kia',
    lexus: 'lexus',
    acura: 'acura',
    audi: 'audi',
    subaru: 'subaru',
    nissan: 'nissan',
    infiniti: 'infiniti',
    mazda: 'mazda',
    dodge: 'dodge',
    ram: 'ram',
    chrysler: 'chrysler',
    jeep: 'jeep',
    gmc: 'gmc',
    pontiac: 'pontiac',
    cadillac: 'cadillac',
    buick: 'buick',
    lincoln: 'lincoln',
    volvo: 'volvo',
    polestar: 'polestar',
    porsche: 'porsche',
    ferrari: 'ferrari',
    lamborghini: 'lamborghini',
    astonmartin: 'aston martin',
    landrover: 'land rover',
    range: 'range rover',
    'range rover': 'range rover',
    rover: 'land rover',
    mini: 'mini',
    mitsubishi: 'mitsubishi',
    maserati: 'maserati',
    rollsroyce: 'rolls royce',
    rolls: 'rolls royce',
    tesla: 'tesla',
};

// Known model-to-brand hints when the brand is missing from the name.
const MODEL_BRAND_HINTS = [
    [/miata|mx-?5/, 'mazda'],
    [/mustang/, 'ford'],
    [/corvette|c8|c7|c6|c5/, 'chevrolet'],
    [/(^|\\b)c10\\b|(^|\\b)c-10\\b/, 'chevrolet'],
    [/(^|\\b)s10\\b|(^|\\b)s-10\\b/, 'chevrolet'],
    [/camaro/, 'chevrolet'],
    [/silverado/, 'chevrolet'],
    [/tahoe|suburban/, 'chevrolet'],
    [/wrx|impreza|forester|outback/, 'subaru'],
    [/sti\\b/, 'subaru'],
    [/civic|accord|fit|pilot|ridgeline|type r/, 'honda'],
    [/camry|corolla|tacoma|supra|4runner|land cruiser/, 'toyota'],
    [/gtr|gt-r|skyline|silvia|350z|370z|240sx|sentra|altima/, 'nissan'],
    [/challenger|charger|viper/, 'dodge'],
    [/ram\\b|1500\\b|2500\\b|3500\\b/, 'ram'],
    [/f-?150|f-?250|f-?350|bronco|raptor/, 'ford'],
    [/golf|jetta|passat|tiguan|touareg/, 'volkswagen'],
    [/a3\\b|a4\\b|a5\\b|a6\\b|a7\\b|a8\\b|q5\\b|q7\\b|q8\\b|rs\\b/, 'audi'],
    [/c63\\b|amg|g-wagon|g\\s*class|gle|glc|e63/, 'mercedes benz'],
    [/m3\\b|m4\\b|m5\\b|m2\\b|m8\\b|x5m|x6m|x3m|x4m|x5|x3|x6|x7/, 'bmw'],
];

if (!MONGO_URI) {
    console.error('Missing Mongo connection string (MONGOURI / MONGODB_URI / DATABASE_URL).');
    process.exit(1);
}
if (!OPENAI_KEY) {
    console.error('Missing OpenAI API key (OPENAI_API_KEY / API_KEY).');
    process.exit(1);
}

function buildPrompt(vehicleName) {
    return `You are cleaning vehicle names. Return STRICT JSON with fields: brand (lowercase string), model (string, may be null), corrected (string full cleaned name). Use known vehicle brands. If the brand is missing in the text, infer the most likely brand from the model name. If you cannot confidently identify the brand, set brand to null and model to null.
Input: "${vehicleName}"`;
}

async function enrichOne(name) {
    try {
        const res = await client.chat.completions.create({
            model: MODEL,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'Respond ONLY with JSON: {"brand": string|null, "model": string|null, "corrected": string|null}' },
                { role: 'user', content: buildPrompt(name) },
            ],
        });
        const raw = res.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        return {
            brand: parsed.brand ? normalizeBrand(parsed.brand) : null,
            model: parsed.model ? String(parsed.model).trim() : null,
            corrected: parsed.corrected ? String(parsed.corrected).trim() : null,
        };
    } catch (err) {
        console.error('OpenAI error for name:', name, err.message);
        return { brand: null, model: null, corrected: null };
    }
}

function canonicalBrand(brand) {
    const norm = normalizeBrand(brand);
    if (!norm) return null;
    const cleaned = norm.replace(/\s+/g, '');
    return BRAND_ALIASES[cleaned] || BRAND_ALIASES[norm] || norm;
}

function inferBrandFromModel(name) {
    if (!name) return null;
    const n = String(name).toLowerCase();
    for (const [regex, brand] of MODEL_BRAND_HINTS) {
        if (regex.test(n)) return canonicalBrand(brand);
    }
    return null;
}

async function processCollection(Model, label) {
    const query = {};
    if (RESUME_ID) {
        try {
            query._id = { $gt: new mongoose.Types.ObjectId(RESUME_ID) };
            console.log(`[${label}] Resuming from _id > ${RESUME_ID}`);
        } catch {
            console.warn(`[${label}] Invalid BRAND_ENRICH_RESUME_ID, ignoring.`);
        }
    }

    const cursor = Model.find(query).sort({ _id: 1 }).cursor({ batchSize: BATCH_SIZE });
    let seen = 0;
    let updated = 0;
    for await (const doc of cursor) {
        if (seen >= BATCH_LIMIT) break;
        seen += 1;

        const enriched = await enrichOne(doc.vehicle);
        const parsed = extractVehicleMeta(doc.vehicle);
        const existing = canonicalBrand(doc.vehicleBrand);
        const aiBrand = canonicalBrand(enriched.brand);
        const parsedBrand = canonicalBrand(parsed.brand);
        const inferredBrand = inferBrandFromModel(enriched.corrected || doc.vehicle || parsed.model);

        const brandCandidate = [aiBrand, parsedBrand, inferredBrand, existing].find((b) => isValidBrandKey(b)) || null;
        const modelCandidate = enriched.model || parsed.model || doc.vehicleModel;

        const brandChanged = brandCandidate !== (existing || null) || doc.vehicleBrand !== brandCandidate;
        const modelChanged = modelCandidate && modelCandidate !== doc.vehicleModel;

        if (brandChanged || modelChanged) {
            const prevBrand = doc.vehicleBrand || null;
            const prevModel = doc.vehicleModel || null;
            if (brandChanged) doc.vehicleBrand = brandCandidate;
            if (modelChanged) doc.vehicleModel = modelCandidate;
            console.log(
                `[${label}] update ${doc._id}: "${doc.vehicle}" | brand ${prevBrand || '-'} -> ${brandCandidate || '-'} | model ${prevModel || '-'} -> ${modelCandidate || '-'}`
            );
        }

        if (brandChanged || modelChanged) {
            await doc.save();
            updated += 1;
        }

        if (seen % 25 === 0) {
            console.log(`[${label}] processed ${seen}, updated ${updated}`);
        }
    }
    console.log(`[${label}] done. processed ${seen}, updated ${updated}`);
}

async function main() {
    console.log('Connecting to Mongo...');
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected.');
    try {
        await processCollection(Garage, 'garage');
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Enrichment failed:', err);
        process.exit(1);
    });
}
