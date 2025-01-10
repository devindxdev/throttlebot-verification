const {
    EmbedBuilder,
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ComponentType,
    ChannelType,
} = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { greenIndicator } = require('../../constants.js');

module.exports = async (interaction, guildProfile) => {

    await interaction.deferUpdate();

    const embed = new EmbedBuilder()
        .setTitle('Set Logs Channel')
        .setDescription(
            'Select a channel where the following logs will be sent:\n' +
            '1. New verifications\n' +
            '2. Garage updates\n\n' +
            'Please ensure the bot has the required permissions in the selected channel.'
        )
        .setColor('#FFFCFF');

    const row = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('logs_channel_select')
            .setPlaceholder('Select a channel...')
            .addChannelTypes(ChannelType.GuildText)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        time: 60000,
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'logs_channel_select',
        max: 1
    });

    collector.on('collect', async (menuInteraction) => {
        const selectedChannelId = menuInteraction.values[0];
        collector.stop();
        const channel = interaction.guild.channels.cache.get(selectedChannelId);

        const requiredPermissions = ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'];
        const missingPermissions = requiredPermissions.filter(
            perm => !channel.permissionsFor(interaction.guild.members.me).has(perm)
        );

        if (missingPermissions.length > 0) {
            throw new Error(
                `Missing permissions in <#${channel.id}>. Please ensure the bot has the following permissions:\n` +
                missingPermissions.map(perm => `- ${perm}`).join('\n')
            );
        }

        try {
            await guildProfileSchema.updateOne(
                { guildId: guildProfile.guildId },
                { $set: { loggingChannelId: channel.id } }
            );

            await menuInteraction.reply({
                content: `${greenIndicator} | The logs channel has been successfully set to <#${channel.id}>.`,
                ephemeral: true,
            });

            const setupCommand = require('../../../commands/setup.js');
            await setupCommand.execute(interaction);

        } catch (err) {
            console.error('Error updating logs channel:', err);
            throw new Error('Failed to update the logs channel in the database.');
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            await interaction.followUp({
                content: 'No channel selected. The setup process timed out.',
                ephemeral: true,
            });
        }
    });
};
