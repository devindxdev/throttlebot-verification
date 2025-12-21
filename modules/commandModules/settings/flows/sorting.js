const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');
const { errorEmbed } = require('../../../utility.js');
const { findProfile, updateSortPreference } = require('../../manage/services/profileService.js');

const SORT_LABELS = {
    default: 'Default (verification order)',
    'year-asc': 'Year ↑ (oldest to newest)',
    'year-desc': 'Year ↓ (newest to oldest)',
};

module.exports = async function sortingFlow(_triggerInteraction, ctx) {
    const { interaction, initiator, embedColor, footer } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const mainInteractionId = interaction.id;

    let profile;
    try {
        profile = await findProfile(initiator.id);
    } catch (err) {
        await interaction.editReply({
            embeds: [errorEmbed('Failed to load your profile.', initiatorAvatar)],
            components: [],
        });
        return;
    }

    let sortPreference = profile?.sortPreference || 'default';

    const buildEmbed = () =>
        new EmbedBuilder()
            .setAuthor({ name: 'Garage Settings - Sorting', iconURL: initiatorAvatar })
            .setDescription('Choose how your garage is sorted when you use `/garage`.')
            .addFields({ name: 'Current Preference', value: SORT_LABELS[sortPreference] || SORT_LABELS.default })
            .setColor(embedColor)
            .setFooter({ text: footer.text, iconURL: footer.icon });

    const buildControls = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sortingDefault+${mainInteractionId}`)
                .setLabel('Default Order')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`sortingYearAsc+${mainInteractionId}`)
                .setLabel('Year ↑')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`sortingYearDesc+${mainInteractionId}`)
                .setLabel('Year ↓')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`sortingExit+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({ embeds: [buildEmbed()], components: [buildControls()] });
    const settingsMessage = await interaction.fetchReply().catch(() => null);

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (btn) =>
            btn.user.id === initiator.id &&
            (!settingsMessage || btn.message.id === settingsMessage.id),
        time: 120000,
    });

    collector.on('collect', async (btn) => {
        const { customId } = btn;
        const isExit = customId === `sortingExit+${mainInteractionId}`;
        const chosen =
            customId === `sortingDefault+${mainInteractionId}`
                ? 'default'
                : customId === `sortingYearAsc+${mainInteractionId}`
                ? 'year-asc'
                : customId === `sortingYearDesc+${mainInteractionId}`
                ? 'year-desc'
                : null;

        if (isExit) {
            await btn.deferUpdate();
            collector.stop('exit');
            await interaction.deleteReply().catch(() => {});
            return;
        }

        if (!chosen) {
            await btn.deferUpdate();
            return;
        }

        if (sortPreference === chosen) {
            await btn.reply({
                embeds: [errorEmbed('That sorting option is already active.', initiatorAvatar)],
                ephemeral: true,
            });
            return;
        }

        try {
            await updateSortPreference(initiator.id, chosen);
            sortPreference = chosen;
        } catch (err) {
            await btn.reply({
                embeds: [errorEmbed('Failed to update sorting preference. Please try again later.', initiatorAvatar)],
                ephemeral: true,
            });
            return;
        }

        await btn.update({ embeds: [buildEmbed()], components: [buildControls()] });
    });

    collector.on('end', async (_c, reason) => {
        if (reason === 'time') {
            await interaction.deleteReply().catch(() => {});
        }
    });
};
