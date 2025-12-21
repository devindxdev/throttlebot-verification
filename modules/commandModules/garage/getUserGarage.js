const { obtainAllUserVehicles } = require('../../database.js');

module.exports = async (userId, guildProfile) => {
    try {
        const currentServerId = guildProfile.guildId;
        const passportEnabled = guildProfile.passportEnabled; // Check if Global Passport is enabled
        const passportServerId = guildProfile.passportGuildId;

        let currentServerVehicles = [];
        let passportServerVehicles = [];

        // Fetch vehicles from the current server
        currentServerVehicles = (await obtainAllUserVehicles(userId, currentServerId)) || [];

        // If Global Passport is enabled, fetch vehicles from the passport server
        if (passportEnabled && passportServerId) {
            passportServerVehicles = (await obtainAllUserVehicles(userId, passportServerId)) || [];
        }

        // Combine the vehicles from both sources
        const combinedVehicles = [...passportServerVehicles, ...currentServerVehicles];

        return combinedVehicles; // Return the combined garage data (empty array if none)
    } catch (error) {
        console.error('Error fetching user garage:', error);
        throw new Error('Failed to retrieve garage data.'); // Let the caller handle the error
    }
};
