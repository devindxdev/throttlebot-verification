const mongoose = require('mongoose');

const guildSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  guildId: String,
  guideChannelId: String,
  verificationChannelId: String,
  loggingChannelId: String,
  verifiedVehicleRoleId: String,
  addedOn: String,
  customFooterIcon: String,
  passportEnabled: Boolean,
  passportGuildId: String,
});

module.exports = mongoose.model("Guilds", guildSchema); 