const { SlashCommandBuilder } = require('discord.js');
const { safeExecute } = require('../modules/commandUtils/safeExecute.js');
const { buildStatsEmbeds } = require('../modules/commandModules/stats/statsService.js');
const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
    EmbedBuilder,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View verification stats with charts.')
        .addStringOption((option) =>
            option
                .setName('scope')
                .setDescription('Show stats for this server or globally.')
                .addChoices(
                    { name: 'Server', value: 'server' },
                    { name: 'Global', value: 'global' },
                )
        ),
    async execute(interaction) {
        await safeExecute(interaction, async () => {
            await interaction.deferReply({ ephemeral: false });

            const scope = interaction.options.getString('scope') || 'server';
            const guildId = interaction.guild?.id || null;

            const entries = await buildStatsEmbeds({ scope, guildId, guildName: interaction.guild?.name || 'Server' });
            if (!entries || entries.length === 0) {
                await interaction.editReply('No stats available yet.');
                return;
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('stats_menu')
                .setPlaceholder('Select a stat to view')
                .addOptions(entries.map((entry) => ({
                    label: entry.label,
                    value: entry.key,
                })));

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.editReply({ embeds: [entries[0].embed], components: [row] });

            const message = await interaction.fetchReply().catch(() => null);
            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 120000,
                filter: (i) =>
                    i.customId === 'stats_menu' &&
                    i.user.id === interaction.user.id &&
                    (!message || i.message?.id === message.id),
            });

            collector.on('collect', async (selectInteraction) => {
                const key = selectInteraction.values[0];
                const entry = entries.find((e) => e.key === key) || entries[0];
                await selectInteraction.update({ embeds: [entry.embed], components: [row] });
            });

            collector.on('end', async (_collected, reason) => {
                if (reason === 'time') {
                    await interaction.editReply({ components: [] }).catch(() => {});
                }
            });
        });
    },
};
