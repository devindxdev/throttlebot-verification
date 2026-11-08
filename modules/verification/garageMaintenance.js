const { vehicleKey } = require('./vehicleIdentity');

function duplicateGroups(documents) {
    const groups = new Map();
    for (const doc of documents) {
        const key = JSON.stringify([doc.guildId, doc.userId, vehicleKey(doc.vehicle)]);
        const bucket = groups.get(key) || [];
        bucket.push(doc); groups.set(key, bucket);
    }
    return [...groups.values()].filter(group => group.length > 1);
}

function mergeGarageDocuments(documents) {
    const chronological = [...documents].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    const keeper = chronological[0];
    const newest = [...documents].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const merged = { ...keeper, vehicleKey: vehicleKey(keeper.vehicle) };
    for (const field of ['vehicleBrand', 'vehicleModel', 'vehicleDescription', 'embedColor', 'verificationImageLink', 'estimatedValueUSD', 'estimatedValueConfidence', 'estimatedValueUpdatedAt']) {
        const source = newest.find(doc => doc[field] != null && doc[field] !== '');
        if (source) merged[field] = source[field];
    }
    merged.vehicleImages = [...new Set(documents.flatMap(doc => doc.vehicleImages || []))];
    merged.collections = [...new Set(documents.flatMap(doc => doc.collections || []))];
    const specNames = new Set(documents.flatMap(doc => Object.keys(doc.vehicleSpecs || {})));
    merged.vehicleSpecs = {};
    for (const name of specNames) {
        const source = newest.find(doc => doc.vehicleSpecs?.[name] != null && doc.vehicleSpecs[name] !== '');
        merged.vehicleSpecs[name] = source?.vehicleSpecs[name] ?? null;
    }
    return { keeper, merged, removed: chronological.slice(1) };
}

async function migrateGarages(db, client, { apply = false } = {}) {
    const collection = db.collection('verified vehicles');
    const documents = await collection.find({}).toArray();
    const groups = duplicateGroups(documents);
    const missingKeys = documents.filter(doc => doc.vehicleKey !== vehicleKey(doc.vehicle)).length;
    const summary = { records: documents.length, duplicateGroups: groups.length,
        redundantRecords: groups.reduce((sum, group) => sum + group.length - 1, 0), missingKeys, applied: false };
    if (!apply) return summary;

    // The partial index protects new records while legacy entries are migrated.
    await collection.createIndex({ guildId: 1, userId: 1, vehicleKey: 1 }, {
        unique: true, name: 'unique_owner_vehicle_key', partialFilterExpression: { vehicleKey: { $type: 'string' } },
    });
    for (const group of groups) {
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                // Reread within the transaction; concurrent edits cause a retry.
                const current = await collection.find({ _id: { $in: group.map(doc => doc._id) } }, { session }).toArray();
                if (current.length < 2) return;
                if (duplicateGroups(current).length !== 1) throw new Error('Duplicate group changed; rerun maintenance.');
                const { keeper, merged, removed } = mergeGarageDocuments(current);
                // Archive EVERY original, including the retained record, before merging.
                const archivedAt = new Date();
                await db.collection('garage duplicate archive').insertMany(current.map(original => ({
                    originalId: original._id, retainedId: keeper._id, archivedAt, original,
                })), { session });
                await collection.deleteMany({ _id: { $in: removed.map(doc => doc._id) } }, { session });
                await collection.replaceOne({ _id: keeper._id }, { ...merged, updatedAt: archivedAt }, { session });
            });
        } finally { await session.endSession(); }
    }
    const remaining = await collection.find({}, { projection: { _id: 1, vehicle: 1, vehicleKey: 1 } }).toArray();
    const operations = remaining.filter(doc => doc.vehicleKey !== vehicleKey(doc.vehicle)).map(doc => ({
        updateOne: { filter: { _id: doc._id, vehicle: doc.vehicle }, update: { $set: { vehicleKey: vehicleKey(doc.vehicle) } } },
    }));
    if (operations.length) await collection.bulkWrite(operations, { ordered: true });
    summary.applied = true;
    return summary;
}

module.exports = { duplicateGroups, mergeGarageDocuments, migrateGarages };
