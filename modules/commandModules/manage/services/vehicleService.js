const garageSchema = require('../../../../mongodb_schema/garageSchema.js');

/** Updates a vehicle name for the given user/guild tuple. */
async function updateVehicleName({ guildId, userId, currentName, newName }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: currentName },
        { $set: { vehicle: newName } }
    );
}

/** Updates the description for a vehicle. */
async function updateVehicleDescription({ guildId, userId, vehicleName, description }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { vehicleDescription: description } }
    );
}

/** Clears the description for a vehicle. */
async function clearVehicleDescription({ guildId, userId, vehicleName }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { vehicleDescription: null } }
    );
}

/** Persists the provided image list. */
async function saveVehicleImages({ guildId, userId, vehicleName, images }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { vehicleImages: images } }
    );
}

module.exports = {
    updateVehicleName,
    updateVehicleDescription,
    clearVehicleDescription,
    saveVehicleImages,
};
