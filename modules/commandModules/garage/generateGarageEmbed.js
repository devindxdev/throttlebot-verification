const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');

module.exports = async (interaction, garageData, user, guildProfile) => {
    try {
        const passportEnabled = guildProfile.passportEnabled;
        const passportServerId = guildProfile.passportGuildId;
        const userTag = user.tag;
        const userAvatar = user.displayAvatarURL({ dynamic: true });
        const guildName = interaction.guild.name;
        const embedColor = guildProfile.embedColor || '#0099ff';
        const footerIcon = guildProfile.footerIcon || interaction.guild.iconURL({ dynamic: true });

        const pageSize = 10;
        let page = 1;
        const totalPages = Math.ceil(garageData.length / pageSize);

        const buildVehicleList = () => {
            const startIndex = (page - 1) * pageSize;
            const slice = garageData.slice(startIndex, startIndex + pageSize);
            return slice.map((vehicle, index) => {
                const absoluteIndex = startIndex + index;
                const isPassportVehicle = passportEnabled && vehicle.guildId === passportServerId;
                const imageCount = vehicle.vehicleImages?.length || 0;

                const label =
                    vehicle?.vehicle && vehicle.vehicle.trim().length > 0
                        ? vehicle.vehicle.trim().slice(0, 100)
                        : `Vehicle ${absoluteIndex + 1}`;
                const descriptionText = imageCount > 0
                    ? `${imageCount} image${imageCount === 1 ? '' : 's'} available to view`
                    : 'No images uploaded yet.';

                return {
                    label,
                    description: descriptionText,
                    value: `${absoluteIndex}`,
                    emoji: isPassportVehicle ? '<:TCC:1326753919321243719>' : undefined,
                };
            });
        };

        // Embed content
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${userTag}'s Garage`,
                iconURL: userAvatar,
            })
            .setColor(embedColor)
            .setFooter({
                text: `${guildName} • Vehicle Verification`,
                iconURL: footerIcon,
            });

        // If there are vehicles, generate the embed with dropdown
        if (garageData.length > 0) {
            const buildEmbed = () => {
                const vehicleList = buildVehicleList();
                const startIndex = (page - 1) * pageSize;
                const listText = vehicleList
                    .map((vehicle, index) => `\`${startIndex + index + 1}.\` ${vehicle.label} ${vehicle.emoji || ''}`)
                    .join('\n');

                embed.setDescription(
                    `Select a vehicle from the dropdown menu below to view more details.\n${listText}`
                );
                if (totalPages > 1) {
                    embed.setFooter({
                        text: `${guildName} • Vehicle Verification • Page ${page} of ${totalPages}`,
                        iconURL: footerIcon,
                    });
                } else {
                    embed.setFooter({
                        text: `${guildName} • Vehicle Verification`,
                        iconURL: footerIcon,
                    });
                }
                return embed;
            };

            const buildMenuRow = () => {
                const vehicleList = buildVehicleList();
                return new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('garage_menu')
                        .setPlaceholder('Select a vehicle...')
                        .addOptions(vehicleList)
                );
            };

            const buildNavRow = () =>
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`garagePrev+${interaction.id}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId(`garageNext+${interaction.id}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= totalPages)
                );

            const rows = totalPages > 1 ? [buildMenuRow(), buildNavRow()] : [buildMenuRow()];

            const garageMessage = await interaction.editReply({ embeds: [buildEmbed()], components: rows });

            // Step 3: Set up a collector for dropdown menu interactions (scoped to this message)
            const collector = garageMessage.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000, // Collector active for 60 seconds
                filter: (i) =>
                    i.user.id === interaction.user.id &&
                    i.customId === 'garage_menu' &&
                    i.message.id === garageMessage.id,
            });

            const navCollector = garageMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000,
                filter: (i) =>
                    i.user.id === interaction.user.id &&
                    (i.customId === `garagePrev+${interaction.id}` || i.customId === `garageNext+${interaction.id}`) &&
                    i.message.id === garageMessage.id,
            });

            collector.on('collect', async (menuInteraction) => {
                try {
                    await menuInteraction.deferUpdate();
                    // Get the selected vehicle data
                    const selectedOption = menuInteraction.values[0];
                    const selectedVehicle = garageData[parseInt(selectedOption)];
                    // Check if selected vehicle has images
                    if (!selectedVehicle.vehicleImages || selectedVehicle.vehicleImages.length === 0) {

                        await menuInteraction.followUp({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('No Images Available')
                                    .setDescription(
                                        `The selected vehicle, **${selectedVehicle.vehicle}**, has no images associated with it. Please select another vehicle from the list.`
                                    )
                                    .setColor('#FF6961') // Red for a "warning/error" style
                                    .setFooter({
                                        text: 'Vehicle Verification',
                                        iconURL: menuInteraction.client.user.displayAvatarURL(),
                                    }),
                            ],
                            ephemeral: true,
                        });

                    }

                    // Stop collector and return vehicle data
                    if (!selectedVehicle?.vehicleImages || selectedVehicle.vehicleImages.length === 0) return;

                    collector.stop('selected');
                    navCollector.stop('selected');
                    await require('./garageMenuHandler')(interaction, selectedOption, garageData, user, guildProfile, garageMessage);
                    
                } catch (error) {
                    console.error('Error handling garage menu selection:', error);
                    await menuInteraction.followUp({
                        content: 'An error occurred while processing your selection. Please try again.',
                        ephemeral: true
                    });
                }
            });

            navCollector.on('collect', async (btnInteraction) => {
                await btnInteraction.deferUpdate();
                if (btnInteraction.customId === `garagePrev+${interaction.id}` && page > 1) {
                    page -= 1;
                }
                if (btnInteraction.customId === `garageNext+${interaction.id}` && page < totalPages) {
                    page += 1;
                }
                const updatedRows = totalPages > 1 ? [buildMenuRow(), buildNavRow()] : [buildMenuRow()];
                await garageMessage.edit({
                    embeds: [buildEmbed()],
                    components: updatedRows,
                });
            });

            collector.on('end', async (_collected, reason) => {
                if (reason !== 'time') return; // keep the vehicle view intact when user selects
                try {
                    await garageMessage.edit({
                        embeds: [embed],
                        components: [], // Disable dropdown after timeout
                    });
                } catch (error) {
                    console.error('Error disabling dropdown menu:', error);
                }
            });
        }else{
            // Handle empty garages
            if (passportEnabled) {
                embed.setDescription(
                    `No verified vehicles found for **${userTag}**.\n\nThis server is linked to a [Global Passport server](https://discord.com/invite/cars). Make sure you have verified vehicles in either this server or the [Passport Server](https://discord.com/invite/cars).`
                );
            } else {
                embed.setDescription(
                    `No verified vehicles found for **${userTag}**.\n\nTo get started, verify your vehicles by following the guide in <#${guildProfile.guideChannelId}>.`
                );
            }
            await interaction.editReply({ embeds: [embed], ephemeral: true });
        }
        return { embed, components: [] }; // No dropdown for empty garages
    } catch (error) {
        console.error('Error creating garage embed:', error);
        throw new Error('Failed to create the garage embed.');
    }
};
