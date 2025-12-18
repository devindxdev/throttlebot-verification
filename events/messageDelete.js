const garageSchema = require('../mongodb_schema/garageSchema.js');

module.exports = {
    name: 'messageDelete',
    once: false,
    /**
     * Executes when a message is deleted.
     * @param {import('discord.js').Message} message - The deleted message object.
     */
    async execute(message) {
        try {
            // Check for an attachment in the deleted message
            const attachment = message.attachments.first();
            const attachmentURL = attachment?.url;

            if (!attachmentURL) return;

            // Search the database for entries containing the deleted attachment URL
            const data = await garageSchema.find({ vehicleImages: attachmentURL });
            if (data?.length > 0) {
                const vehicleData = data[0];
                const { userId, guildId, vehicle, vehicleImages } = vehicleData;

                const deletedImageURL = attachmentURL;
                const errorImage = 'https://cdn.discordapp.com/attachments/975485952325726278/995130454502023188/Error_1.png';

                // Replace the deleted image with an error image in the vehicleImages array
                const updatedVehicleImages = vehicleImages.map(image =>
                    image === deletedImageURL ? errorImage : image
                );

                // Update the database with the modified images
                await garageSchema.updateOne(
                    { vehicle, guildId, userId },
                    { $set: { vehicleImages: updatedVehicleImages } }
                );

            }
        } catch (error) {
            console.error(`Error in messageDelete event: ${error.message}`);
        }
    },
};
