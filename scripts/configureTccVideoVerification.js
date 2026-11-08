require('dotenv').config();
const { MongoClient } = require('mongoose').mongo;
const { databaseName } = require('../modules/verification/connection');

const TCC_GUILD_ID = '438650836512669699';

async function configureTccVideoVerification(db, { apply = false } = {}) {
    const collection = db.collection('guilds');
    const profiles = await collection.find({ guildId: TCC_GUILD_ID }).limit(2).toArray();
    if (profiles.length !== 1) throw new Error('Expected exactly one existing TCC server profile.');
    const profile = profiles[0];
    const update = { $set: { videoVerificationRequired: true } };
    const result = {
        mode: apply ? 'apply' : 'preview',
        guildId: TCC_GUILD_ID,
        current: { videoVerificationRequired: profile.videoVerificationRequired === true },
        proposedUpdate: update,
        modifiedCount: 0,
    };
    if (apply && profile.videoVerificationRequired !== true) {
        const filter = {
            _id: profile._id, guildId: TCC_GUILD_ID,
            videoVerificationRequired: Object.hasOwn(profile, 'videoVerificationRequired')
                ? profile.videoVerificationRequired : { $exists: false },
        };
        const write = await collection.updateOne(filter, { $set: { ...update.$set, updatedAt: new Date() } });
        if (write.matchedCount !== 1) throw new Error('TCC settings changed during preparation; preview again before applying.');
        result.modifiedCount = write.modifiedCount;
    }
    return result;
}

async function main() {
    const apply = process.argv.includes('--apply');
    const useWriter = apply || process.argv.includes('--writer');
    const uri = (useWriter ? process.env.MONGO_WRITE_URI : process.env.MONGO_READONLY_URI) || process.env.MONGOURI || process.env.MONGODB_URI;
    if (!uri) throw new Error('Missing MongoDB connection configuration.');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    try {
        await client.connect();
        console.log(JSON.stringify(await configureTccVideoVerification(client.db(databaseName(uri)), { apply }), null, 2));
    } finally { await client.close(); }
}

if (require.main === module) main().catch(error => {
    console.error(JSON.stringify({ failed: true, errorType: error.name, code: error.code || null }));
    process.exitCode = 1;
});
module.exports = { TCC_GUILD_ID, configureTccVideoVerification };
