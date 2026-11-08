const {
    EmbedBuilder,
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ComponentType,
} = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { buildVerificationGuide } = require('../../verification/guideEmbed');
const { greenIndicator } = require('../../constants.js');
module.exports = async (interaction, guildProfile) => {
    try {
        // Defer the interaction to allow time for processing
        await interaction.deferUpdate();

        // Embed prompting the user to select a guide channel
        const embed = new EmbedBuilder()
            .setTitle('Set Guide Channel')
            .setDescription(
                'Select a channel where members will find information on how to verify their vehicles. A guide embed will be sent to this channel for future reference.'
            )
            .setColor('#FFFCFF');

        // Create a channel select menu
        const menu = new ChannelSelectMenuBuilder()
            .setCustomId('guide_channel_select')
            .setPlaceholder('Select a channel...')
            .addChannelTypes(ChannelType.GuildText); // Restrict to text channels

        const row = new ActionRowBuilder().addComponents(menu);

        // Send the embed and menu
        await interaction.editReply({ embeds: [embed], components: [row] });

        // Collector for the Channel Select interaction
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            time: 60000,
            filter: (i) => i.user.id === interaction.user.id && i.customId === 'guide_channel_select', // Ensure only the command initiator can interact and customId matches
        });

        collector.on('collect', async (menuInteraction) => {
            const selectedChannelId = menuInteraction.values[0];
            collector.stop(); // Stop the collector after successful interaction
            const channel = interaction.guild.channels.cache.get(selectedChannelId);

            // Check if bot has necessary permissions in the selected channel
            const botPermissions = channel.permissionsFor(interaction.guild.members.me);
            const requiredPermissions = ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'];
            const hasPermissions = requiredPermissions.every((perm) => botPermissions.has(perm));

            if (!hasPermissions) {
                throw new Error(
                    `Missing permissions in <#${channel.id}>. Ensure the bot has the following permissions:\n` +
                    `- View Channel\n- Send Messages\n- Embed Links\n- Read Message History.`
                );
            }

            // Update the database with the selected channel
            await guildProfileSchema.updateOne(
                { guildId: guildProfile.guildId },
                { $set: { guideChannelId: channel.id } }
            );

            // Send the guide embed to the selected channel
            const guideEmbed = buildVerificationGuide(guildProfile, interaction.guild.name);

            await channel.send({ embeds: [guideEmbed] });

            // Confirm success to the user and return to main menu
            await menuInteraction.reply({
                content: `${greenIndicator} | The guide channel has been successfully set to <#${channel.id}>. A guide embed has been sent there.`,
                ephemeral: true
            });

            // Redirect back to the main menu
            const setupCommand = require('../../../commands/setup.js');
            await setupCommand.execute(interaction);

           
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
        console.error('Error in handleGuideChannel:', error);
        throw error; // Pass the error to the centralized handler
    }
};
