const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');
const { findProfile } = require('../manage/services/profileService.js');

/**
 * Presents a dropdown with the caller's verified vehicles and resolves with the selected entry.
 * @param {Array<Object>} garageData Array of vehicles returned from the database.
 * @param {import('discord.js').User} userData User whose vehicles are being managed.
 * @param {string} footerText Footer text used across verification embeds.
 * @param {string|null} footerIcon Footer icon URL.
 * @param {string} embedColor Hex color for the selection embed.
 * @param {import('discord.js').CommandInteraction} interaction Original interaction to edit.
 * @returns {Promise<Object|null>} Selected vehicle data or null if the user cancels/times out.
 */
async function vehicleSelection(
    garageData,
    userData,
    footerText,
    footerIcon,
    embedColor,
    interaction
) {
    if (!garageData || garageData.length === 0) {
        return null;
    }

    let sortPreference = 'default';
    try {
        const profile = await findProfile(userData?.id);
        sortPreference = profile?.sortPreference || 'default';
    } catch (err) {
        console.error('Failed to load sort preference for vehicle selection:', err);
    }

    const sortedGarage = [...garageData];
    if (sortPreference === 'year-asc' || sortPreference === 'year-desc') {
        sortedGarage.sort((a, b) => {
            const yearA = parseInt(a?.vehicleSpecs?.year, 10);
            const yearB = parseInt(b?.vehicleSpecs?.year, 10);
            const validA = !isNaN(yearA);
            const validB = !isNaN(yearB);
            if (!validA && !validB) return 0;
            if (!validA) return 1; // missing years go last
            if (!validB) return -1;
            return sortPreference === 'year-asc' ? yearA - yearB : yearB - yearA;
        });
    }

    const selectionId = `vehicle_select_${interaction.id}`;
    const prevId = `vehicle_select_prev_${interaction.id}`;
    const nextId = `vehicle_select_next_${interaction.id}`;
    const userTag = userData?.tag ?? 'Unknown User';
    const userAvatar = userData?.displayAvatarURL?.({ dynamic: true }) ?? null;
    const pageSize = 10;
    let page = 1;
    const totalPages = Math.ceil(garageData.length / pageSize);

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

    const buildPageData = () => {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return sortedGarage.slice(startIndex, endIndex).map((vehicle, index) => {
            const badges = (vehicle.collections || []).map((c) => emojiDisplay(c)).filter(Boolean);
            const label = vehicle?.vehicle
                ? vehicle.vehicle.slice(0, 100)
                : `Vehicle ${startIndex + index + 1}`;
            const imageCount = vehicle?.vehicleImages?.length || 0;
            const description =
                imageCount > 0
                    ? `${imageCount} image${imageCount === 1 ? '' : 's'} available`
                    : 'No images uploaded yet.';
            return {
                label,
                description,
                value: String(startIndex + index),
                emoji: badges.length
                    ? { id: collectionEmojiMap[vehicle.collections[0]]?.id, name: collectionEmojiMap[vehicle.collections[0]]?.name }
                    : undefined,
            };
        });
    };

    const buildEmbed = () => {
        const description = totalPages > 1
            ? `Choose a vehicle from the dropdown below. Page ${page} of ${totalPages}.`
            : 'Choose a vehicle from the dropdown below to continue.';

        return new EmbedBuilder()
            .setAuthor({
                name: `${userTag}'s Verified Vehicles`,
                iconURL: userAvatar,
            })
            .setDescription(description)
            .setColor(embedColor || '#5865F2')
            .setFooter({
                text: totalPages > 1 ? `${footerText} • Page ${page} of ${totalPages}` : footerText,
                iconURL: footerIcon ?? undefined,
            });
    };

    const buildMenuRow = () =>
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(selectionId)
                .setPlaceholder('Select a vehicle...')
                .addOptions(buildPageData())
        );

    const buildNavRow = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(prevId)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(nextId)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages)
        );

    const rows = totalPages > 1 ? [buildMenuRow(), buildNavRow()] : [buildMenuRow()];
    await interaction.editReply({
        embeds: [buildEmbed()],
        components: rows,
    });

    return new Promise((resolve) => {
        const selectionMessage = interaction.fetchReply().catch(() => null);
        Promise.resolve(selectionMessage).then((message) => {
            const messageId = message?.id;
            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: (menuInteraction) =>
                    menuInteraction.customId === selectionId &&
                menuInteraction.user.id === interaction.user.id &&
                (!messageId || menuInteraction.message?.id === messageId),
            });

            const navCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000,
                filter: (btnInteraction) =>
                    btnInteraction.user.id === interaction.user.id &&
                (btnInteraction.customId === prevId || btnInteraction.customId === nextId) &&
                (!messageId || btnInteraction.message?.id === messageId),
            });

            collector.on('collect', async (menuInteraction) => {
                try {
                    await menuInteraction.deferUpdate();
                } catch (err) {
                    console.error('Failed to acknowledge vehicle selection:', err);
                }

                const selectedIndex = parseInt(menuInteraction.values[0], 10);
                collector.stop('selected');
                navCollector.stop('selected');
                resolve(sortedGarage[selectedIndex]);
            });

            navCollector.on('collect', async (btnInteraction) => {
                await btnInteraction.deferUpdate();
                if (btnInteraction.customId === prevId && page > 1) {
                    page -= 1;
                }
            if (btnInteraction.customId === nextId && page < totalPages) {
                page += 1;
            }
            const updatedRows = totalPages > 1 ? [buildMenuRow(), buildNavRow()] : [buildMenuRow()];
            await interaction.editReply({
                embeds: [buildEmbed()],
                components: updatedRows,
            });
        });

            collector.on('end', async (_collected, reason) => {
                if (reason !== 'selected') {
                    try {
                        await interaction.editReply({ components: [] });
                    } catch (err) {
                        console.error('Failed to clean up vehicle selection components:', err);
                    }
                    resolve(null);
                }
            });
        });
    });
}

module.exports = { vehicleSelection };
