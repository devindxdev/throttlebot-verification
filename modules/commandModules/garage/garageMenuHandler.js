const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

module.exports = async (interaction, selectedOption, userGarage, guildProfile) => {
    try {
        // Validate selected option
        const selectedIndex = parseInt(selectedOption);
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= userGarage.length) {
            throw new Error('Invalid vehicle selection.');
        }

        // Fetch the selected vehicle
        const selectedVehicle = userGarage[selectedIndex];
        const { vehicle, vehicleImages, vehicleDescription, guildId } = selectedVehicle;

        // Check if the vehicle is from the Passport Server
        const isPassportVehicle = guildProfile.passportEnabled && guildId === guildProfile.passportGuildId;
        const footerIconUrl = guildProfile.footerIcon || interaction.client.user.displayAvatarURL();
        const guildDisplayName = interaction.guild?.name || guildProfile.guildName || 'Vehicle Verification';

        // Build the vehicle embed
        const vehicleEmbed = new EmbedBuilder()
            .setAuthor({
                name: `${vehicle} - ${isPassportVehicle ? 'Global Passport Vehicle' : 'Verified Vehicle'}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setColor(guildProfile.embedColor || '#0099ff')
            .setFooter({
                text: `${guildProfile.guildName} ${isPassportVehicle ? '• Global Passport Vehicle' : ''}`,
                iconURL: guildProfile.footerIcon || interaction.client.user.displayAvatarURL(),
            });

        // Add description, if available
        if (vehicleDescription) {
            vehicleEmbed.setDescription(vehicleDescription);
        }

        // Handle images
        if (vehicleImages && vehicleImages.length > 0) {
            let currentPage = 0;
            vehicleEmbed
                .setImage(vehicleImages[currentPage])
                .setFooter({
                    text: `${guildDisplayName} • Image 1 of ${vehicleImages.length}`,
                    iconURL: footerIconUrl,
                });

            // Create navigation buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('previousImage')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('nextImage')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(vehicleImages.length === 1) // Disable if only one image
            );

            // Send the initial embed with buttons
            await interaction.editReply({
                embeds: [vehicleEmbed],
                components: vehicleImages.length > 1 ? [row] : [],
            });

            // Create a collector for button interactions
            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 600000, // 10 minutes
                filter: (i) => i.user.id === interaction.user.id,
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.customId === 'nextImage') {
                    currentPage = (currentPage + 1) % vehicleImages.length;
                } else if (buttonInteraction.customId === 'previousImage') {
                    currentPage = (currentPage - 1 + vehicleImages.length) % vehicleImages.length;
                }

                // Update embed with the new image
                vehicleEmbed.setImage(vehicleImages[currentPage]).setFooter({
                    text: `${guildDisplayName} • Image ${currentPage + 1} of ${vehicleImages.length}`,
                    iconURL: footerIconUrl,
                });

                // Update button states
                row.components[0].setDisabled(currentPage === 0); // Disable 'Previous' on first image
                row.components[1].setDisabled(currentPage === vehicleImages.length - 1); // Disable 'Next' on last image

                // Update the interaction
                await buttonInteraction.update({
                    embeds: [vehicleEmbed],
                    components: [row],
                });
            });

            collector.on('end', async () => {
                // Disable buttons when collector ends
                row.components.forEach((button) => button.setDisabled(true));
                await interaction.editReply({
                    embeds: [vehicleEmbed],
                    components: [row],
                });
            });
        } else {
            // If no images are available
            vehicleEmbed.setDescription(vehicleDescription || 'No images available for this vehicle.');
            await interaction.editReply({
                embeds: [vehicleEmbed],
                components: [],
            });
        }
    } catch (error) {
        console.error('Error handling garage menu:', error);
        await interaction.followUp({
            content: 'There was an error displaying the selected vehicle. Please try again.',
            components: [],
            ephemeral: true,
        });
    }
};
