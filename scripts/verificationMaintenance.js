require('dotenv').config();
const { MongoClient } = require('mongoose').mongo;
const { migrateGarages } = require('../modules/verification/garageMaintenance');
const { expiredFilter } = require('../modules/verification/expiry');
const { databaseName } = require('../modules/verification/connection');

async function main() {
    const apply = process.argv.includes('--apply');
    const useWriter = apply || process.argv.includes('--writer');
    const uri = (useWriter ? process.env.MONGO_WRITE_URI : process.env.MONGO_READONLY_URI) || process.env.MONGOURI || process.env.MONGODB_URI;
    if (!uri) throw new Error('Missing MongoDB connection configuration.');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    try {
        await client.connect();
        const db = client.db(databaseName(uri));
        const now = new Date();
        const applications = db.collection('verification applications');
        const expired = await applications.countDocuments(expiredFilter(now));
        const garage = await migrateGarages(db, client, { apply });
        let closed = 0;
        if (apply) {
            const result = await applications.updateMany(expiredFilter(now), { $set: {
                status: 'closed', decision: 'expired', decidedBy: 'system-expiry', decidedOn: now,
                closureReason: 'Application automatically closed after 30 days without a decision.',
            } });
            closed = result.modifiedCount;
        }
        console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', garage, expiredApplications: expired, closedApplications: closed }, null, 2));
    } finally { await client.close(); }
}

if (require.main === module) main().catch(error => {
    // Never print the URI or credentials in diagnostics.
    console.error(JSON.stringify({ failed: true, errorType: error.name, code: error.code || null }));
    process.exitCode = 1;
});
module.exports = { main };
