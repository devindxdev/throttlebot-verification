const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { errorEmbed } = require('../../utility.js');

module.exports = async (interaction, guildProfile, initiatorAvatar) => {
    try {
        // Prepare the pre-approval embed
        const preApprovalEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Vehicle Verification Pre-Approval', iconURL: initiatorAvatar })
            .setDescription(
                `Before continuing, make sure you've read the verification requirements in <#${guildProfile.guideChannelId}>.\n\nHave you checked the guide and confirmed that you meet the requirements?`
            )
            .setColor('#FFFCFF');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('preApprovalYes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('preApprovalNo')
                .setLabel('No')
                .setStyle(ButtonStyle.Danger)
        );

        // Send the embed with buttons
        await interaction.editReply({ embeds: [preApprovalEmbed], components: [row] });

        // Set up a button collector with proper filters
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: (btnInteraction) =>
                btnInteraction.user.id === interaction.user.id && // Ensure only the user who initiated can respond
                ['preApprovalYes', 'preApprovalNo'].includes(btnInteraction.customId), // Check for valid button IDs
        });

        return new Promise((resolve) => {
            collector.on('collect', async (btnInteraction) => {
                await btnInteraction.deferUpdate(); // Acknowledge the interaction
                collector.stop(); // Stop the collector once a valid button is clicked

                if (btnInteraction.customId === 'preApprovalYes') {
                    resolve(true); // User confirms they've read the guide
                } else if (btnInteraction.customId === 'preApprovalNo') {
                    // User denies reading the guide
                    const denialEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Vehicle Verification - Denied', iconURL: initiatorAvatar })
                        .setDescription(
                            `Please read the verification requirements in <#${guildProfile.guideChannelId}> before proceeding.\n\nOnce ready, you can try again using the \`/verify\` command.`
                        )
                        .setColor('#FF6961'); // Red for denied
                    await interaction.editReply({ embeds: [denialEmbed], components: [] });
                    resolve(false); // Abort the process
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    // Timeout if no response
                    await interaction.editReply({
                        embeds: [errorEmbed('The verification process timed out.', initiatorAvatar)],
                        components: [],
                    });
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Error during pre-approval:', error);
        await interaction.editReply({
            embeds: [errorEmbed('An error occurred during pre-approval.', initiatorAvatar)],
        });
        return false;
    }
};
