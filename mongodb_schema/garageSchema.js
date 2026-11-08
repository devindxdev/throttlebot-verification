const mongoose = require('mongoose');
const { vehicleKey } = require('../modules/verification/vehicleIdentity');

/**
 * Garage entries for verified vehicles.
 */
const garageSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    vehicle: { type: String, required: true },
    vehicleKey: { type: String },
    vehicleBrand: { type: String, default: null, index: true },
    vehicleModel: { type: String, default: null },
    vehicleSpecs: {
      engine: { type: String, default: null },
      horsepower: { type: String, default: null },
      torque: { type: String, default: null },
      drivetrain: { type: String, default: null },
      transmission: { type: String, default: null },
      acceleration: { type: String, default: null },
      powertrain: { type: String, default: null },
      mods: { type: String, default: null },
      year: { type: String, default: null },
      color: { type: String, default: null },
      featuredSpec: { type: String, default: null },
    },
    vehicleImages: { type: [String], default: [] },
    vehicleDescription: { type: String, default: null },
    collections: { type: [String], default: [] },
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

// Legacy records are keyed by the maintenance migration. The partial index can
// be installed immediately without deleting or rewriting legacy garage entries.
garageSchema.index({ guildId: 1, userId: 1, vehicleKey: 1 }, {
    unique: true, partialFilterExpression: { vehicleKey: { $type: 'string' } },
    name: 'unique_owner_vehicle_key',
});
garageSchema.pre('validate', function () { this.vehicleKey = vehicleKey(this.vehicle); });
for (const operation of ['updateOne', 'findOneAndUpdate']) {
    garageSchema.pre(operation, function () {
        const update = this.getUpdate();
        if (update?.$set?.vehicle != null) update.$set.vehicleKey = vehicleKey(update.$set.vehicle);
        else if (update?.vehicle != null) update.vehicleKey = vehicleKey(update.vehicle);
    });
}

module.exports = mongoose.model('Verified Vehicles', garageSchema);
