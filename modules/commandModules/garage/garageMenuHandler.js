const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

module.exports = async (interaction, selectedOption, userGarage, guildProfile, parentMessage = null) => {
    try {
        // Validate selected option
        const selectedIndex = parseInt(selectedOption);
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= userGarage.length) {
            throw new Error('Invalid vehicle selection.');
        }

        // Fetch the selected vehicle
        const selectedVehicle = userGarage[selectedIndex];
        const { vehicle, vehicleImages, vehicleDescription, vehicleSpecs, guildId, collections = [] } = selectedVehicle;

        // Check if the vehicle is from the Passport Server
        const isPassportVehicle = guildProfile.passportEnabled && guildId === guildProfile.passportGuildId;
        const footerIconUrl = guildProfile.footerIcon || interaction.client.user.displayAvatarURL();
        const guildDisplayName = interaction.guild?.name || guildProfile.guildName || 'Vehicle Verification';

        // Build collection display
        const collectionEmojis = {
            track: '<:yellow:1465988323293134870>',
            project: '<:blurpleIndicator:976067465471721532>',
            daily: '<:green:1465988391404310773>',
            sold: '<:red:1465988285959639207>',
        };
        const collectionLabels = {
            track: 'Track',
            project: 'Project',
            daily: 'Daily',
            sold: 'Sold',
        };
        const collectionSuffix =
            collections && collections.length
                ? ` - ${collections.map((c) => collectionLabels[c] || c).join(' / ')}`
                : '';

        // Build the vehicle embed
        const soldSuffix = ''; // suffix handled by collectionSuffix
        const vehicleEmbed = new EmbedBuilder()
            .setAuthor({
                name: `${vehicle}${collectionSuffix}${soldSuffix}${isPassportVehicle ? ' - Global Passport Vehicle' : ''}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            })
            .setColor(guildProfile.embedColor || '#0099ff')
            .setFooter({
                text: `${guildProfile.guildName} ${isPassportVehicle ? '• Global Passport Vehicle' : ''}`,
                iconURL: guildProfile.footerIcon || interaction.client.user.displayAvatarURL(),
            });

        // Add specs + notes
        const specs = vehicleSpecs || null;
        if (specs) {
            const specFields = [];
            if (specs.engine) specFields.push({ name: 'Engine', value: specs.engine, inline: false });
            if (specs.horsepower) specFields.push({ name: 'Horsepower', value: specs.horsepower, inline: true });
            if (specs.torque) specFields.push({ name: 'Torque', value: specs.torque, inline: true });
            if (specs.drivetrain) specFields.push({ name: 'Drivetrain', value: specs.drivetrain, inline: true });
            if (specs.transmission) specFields.push({ name: 'Transmission', value: specs.transmission, inline: true });
            if (specs.acceleration) specFields.push({ name: 'Acceleration', value: specs.acceleration, inline: true });
            if (specs.year) specFields.push({ name: 'Year', value: specs.year, inline: true });
            if (specs.color) specFields.push({ name: 'Color', value: specs.color, inline: true });
            if (specs.powertrain) specFields.push({ name: 'Powertrain', value: specs.powertrain, inline: false });
            if (specs.mods) specFields.push({ name: 'Mods', value: specs.mods, inline: false });

            vehicleEmbed.addFields(specFields.length ? specFields : [{ name: 'Vehicle Specs', value: 'No specs set.' }]);
        } else if (vehicleDescription) {
            vehicleEmbed.setDescription(vehicleDescription);
        }

        // Handle images
        const componentRows = [];

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
            const replyMessage = await interaction.editReply({
                embeds: [vehicleEmbed],
                components: vehicleImages.length > 1 ? [...componentRows, row] : componentRows,
            });

            // Only create collector if there are multiple images
            if (vehicleImages.length > 1) {
                // Create a collector for button interactions directly from the message
                const collector = replyMessage.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 600000, // 10 minutes
                    filter: (btnInteraction) =>
                        btnInteraction.user.id === interaction.user.id &&
                        btnInteraction.message.id === replyMessage.id,
                });

                collector.on('collect', async (buttonInteraction) => {
                    try {
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

                        // Update the message
                        await buttonInteraction.update({
                            embeds: [vehicleEmbed],
                            components: [...componentRows, row],
                        });
                    } catch (err) {
                        console.error('Error updating garage navigation:', err);
                        // Attempt to respond to the interaction if it hasn't been responded to
                        if (!buttonInteraction.replied && !buttonInteraction.deferred) {
                            await buttonInteraction.reply({
                                content: 'An error occurred while navigating. Please try again.',
                                ephemeral: true
                            }).catch(console.error);
                        }
                    }
                });

                collector.on('end', async () => {
                    try {
                        // Disable buttons when collector ends
                        row.components.forEach((button) => button.setDisabled(true));
                        await interaction.editReply({
                            embeds: [vehicleEmbed],
                            components: [...componentRows, row],
                        }).catch(console.error);
                    } catch (err) {
                        console.error('Error disabling buttons on collector end:', err);
                    }
                });
            }
        } else {
            // If no images are available
            if (!vehicleSpecs && vehicleDescription) {
                vehicleEmbed.setDescription(vehicleDescription);
            }
            if (!vehicleEmbed.data.description) {
                vehicleEmbed.setDescription('No images available for this vehicle.');
            }
            await interaction.editReply({
                embeds: [vehicleEmbed],
                components: componentRows,
            });
        }
    } catch (error) {
        console.error('Error handling garage menu:', error);
        
        // Check if we can still respond to the interaction
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error displaying the selected vehicle. Please try again.',
                components: [],
                ephemeral: true,
            }).catch(console.error);
        } else {
            await interaction.followUp({
                content: 'There was an error displaying the selected vehicle. Please try again.',
                components: [],
                ephemeral: true,
            }).catch(console.error);
        }
    }
};
