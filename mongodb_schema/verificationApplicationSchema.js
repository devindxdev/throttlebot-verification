const mongoose = require('mongoose');

/**
 * Verification application records with decision tracking.
 */
const verificationApplication = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    vehicle: { type: String, required: true },
    vehicleImageURL: { type: String, default: null },
    vehicleImageProxyURL: { type: String, default: null },
    vehicleImageName: { type: String, default: null },
    status: {
      type: String,
      enum: ['open', 'closed', 'auto-approved', 'auto-denied'],
      required: true,
      default: 'open',
      index: true,
    },
    submittedOn: { type: Date, default: Date.now },
    applicationMessageId: { type: String, required: true, index: true },
    decision: { type: String, default: null },
    decidedBy: { type: String, default: null },
    decidedOn: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'verification applications',
  }
);

verificationApplication.index({ guildId: 1, userId: 1, vehicle: 1, status: 1 });

module.exports = mongoose.model('Verification Applications', verificationApplication);
