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
        let currentFilter = 'all';

        const collectionEmojiMap = {
            track: { id: '1465988323293134870', name: 'yellow' },
            project: { id: '976067465471721532', name: 'blurpleIndicator' },
            daily: { id: '1465988391404310773', name: 'green' },
            sold: { id: '1465988285959639207', name: 'red' },
        };
        const emojiDisplay = (key) => {
            const e = collectionEmojiMap[key];
            return e ? `<:${e.name}:${e.id}>` : '';
        };

        const filteredGarage = () => {
            if (currentFilter === 'all') return garageData;
            return garageData.filter((v) => Array.isArray(v.collections) && v.collections.includes(currentFilter));
        };

        const buildVehicleList = () => {
            const data = filteredGarage();
            const startIndex = (page - 1) * pageSize;
            const slice = data.slice(startIndex, startIndex + pageSize);
            return slice.map((vehicle, index) => {
                const absoluteIndex = startIndex + index;
                const isPassportVehicle = passportEnabled && vehicle.guildId === passportServerId;
                const imageCount = vehicle.vehicleImages?.length || 0;
                const collectionBadges = (vehicle.collections || []).map((c) => emojiDisplay(c)).filter(Boolean);

                const baseLabel =
                    vehicle?.vehicle && vehicle.vehicle.trim().length > 0
                        ? vehicle.vehicle.trim().slice(0, 100)
                        : `Vehicle ${absoluteIndex + 1}`;
                const label = baseLabel;
                const descriptionText = imageCount > 0
                    ? `${imageCount} image${imageCount === 1 ? '' : 's'} available to view`
                    : 'No images uploaded yet.';

                // Use first collection emoji for the select option, otherwise passport indicator if present
                const optionEmoji =
                    collectionBadges.length > 0
                        ? { id: collectionEmojiMap[vehicle.collections[0]]?.id, name: collectionEmojiMap[vehicle.collections[0]]?.name }
                        : isPassportVehicle
                        ? { id: '1326753919321243719', name: 'TCC' }
                        : undefined;

                return {
                    label,
                    description: descriptionText,
                    value: `${absoluteIndex}`,
                    emoji: optionEmoji,
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
                    .map((vehicle, index) => `\`${startIndex + index + 1}.\` ${vehicle.label}`)
                    .join('\n');

                embed.setDescription(
                    `Select a vehicle from the dropdown menu below to view more details.\n${listText}`
                );
                const pageCount = Math.max(1, Math.ceil(filteredGarage().length / pageSize));
                if (pageCount > 1) {
                    embed.setFooter({
                        text: `${guildName} • Vehicle Verification • Page ${page} of ${pageCount}`,
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

            const buildNavRow = () => {
                const pageCount = Math.max(1, Math.ceil(filteredGarage().length / pageSize));
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`garagePrev+${interaction.id}`)
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId(`garageNext+${interaction.id}`)
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= pageCount)
                );
            };

            const buildFilterRow = () => {
                // Only include filters that exist in data (plus All)
                const availableKeys = new Set();
                garageData.forEach((v) => {
                    (v.collections || []).forEach((c) => availableKeys.add(c));
                });
                if (availableKeys.size === 0) return null;

                const row = new ActionRowBuilder();
                const filters = [
                    { key: 'all', label: 'All', emoji: null },
                    { key: 'daily', label: 'Daily', emoji: collectionEmojiMap.daily },
                    { key: 'project', label: 'Project', emoji: collectionEmojiMap.project },
                    { key: 'track', label: 'Track', emoji: collectionEmojiMap.track },
                    { key: 'sold', label: 'Sold', emoji: collectionEmojiMap.sold },
                ];
                filters.forEach((f) => {
                    if (f.key !== 'all' && !availableKeys.has(f.key)) return;
                    const btn = new ButtonBuilder()
                        .setCustomId(`garageFilter:${f.key}+${interaction.id}`)
                        .setLabel(f.label)
                        .setStyle(f.key === currentFilter ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(f.key === currentFilter);
                    if (f.emoji) btn.setEmoji(f.emoji);
                    row.addComponents(btn);
                });
                return row.components.length ? row : null;
            };

            const filterRow = buildFilterRow();
            const rowsBase = Math.max(1, Math.ceil(filteredGarage().length / pageSize)) > 1
                ? [buildMenuRow(), buildNavRow()]
                : [buildMenuRow()];
            const rows = filterRow ? [...rowsBase, filterRow] : rowsBase;

            const garageMessage = await interaction.editReply({ embeds: [buildEmbed()], components: rows });

            // Step 3: Set up a collector for dropdown menu interactions (scoped to this message)
            const collector = garageMessage.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 600000, // 10 minutes
                filter: (i) =>
                    i.user.id === interaction.user.id &&
                    i.customId === 'garage_menu' &&
                    i.message.id === garageMessage.id,
            });

            const navCollector = garageMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 600000,
                filter: (i) =>
                    i.user.id === interaction.user.id &&
                    (i.customId === `garagePrev+${interaction.id}` || i.customId === `garageNext+${interaction.id}`) &&
                    i.message.id === garageMessage.id,
            });

            const filterCollector = garageMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000,
                filter: (i) =>
                    i.user.id === interaction.user.id &&
                    i.customId.startsWith('garageFilter:') &&
                    i.message.id === garageMessage.id,
            });

            collector.on('collect', async (menuInteraction) => {
                try {
                    await menuInteraction.deferUpdate();
                    // Get the selected vehicle data
                    const selectedOption = menuInteraction.values[0];
                    const data = filteredGarage();
                    const selectedVehicle = data[parseInt(selectedOption)];
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
                    await require('./garageMenuHandler')(interaction, selectedOption, data, user, guildProfile, garageMessage);
                    
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
                const pageCount = Math.max(1, Math.ceil(filteredGarage().length / pageSize));
                if (btnInteraction.customId === `garagePrev+${interaction.id}` && page > 1) {
                    page -= 1;
                }
                if (btnInteraction.customId === `garageNext+${interaction.id}` && page < pageCount) {
                    page += 1;
                }
                const filterRow = buildFilterRow();
                const updatedRows = filterRow
                    ? pageCount > 1
                        ? [buildMenuRow(), buildNavRow(), filterRow]
                        : [buildMenuRow(), filterRow]
                    : pageCount > 1
                    ? [buildMenuRow(), buildNavRow()]
                    : [buildMenuRow()];
                await garageMessage.edit({
                    embeds: [buildEmbed()],
                    components: updatedRows,
                });
            });

            filterCollector.on('collect', async (btnInteraction) => {
                await btnInteraction.deferUpdate();
                const key = btnInteraction.customId.split(':')[1].split('+')[0];
                currentFilter = key;
                page = 1;
                const pageCount = Math.max(1, Math.ceil(filteredGarage().length / pageSize));
                const filterRow = buildFilterRow();
                const updatedRows = filterRow
                    ? pageCount > 1
                        ? [buildMenuRow(), buildNavRow(), filterRow]
                        : [buildMenuRow(), filterRow]
                    : pageCount > 1
                    ? [buildMenuRow(), buildNavRow()]
                    : [buildMenuRow()];
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
