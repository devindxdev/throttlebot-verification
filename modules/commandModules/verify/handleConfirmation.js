const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { attachmentKind, videoGuidance } = require('../../verification/evidencePolicy');
const { errorEmbed } = require('../../utility.js');

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile, initiatorAvatar) => {
    try {
        const kind = attachmentKind(vehicleAttachment);
        const isVideo = kind === 'video';
        // Prepare the confirmation embed
        const confirmationEmbed = new EmbedBuilder()
            .setAuthor({
                name: isVideo ? 'Video Verification — Confirm Submission' : 'Vehicle Verification - Confirmation',
                iconURL: initiatorAvatar
            })
            .setDescription(
                isVideo ? `Check your vehicle name and video below. Your video will be sent to ${interaction.guild.name} staff for review after you confirm.` :
                `Thank you for providing your vehicle details! Please review the information below before submitting your application.`
            )
            .addFields(
                {
                    name: 'Vehicle Name',
                    value: `${vehicleName}`,
                    inline: false,
                },
                {
                    name: 'Requirements',
                    value: isVideo ? 'Use your own clear, original, unedited video. Make sure your vehicle name matches the vehicle shown.' : `1. Ensure the vehicle name is correct.\n` +
                            `2. Make sure your application meets the requirements listed in <#${guildProfile.guideChannelId}> otherwise it will be rejected.`,
                    inline: false,
                },
                {
                    name: 'Next Steps',
                    value: isVideo ? 'Click **Submit Video** to send your application to staff, or **Cancel** to stop.' : `If everything looks good, click **Confirm** to submit your application. If you want to cancel, click **Cancel**.`,
                    inline: false,
                }
            )
            .setColor('#FFFCFF')
            .setFooter({
                text: `${interaction.guild.name} • Vehicle Verification`,
                iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
            });

        if (isVideo) {
            confirmationEmbed.addFields({ name: 'Video verification', value: videoGuidance(guildProfile, { guildName: interaction.guild.name, username: interaction.user.username }) });
        }
        if (kind === 'video') {
            confirmationEmbed.addFields({ name: 'Uploaded evidence', value: `[View your video](${vehicleAttachment.url})` });
        }
        if (kind === 'image') {
            confirmationEmbed.setImage(vehicleAttachment.url); // Display the uploaded vehicle image
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirmVerification')
                .setLabel(isVideo ? 'Submit Video' : 'Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancelVerification')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        // Send the confirmation embed
        const responseMessage = await interaction.editReply({ embeds: [confirmationEmbed], components: [row] });

        // Set up a button collector with proper filters
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: (btnInteraction) =>
                (!responseMessage?.id || btnInteraction.message?.id === responseMessage.id) &&
                btnInteraction.user.id === interaction.user.id && // Ensure only the initiating user can respond
                ['confirmVerification', 'cancelVerification'].includes(btnInteraction.customId), // Check for valid button IDs
        });

        return new Promise((resolve) => {
            collector.on('collect', async (btnInteraction) => {
                await btnInteraction.deferUpdate(); // Acknowledge the interaction
                collector.stop(); // Stop the collector once a valid button is clicked

                row.components.forEach(button => button.setDisabled(true));

                if (btnInteraction.customId === 'confirmVerification') {
                    const runningRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(isVideo ? 'video_submission_running' : 'ai_verification_running')
                            .setLabel(kind === 'video' ? 'Submitting Video' : 'Pre-Screening')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                    const runningEmbed = isVideo ? new EmbedBuilder()
                        .setAuthor({ name: 'Submitting Video Verification', iconURL: initiatorAvatar })
                        .setDescription('Your video is being uploaded for staff review. Please wait for your submission confirmation.')
                        .addFields({ name: 'Vehicle', value: vehicleName }, { name: 'Video', value: `[View your video](${vehicleAttachment.url})` })
                        .setColor('#FFFCFF') : null;
                    await interaction.editReply({ ...(runningEmbed ? { embeds: [runningEmbed] } : {}), components: [runningRow] });
                    resolve(true); // User confirms the submission
                } else if (btnInteraction.customId === 'cancelVerification') {
                    // User cancels the submission
                    const cancelEmbed = new EmbedBuilder()
                        .setAuthor({ name: isVideo ? 'Video Verification — Canceled' : 'Vehicle Verification - Canceled', iconURL: initiatorAvatar })
                        .setDescription(isVideo ? 'Your video has not been submitted. Use `/verify` again when you are ready.' : 'You have canceled the vehicle verification process. You can try again using the `/verify` command.')
                        .setColor('#FF6961'); // Red for canceled
                    await interaction.editReply({ embeds: [cancelEmbed], components: [] });
                    resolve(false); // Abort the process
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    // Timeout if no response
                    row.components.forEach(button => button.setDisabled(true));
                    await interaction.editReply({
                        embeds: [errorEmbed(isVideo ? 'Your video was not submitted because confirmation timed out. Use `/verify` again when you are ready.' : 'The verification process timed out.', initiatorAvatar)],
                        components: [row],
                    });
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Error during confirmation:', error);
        await interaction.editReply({
            embeds: [errorEmbed(attachmentKind(vehicleAttachment) === 'video' ? 'Could not confirm your video submission. Please use `/verify` to try again.' : 'An error occurred during confirmation.', initiatorAvatar)],
        });
        return false;
    }
};
