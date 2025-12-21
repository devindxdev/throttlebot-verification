const mongoose = require('mongoose');

/**
 * Per-user profile data (premium status, preferences).
 */
const profileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, unique: true },
    premiumUser: { type: Boolean, default: false },
    premiumTier: { type: Number, default: 0, min: 0 },
    embedColor: { type: String, default: '' },
    garageThumbnail: { type: String, default: '' },
    verificationBanned: { type: Boolean, default: false },
    sortPreference: { type: String, default: 'default', enum: ['default', 'year-asc', 'year-desc'] },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'users',
  }
);

module.exports = mongoose.model('Users', profileSchema);
