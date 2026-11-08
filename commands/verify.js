const { buildVerifyCommand } = require('../modules/verification/verifyCommand');
const { attachmentKind, submissionErrorMessage } = require('../modules/verification/evidencePolicy');
const { obtainGuildProfile } = require('../modules/database.js');
const { errorEmbed } = require('../modules/utility.js');

module.exports = {
    data: buildVerifyCommand(),

    async execute(interaction) {
        let videoSubmission = false;
        try {
            await interaction.deferReply({ ephemeral: false });

            // Extract vehicle and user details
            const vehicleName = interaction.options.getString('vehicle');
            const vehicleAttachment = interaction.options.getAttachment('media') || interaction.options.getAttachment('video') || interaction.options.getAttachment('image');
            videoSubmission = attachmentKind(vehicleAttachment) === 'video';
            const initiatorId = interaction.user.id;
            const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });
            const guildId = interaction.guild.id;

            // Fetch guild profile
            const guildProfile = await obtainGuildProfile(guildId);
            if (!guildProfile) {
                throw new Error('The server is not setup properly, please request the staff to set it up using the `/setup` command.');
            }

            videoSubmission ||= guildProfile.videoVerificationRequired === true;

            // Validation (Delegated to validateInput function)
            const isValid = await require('../modules/commandModules/verify/validateInput.js')(
                interaction,
                vehicleAttachment,
                vehicleName,
                initiatorId,
                guildProfile
            );
            if (!isValid) return;

            // Pre-approval step
            const isPreApproved = await require('../modules/commandModules/verify/handlePreApproval.js')(
                interaction,
                guildProfile,
                initiatorAvatar,
                vehicleAttachment
            );
            if (!isPreApproved) return;

            // Confirmation step
            const isConfirmed = await require('../modules/commandModules/verify/handleConfirmation.js')(
                interaction,
                vehicleName,
                vehicleAttachment,
                guildProfile,
                initiatorAvatar
            );
            if (!isConfirmed) return;

            // Submit the application
            await require('../modules/commandModules/verify/submitApplication.js')(
                interaction,
                vehicleName,
                vehicleAttachment,
                guildProfile
            );


        } catch (error) {
            console.error('Error in verify command:', error);
            const errorMessage = submissionErrorMessage(error, { video: videoSubmission });

            if (interaction.deferred) {
                await interaction.editReply({
                    embeds: [errorEmbed(errorMessage, interaction.user.displayAvatarURL({ dynamic: true }))],
                    components: [],
                });
            } else {
                await interaction.reply({
                    embeds: [errorEmbed(errorMessage, interaction.user.displayAvatarURL({ dynamic: true }))],
                    ephemeral: true
                });
            }
        }
    },
};
