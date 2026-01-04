require('dotenv').config();
const mongoose = require('mongoose');
const Verification = require('../mongodb_schema/verificationApplicationSchema');
const Garage = require('../mongodb_schema/garageSchema');
const { resolveBrandFields, normalizeBrand, isValidBrandKey, extractVehicleMeta } = require('../modules/vehicleUtils');

const MONGO_URI = process.env.MONGOURI || process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGO_URI) {
    console.error('Missing Mongo connection string (MONGOURI / MONGODB_URI / DATABASE_URL).');
    process.exit(1);
}

async function backfillBrands(Model, label) {
    const cursor = Model.find({}).cursor();

    let seen = 0;
    let updated = 0;

    for await (const doc of cursor) {
        seen += 1;
        // Force re-derive from vehicle name; fall back to existing only if parsed brand is unusable.
        const parsed = extractVehicleMeta(doc.vehicle);
        const parsedBrandKey = parsed.brandKey;

        const existingKey = normalizeBrand(doc.vehicleBrand);
        const existingValid = isValidBrandKey(existingKey);

        const nextBrand = parsedBrandKey ? parsed.brand : (existingValid ? normalizeBrand(doc.vehicleBrand) : null);
        const nextModel = parsedBrandKey ? parsed.model : (doc.vehicleModel || parsed.model);

        const brandChanged = nextBrand !== doc.vehicleBrand;
        const modelChanged = nextModel !== doc.vehicleModel;

        if (brandChanged) doc.vehicleBrand = nextBrand;
        if (modelChanged) doc.vehicleModel = nextModel;

        if (brandChanged || modelChanged) {
            await doc.save();
            updated += 1;
        }

        if (seen % 500 === 0) {
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
        await backfillBrands(Verification, 'verifications');
        await backfillBrands(Garage, 'garage');
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
