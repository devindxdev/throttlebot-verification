const mongoose = require('mongoose');

/**
 * Garage entries for verified vehicles.
 */
const garageSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    vehicle: { type: String, required: true },
    vehicleBrand: { type: String, default: null, index: true },
    vehicleModel: { type: String, default: null },
    vehicleImages: { type: [String], default: [] },
    vehicleDescription: { type: String, default: null },
    vehicleAddedDate: { type: Date, default: Date.now },
    verificationImageLink: { type: String, default: null },
    embedColor: { type: String, default: null },
    estimatedValueUSD: { type: Number, default: null },
    estimatedValueConfidence: { type: Number, default: null },
    estimatedValueUpdatedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'verified vehicles',
  }
);

// Prevent duplicate vehicle names per user per guild
garageSchema.index({ guildId: 1, userId: 1, vehicle: 1 }, { unique: true });

module.exports = mongoose.model('Verified Vehicles', garageSchema);
