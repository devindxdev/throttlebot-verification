const mongoose = require('mongoose');
const Verification = require('../../mongodb_schema/verificationApplicationSchema');
const Garage = require('../../mongodb_schema/garageSchema');
const User = require('../../mongodb_schema/userProfileSchema');
const { resolveBrandFields } = require('../vehicleUtils');
const { vehicleKey, vehicleFilter } = require('./vehicleIdentity');
const { isExpired, expiredFilter } = require('./expiry');

async function ensureGarage(application, session) {
    const filter = vehicleFilter(application);
    const existing = await Garage.findOne(filter).session(session);
    const meta = resolveBrandFields({ vehicleName: application.vehicle, vehicleBrand: application.vehicleBrand, vehicleModel: application.vehicleModel });
    if (existing) {
        await Garage.updateOne({ _id: existing._id }, { $set: {
            vehicleKey: vehicleKey(existing.vehicle),
            vehicleBrand: existing.vehicleBrand || meta.brand,
            vehicleModel: existing.vehicleModel || meta.model,
        } }, { session });
    } else {
        await Garage.create([{
            guildId: application.guildId, userId: application.userId, vehicle: application.vehicle,
            vehicleKey: vehicleKey(application.vehicle), vehicleBrand: meta.brand, vehicleModel: meta.model,
            vehicleAddedDate: new Date(), verificationImageLink: application.vehicleImageURL,
        }], { session });
    }
    await User.updateOne({ userId: application.userId }, { $setOnInsert: { userId: application.userId } }, { upsert: true, session });
}

/** Commit the final decision and its database effects together; Discord effects run afterwards. */
async function commitDecision(application, changes, effect = null) {
    if (!['open', 'auto-approved', 'auto-denied'].includes(application.status)) {
        throw new Error('This application has already been processed.');
    }
    if (isExpired(application)) throw new Error('This application is older than 30 days and has expired.');
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const filter = { _id: application._id, guildId: application.guildId, status: application.status };
            // Recheck expiry atomically, including when a modal has remained open.
            if (application.status === 'open') filter.$nor = [expiredFilter()];
            const updated = await Verification.findOneAndUpdate(filter, { $set: changes }, { new: true, session, runValidators: true });
            if (!updated) throw new Error('This application was already processed or has expired.');
            if (effect === 'approve') await ensureGarage(application, session);
            if (effect === 'remove') await Garage.deleteMany(vehicleFilter(application), { session });
            if (effect === 'ban') await User.updateOne({ userId: application.userId }, {
                $set: { verificationBanned: true }, $setOnInsert: { userId: application.userId },
            }, { upsert: true, session });
        });
    } finally { await session.endSession(); }
}

/** Save an AI approval and garage atomically before posting the Discord review message. */
async function createAutoApproval(application) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await Verification.create([application], { session });
            await ensureGarage(application, session);
        });
    } finally { await session.endSession(); }
}

module.exports = { commitDecision, createAutoApproval, ensureGarage };
