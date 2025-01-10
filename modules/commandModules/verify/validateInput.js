const { errorEmbed } = require('../../utility.js');
const { 
    obtainAllUserVehicles, 
    obtainAllOpenUserApplications 
} = require('../../database.js');

module.exports = async (interaction, vehicleAttachment, vehicleName, initiatorId, guildProfile) => {
    const { 
        verificationChannelId, 
        guideChannelId, 
        loggingChannelId 
    } = guildProfile;

    try {
        // Ensure all necessary channels are configured
        if (!verificationChannelId || !guideChannelId || !loggingChannelId) {
            throw new Error(
                'This server has not been set up properly. Please ask the moderation team to use the `/setup` command.'
            );
        }

        // Validate file size and type
        const { size, contentType, name } = vehicleAttachment;
        
        if (size > 8_000_000) {
            throw new Error('The file size exceeds the 8MB limit.');
        }

        if (contentType && !contentType.includes('image')) {
            throw new Error('The provided file is not a valid image.');
        }

        if (name.toLowerCase().includes('heic')) {
            throw new Error('HEIC images are not supported. Please upload a different format.');
        }

        // Validate vehicle name length
        if (vehicleName.length > 50) {
            throw new Error('Vehicle name is too long. Please keep it under 50 characters.');
        }

        if (vehicleName.length < 2) {
            throw new Error('Vehicle name is too short. Please use at least 2 characters.');
        }

        // Check for existing vehicles in the user's garage
        const userVehicles = await obtainAllUserVehicles(initiatorId, interaction.guild.id);
        if (userVehicles.some((vehicle) => vehicle.vehicle.toLowerCase() === vehicleName.toLowerCase())) {
            throw new Error(
                `You already have a verified vehicle named "${vehicleName}".`
            );
        }

        // Check for open applications with the same vehicle name
        const openApplications = await obtainAllOpenUserApplications(initiatorId, interaction.guild.id);
        if (openApplications.some((app) => app.vehicle.toLowerCase() === vehicleName.toLowerCase())) {
            throw new Error(
                `You already have an open application for "${vehicleName}". Wait for it to be processed or use a different name.`
            );
        }

        return true;

    } catch (err) {
        await interaction.editReply({
            embeds: [errorEmbed(err.message, interaction.user.displayAvatarURL({ dynamic: true }))],
        });
        return false;
    }
};
