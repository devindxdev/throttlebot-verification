const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');

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

    const selectionId = `vehicle_select_${interaction.id}`;
    const userTag = userData?.tag ?? 'Unknown User';
    const userAvatar = userData?.displayAvatarURL?.({ dynamic: true }) ?? null;

    const selectionEmbed = new EmbedBuilder()
        .setAuthor({
            name: `${userTag}'s Verified Vehicles`,
            iconURL: userAvatar,
        })
        .setDescription('Choose a vehicle from the dropdown below to continue.')
        .setColor(embedColor || '#5865F2')
        .setFooter({
            text: footerText,
            iconURL: footerIcon ?? undefined,
        });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(selectionId)
        .setPlaceholder('Select a vehicle...')
        .addOptions(
            garageData.slice(0, 25).map((vehicle, index) => {
                const label = vehicle?.vehicle
                    ? vehicle.vehicle.slice(0, 100)
                    : `Vehicle ${index + 1}`;
                const imageCount = vehicle?.vehicleImages?.length || 0;
                const description =
                    imageCount > 0
                        ? `${imageCount} image${imageCount === 1 ? '' : 's'} available`
                        : 'No images uploaded yet.';

                return {
                    label,
                    description,
                    value: index.toString(),
                };
            })
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.editReply({
        embeds: [selectionEmbed],
        components: [row],
    });

    return new Promise((resolve) => {
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000,
            filter: (menuInteraction) =>
                menuInteraction.customId === selectionId &&
                menuInteraction.user.id === interaction.user.id,
        });

        collector.on('collect', async (menuInteraction) => {
            try {
                await menuInteraction.deferUpdate();
            } catch (err) {
                console.error('Failed to acknowledge vehicle selection:', err);
            }

            const selectedIndex = parseInt(menuInteraction.values[0], 10);
            collector.stop('selected');
            resolve(garageData[selectedIndex]);
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
}

module.exports = { vehicleSelection };
