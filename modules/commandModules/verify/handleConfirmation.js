const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { errorEmbed } = require('../../utility.js');

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile, initiatorAvatar) => {
    try {
        // Prepare the confirmation embed
        const confirmationEmbed = new EmbedBuilder()
            .setAuthor({ 
                name: 'Vehicle Verification - Confirmation', 
                iconURL: initiatorAvatar 
            })
            .setDescription(
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
                    value: `1. Ensure the vehicle name is correct.\n` +
                            `2. Make sure your application meets the requirements listed in <#${guildProfile.guideChannelId}> otherwise it will be rejected.`,
                    inline: false,
                },
                {
                    name: 'Next Steps',
                    value: `If everything looks good, click **Confirm** to submit your application. If you want to cancel, click **Cancel**.`,
                    inline: false,
                }
            )
            .setColor('#FFFCFF')
            .setFooter({
                text: `${interaction.guild.name} • Vehicle Verification`,
                iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
            });

        if (vehicleAttachment.contentType?.includes('image')) {
            confirmationEmbed.setImage(vehicleAttachment.url); // Display the uploaded vehicle image
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirmVerification')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancelVerification')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        // Send the confirmation embed
        await interaction.editReply({ embeds: [confirmationEmbed], components: [row] });

        // Set up a button collector with proper filters
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: (btnInteraction) =>
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
                            .setCustomId('ai_verification_running')
                            .setLabel('Pre-Screening')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                    await interaction.editReply({ components: [runningRow] });
                    resolve(true); // User confirms the submission
                } else if (btnInteraction.customId === 'cancelVerification') {
                    // User cancels the submission
                    const cancelEmbed = new EmbedBuilder()
                        .setAuthor({ name: 'Vehicle Verification - Canceled', iconURL: initiatorAvatar })
                        .setDescription('You have canceled the vehicle verification process. You can try again using the `/verify` command.')
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
                        embeds: [errorEmbed('The verification process timed out.', initiatorAvatar)],
                        components: [row],
                    });
                    resolve(false);
                }
            });
        });
    } catch (error) {
        console.error('Error during confirmation:', error);
        await interaction.editReply({
            embeds: [errorEmbed('An error occurred during confirmation.', initiatorAvatar)],
        });
        return false;
    }
};
