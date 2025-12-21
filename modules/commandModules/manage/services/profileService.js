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
        sortPreference: 'default',
    });
}

async function clearGarageIcon(userId) {
    await userProfileSchema.updateOne({ userId }, { $set: { garageThumbnail: '' } });
}

async function updateEmbedColor(userId, embedColor) {
    await userProfileSchema.updateOne(
        { userId },
        {
            $set: { embedColor },
            $setOnInsert: {
                premiumUser: false,
                premiumTier: 0,
                garageThumbnail: '',
                verificationBanned: false,
                sortPreference: 'default',
            },
        },
        { upsert: true }
    );
}

async function updateSortPreference(userId, sortPreference) {
    await userProfileSchema.updateOne(
        { userId },
        {
            $set: { sortPreference },
            $setOnInsert: {
                premiumUser: false,
                premiumTier: 0,
                embedColor: '',
                garageThumbnail: '',
                verificationBanned: false,
            },
        },
        { upsert: true }
    );
}

module.exports = {
    findProfile,
    upsertGarageIcon,
    clearGarageIcon,
    updateEmbedColor,
    updateSortPreference,
};
