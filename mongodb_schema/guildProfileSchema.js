const mongoose = require('mongoose');

/**
 * Guild-level configuration for verification and garage features.
 * Uses explicit collection name to avoid accidental changes across refactors.
 */
const guildSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true, unique: true },
    guideChannelId: { type: String, default: null },
    verificationChannelId: { type: String, default: null },
    loggingChannelId: { type: String, default: null },
    verifiedVehicleRoleId: { type: String, default: null },
    customFooterIcon: { type: String, default: null },
    passportEnabled: { type: Boolean, default: false },
    passportGuildId: { type: String, default: null },
    geminiAnalysisEnabled: { type: Boolean, default: false },
    addedOn: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'guilds',
  }
);

module.exports = mongoose.model('Guilds', guildSchema);
