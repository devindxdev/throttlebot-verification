const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { obtainGuildProfile, defaultEmbedColor } = require('../modules/database.js');
const { errorEmbed } = require('../modules/utility.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Apply for verification of your vehicle.')
        .addStringOption(option => 
            option
                .setName('vehicle')
                .setDescription('Enter the name of your vehicle.')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('Please upload the image of your vehicle with all the required items.')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });

            // Extract vehicle and user details
            const vehicleName = interaction.options.getString('vehicle');
            const vehicleAttachment = interaction.options.getAttachment('image');
            const initiatorId = interaction.user.id;
            const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });
            const guildId = interaction.guild.id;

            // Fetch guild profile
            const guildProfile = await obtainGuildProfile(guildId);
            if (!guildProfile) {
                throw new Error('The server is not setup properly, please request the staff to set it up using the `/setup` command.');
            }

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
                initiatorAvatar
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
            const isFileTooLarge =
                error?.code === 40005 ||
                /file size|entity too large|payload too large/i.test(error?.message || '');
            const errorMessage = isFileTooLarge
                ? 'The uploaded file is too large for this server. Please upload a smaller file or try again in a boosted server.'
                : 'An unexpected error occurred while processing your verification request.';
            
            if (interaction.deferred) {
                await interaction.editReply({
                    embeds: [errorEmbed(errorMessage, interaction.user.displayAvatarURL({ dynamic: true }))]
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
