const mongoose = require('mongoose');
const userProfileSchema = require('../../../../mongodb_schema/userProfileSchema.js');

/** Retrieves a lean user profile for the given userId. */
async function findProfile(userId) {
    return userProfileSchema.findOne({ userId }).lean();
}

async function upsertGarageIcon(userId, iconUrl) {
    const existing = await userProfileSchema.findOne({ userId });
    if (existing) {
        await userProfileSchema.updateOne({ userId }, { $set: { garageThumbnail: iconUrl } });
        return;
    }

    await userProfileSchema.create({
        _id: new mongoose.Types.ObjectId(),
        userId,
        premiumUser: false,
        premiumTier: 0,
        embedColor: null,
        garageThumbnail: iconUrl,
    });
}

async function clearGarageIcon(userId) {
    await userProfileSchema.updateOne({ userId }, { $set: { garageThumbnail: '' } });
}

async function updateEmbedColor(userId, embedColor) {
    await userProfileSchema.updateOne(
        { userId },
        { $set: { embedColor } },
        { upsert: true }
    );
}

module.exports = {
    findProfile,
    upsertGarageIcon,
    clearGarageIcon,
    updateEmbedColor,
};
