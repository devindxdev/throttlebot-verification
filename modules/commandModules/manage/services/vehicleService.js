const garageSchema = require('../../../../mongodb_schema/garageSchema.js');
const { extractVehicleMeta } = require('../../../vehicleUtils.js');

/** Updates a vehicle name for the given user/guild tuple. */
async function updateVehicleName({ guildId, userId, currentName, newName }) {
    const vehicleMeta = extractVehicleMeta(newName);
    return garageSchema.updateOne(
        { guildId, userId, vehicle: currentName },
        { $set: { vehicle: newName, vehicleBrand: vehicleMeta.brand, vehicleModel: vehicleMeta.model } }
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

/** Updates vehicle specs for a vehicle. */
async function updateVehicleSpecs({ guildId, userId, vehicleName, specs }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { vehicleSpecs: specs } }
    );
}

/** Clears vehicle specs. */
async function clearVehicleSpecs({ guildId, userId, vehicleName }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { vehicleSpecs: null } }
    );
}

/** Persists the provided image list. */
async function saveVehicleImages({ guildId, userId, vehicleName, images }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { vehicleImages: images } }
    );
}

/** Sets collections array for a vehicle. */
async function setVehicleCollections({ guildId, userId, vehicleName, collections }) {
    return garageSchema.updateOne(
        { guildId, userId, vehicle: vehicleName },
        { $set: { collections } }
    );
}

module.exports = {
    updateVehicleName,
    updateVehicleDescription,
    clearVehicleDescription,
    updateVehicleSpecs,
    clearVehicleSpecs,
    saveVehicleImages,
    setVehicleCollections,
};
