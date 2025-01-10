const {
    EmbedBuilder,
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ComponentType,
    ChannelType,
} = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { errorEmbed } = require('../../utility.js');
const { greenIndicator } = require('../../constants.js');


module.exports = async (interaction, guildProfile) => {
    try {
        // Defer the interaction to allow time for the process
        await interaction.deferUpdate();

        // Create the embed asking for a channel selection
        const embed = new EmbedBuilder()
            .setTitle('Set Verification Channel')
            .setDescription(
                'Please select a channel where vehicle verification applications will be sent.'
            )
            .setColor('#FFFCFF');

        // Create the Channel Select Menu
        const menu = new ChannelSelectMenuBuilder()
            .setCustomId('verification_channel_select')
            .setPlaceholder('Select a channel...')
            .addChannelTypes(ChannelType.GuildText); // Restrict to text channels

        const row = new ActionRowBuilder().addComponents(menu);

        // Reply with the embed and menu
        await interaction.editReply({ embeds: [embed], components: [row] });

        // Create a collector to handle the menu interaction
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            time: 60000,
            filter: (i) => i.user.id === interaction.user.id
        });

        collector.on('collect', async (menuInteraction) => {
            if (menuInteraction.customId !== 'verification_channel_select') return;
            collector.stop();
            // Get the selected channel
            const selectedChannel = menuInteraction.values[0];
            const channel = interaction.guild.channels.cache.get(selectedChannel);

            // Validate channel type
            if (!channel || channel.type !== ChannelType.GuildText) {
                await menuInteraction.reply({
                    embeds: [
                        errorEmbed(
                            'Invalid channel selected. Please ensure it is a text channel.',
                            interaction.user.displayAvatarURL({ dynamic: true })
                        ),
                    ],
                    ephemeral: true,
                });
                return;
            }

            // Update the database with the selected channel
            try {
                await guildProfileSchema.updateOne(
                    { guildId: guildProfile.guildId },
                    { $set: { verificationChannelId: channel.id } }
                );

                await menuInteraction.reply({
                    content: `${greenIndicator} | The verification channel has been successfully set to <#${channel.id}>`,
                    ephemeral: true,
                });

                // Return to the main menu
                const setupCommand = require('../../../commands/setup.js');
                await setupCommand.execute(interaction);

            } catch (err) {
                console.error('Error updating verification channel:', err);
                throw new Error('Failed to update the verification channel in the database.');
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.followUp({
                    content: 'No channel selected. The setup process timed out.',
                    ephemeral: true,
                });
            }
        });
    } catch (error) {
        console.error('Error in handleVerificationChannel:', error);
        throw new Error('An unexpected error occurred while setting the verification channel.');
    }
};
