const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { errorEmbed } = require('../../utility.js');

module.exports = async (interaction, guildProfile) => {
    await interaction.deferUpdate();

    const embed = new EmbedBuilder()
        .setTitle('Gemini Analysis')
        .setDescription(
            'Enable or disable automatic Gemini analysis for verification applications. When enabled, incoming applications will be auto-reviewed by Gemini before manual review.'
        )
        .addFields({
            name: 'Current Status',
            value: guildProfile.geminiAnalysisEnabled ? 'Enabled' : 'Disabled',
        })
        .setColor('#FFFCFF');

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('gemini_enable')
            .setLabel('Enable')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!!guildProfile.geminiAnalysisEnabled),
        new ButtonBuilder()
            .setCustomId('gemini_disable')
            .setLabel('Disable')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!guildProfile.geminiAnalysisEnabled),
        new ButtonBuilder()
            .setCustomId('gemini_back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [controls] });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
        max: 1,
    });

    collector.on('collect', async (btn) => {
        const id = btn.customId;
        if (id === 'gemini_back') {
            await btn.deferUpdate();
            const setupCommand = require('../../../commands/setup.js');
            await setupCommand.execute(interaction);
            return;
        }

        const newValue = id === 'gemini_enable';
        try {
            await guildProfileSchema.updateOne(
                { guildId: guildProfile.guildId },
                { $set: { geminiAnalysisEnabled: newValue } }
            );
        } catch (err) {
            await btn.reply({ embeds: [errorEmbed('Failed to update Gemini analysis setting.', interaction.user.displayAvatarURL({ dynamic: true }))], ephemeral: true });
            return;
        }

        await btn.reply({
            content: `Gemini analysis has been ${newValue ? 'enabled' : 'disabled'}.`,
            ephemeral: true,
        });

        const setupCommand = require('../../../commands/setup.js');
        await setupCommand.execute(interaction);
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            await interaction.followUp({ content: 'No selection made. Returning to setup.', ephemeral: true });
            const setupCommand = require('../../../commands/setup.js');
            await setupCommand.execute(interaction);
        }
    });
};
