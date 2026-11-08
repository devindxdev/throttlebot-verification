const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { attachmentKind, videoGuidance } = require('../../verification/evidencePolicy');
const { errorEmbed } = require('../../utility.js');

module.exports = async (interaction, guildProfile, initiatorAvatar, vehicleAttachment) => {
    try {
        const isVideo = guildProfile.videoVerificationRequired || attachmentKind(vehicleAttachment) === 'video';
        // Prepare the pre-approval embed
        const preApprovalEmbed = new EmbedBuilder()
            .setAuthor({ name: isVideo ? 'Video Verification — Before You Submit' : 'Vehicle Verification Pre-Approval', iconURL: initiatorAvatar })
            .setDescription(
                isVideo ? `Check your video against the requirements below before submitting. Read <#${guildProfile.guideChannelId}> and watch the example in the guide. Is your video ready?` :
                `Before continuing, make sure you've read the verification requirements in <#${guildProfile.guideChannelId}>.\nHave you checked the guide and confirmed that you meet the requirements?`
            )
            .addFields({
                name: 'Important',
                value:
                    'Submitting applications that do not meet the requirements may result in disciplinary action.\n' +
                    (isVideo ? 'AI-generated videos are **not allowed and will result in a ban.**' : 'AI-generated images/videos are **not allowed and will result in a ban.**')
            })
            .setColor('#FFFCFF');

        if (isVideo) {
            preApprovalEmbed.addFields({ name: 'Video checklist', value: videoGuidance(guildProfile, { guildName: interaction.guild.name, username: interaction.user.username }) });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('preApprovalYes')
                .setLabel(isVideo ? 'My Video Is Ready' : 'Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('preApprovalNo')
                .setLabel(isVideo ? 'Read The Guide First' : 'No')
                .setStyle(ButtonStyle.Danger)
        );

        // Send the embed with buttons
        const responseMessage = await interaction.editReply({ embeds: [preApprovalEmbed], components: [row] });

        // Set up a button collector with proper filters
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: (btnInteraction) =>
                (!responseMessage?.id || btnInteraction.message?.id === responseMessage.id) &&
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
                        .setAuthor({ name: isVideo ? 'Video Verification — Not Submitted' : 'Vehicle Verification - Denied', iconURL: initiatorAvatar })
                        .setDescription(
                            isVideo ? `Your video has not been submitted. Read <#${guildProfile.guideChannelId}> and its example, record a video that meets the requirements, then use \`/verify\` again.` :
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
                        embeds: [errorEmbed(isVideo ? 'Your video was not submitted because the checklist timed out. Use `/verify` again when your video is ready.' : 'The verification process timed out.', initiatorAvatar)],
                        components: [],
                    });
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Error during pre-approval:', error);
        await interaction.editReply({
            embeds: [errorEmbed(guildProfile.videoVerificationRequired ? 'Could not complete the video checklist. Please use `/verify` to try again.' : 'An error occurred during pre-approval.', initiatorAvatar)],
        });
        return false;
    }
};
