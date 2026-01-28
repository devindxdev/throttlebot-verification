const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');
const { errorEmbed } = require('../../../utility.js');
const { setVehicleCollections } = require('../../manage/services/vehicleService.js');

const COLLECTIONS = [
    { key: 'daily', label: 'Daily', emoji: '<:green:1465988391404310773>' },
    { key: 'project', label: 'Project', emoji: '<:blurpleIndicator:976067465471721532>' },
    { key: 'track', label: 'Track', emoji: '<:yellow:1465988323293134870>' },
    { key: 'sold', label: 'Sold', emoji: '<:red:1465988285959639207>' },
];

function buildEmbed({ initiatorAvatar, embedColor, footer, vehicle, selected, ownerTag }) {
    const selectedLabels = COLLECTIONS.filter((c) => selected.includes(c.key)).map((c) => `${c.emoji} ${c.label}`);
    return new EmbedBuilder()
        .setAuthor({ name: 'Garage Collections', iconURL: initiatorAvatar })
        .setDescription(
            'Organize this vehicle into collections. Toggle a button to add or remove it. ' +
                'You can switch between Track, Project, Daily, and Sold.'
        )
        .addFields(
            { name: 'Vehicle', value: vehicle, inline: true },
            { name: 'Owner', value: ownerTag, inline: true },
            { name: 'Current Collections', value: selectedLabels.join('\n') || 'None' }
        )
        .setColor(embedColor)
        .setFooter({ text: footer.text, iconURL: footer.icon });
}

function buildButtons(selected, mainInteractionId) {
    const row1 = new ActionRowBuilder();
    COLLECTIONS.forEach((c) => {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`collectionsToggle:${c.key}+${mainInteractionId}`)
                .setLabel(`${c.label}`)
                .setEmoji(c.emoji)
                .setStyle(selected.includes(c.key) ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
    });
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`collectionsClear+${mainInteractionId}`)
            .setLabel('Clear')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`collectionsExit+${mainInteractionId}`)
            .setLabel('Done')
            .setStyle(ButtonStyle.Primary)
    );
    return [row1, row2];
}

module.exports = async function collectionsFlow(triggerInteraction, ctx) {
    const { interaction, initiator, guild, embedColor, footer, selectedVehicle, logChannel } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const mainInteractionId = interaction.id;
    let selections = Array.isArray(selectedVehicle.collections) ? [...selectedVehicle.collections] : [];

    const render = async () => {
        const embed = buildEmbed({
            initiatorAvatar,
            embedColor,
            footer,
            vehicle: selectedVehicle.vehicle,
            selected: selections,
            ownerTag: initiator.tag,
        });
        await interaction.editReply({ embeds: [embed], components: buildButtons(selections, mainInteractionId) });
    };

    await render();

    const settingsMessage = await interaction.fetchReply().catch(() => null);

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) =>
            i.user.id === initiator.id &&
            (!settingsMessage || i.message.id === settingsMessage.id) &&
            i.customId.endsWith(`+${mainInteractionId}`),
        time: 120000,
    });

    collector.on('collect', async (btn) => {
        const id = btn.customId;

        if (id.startsWith('collectionsToggle:')) {
            const key = id.split(':')[1].split('+')[0];
            const exists = selections.includes(key);
            selections = exists ? selections.filter((k) => k !== key) : [...selections, key];

            try {
                await setVehicleCollections({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    collections: selections,
                });
                selectedVehicle.collections = selections;
            } catch (err) {
                await btn.reply({
                    embeds: [errorEmbed('Failed to update collections. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            await btn.update({
                embeds: [
                    buildEmbed({
                        initiatorAvatar,
                        embedColor,
                        footer,
                        vehicle: selectedVehicle.vehicle,
                        selected: selections,
                        ownerTag: initiator.tag,
                    }),
                ],
                components: buildButtons(selections, mainInteractionId),
            });
            return;
        }

        if (id === `collectionsClear+${mainInteractionId}`) {
            selections = [];
            try {
                await setVehicleCollections({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    collections: selections,
                });
                selectedVehicle.collections = selections;
            } catch (err) {
                await btn.reply({
                    embeds: [errorEmbed('Failed to clear collections. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }
            await btn.update({
                embeds: [buildEmbed({
                    initiatorAvatar,
                    embedColor,
                    footer,
                    vehicle: selectedVehicle.vehicle,
                    selected: selections,
                    ownerTag: initiator.tag,
                })],
                components: buildButtons(selections, mainInteractionId),
            });
            return;
        }

        if (id === `collectionsExit+${mainInteractionId}`) {
            await btn.deferUpdate().catch(() => {});
            collector.stop('exit');
            await interaction.deleteReply().catch(() => {});
        }
    });

    collector.on('end', async (_c, reason) => {
        if (reason === 'time') {
            await interaction.deleteReply().catch(() => {});
        }
    });
};
