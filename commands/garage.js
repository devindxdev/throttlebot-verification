const { SlashCommandBuilder } = require('discord.js');
const { obtainGuildProfile, obtainUserProfile } = require('../modules/database.js');
const { errorEmbed } = require('../modules/utility.js');
const getUserGarage = require('../modules/commandModules/garage/getUserGarage.js');
const generateGarageEmbed = require('../modules/commandModules/garage/generateGarageEmbed.js');
const { sortGarageData } = require('../modules/commandModules/garage/sorting.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('garage')
        .setDescription('View yours or another user\'s garage.')
        .addUserOption(option =>
            option
                .setName('mention')
                .setDescription('View another user\'s garage.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        // Fetch user and guild details
        const user = interaction.options.getUser('mention') || interaction.user;
        const userId = user.id;
        const guildId = interaction.guild.id;
        const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });

        // Fetch guild profile
        let guildProfile;
        try {
            guildProfile = await obtainGuildProfile(guildId);
            if (!guildProfile) {
                return interaction.editReply({
                    embeds: [errorEmbed('Server profile not set up. Please ask staff to configure the bot using `/setup`.', initiatorAvatar)],
                });
            }
        } catch (error) {
            console.error('Error fetching guild profile:', error);
            return interaction.editReply({
                embeds: [errorEmbed('An error occurred while fetching server settings.', initiatorAvatar)],
            });
        }

        try {
            // Step 1: Fetch the user's garage
            const garageData = await getUserGarage(userId, guildProfile);

            // Step 1.5: Determine sorting preference (default if unavailable)
            let sortPreference = 'default';
            try {
                const userProfile = await obtainUserProfile(userId);
                if (userProfile?.sortPreference) sortPreference = userProfile.sortPreference;
            } catch (err) {
                console.warn('Failed to fetch user profile for sorting preference:', err.message);
            }
            const sortedGarage = sortGarageData(garageData, sortPreference);

            // Step 2: Generate the main garage embed with a dropdown menu
            await generateGarageEmbed(interaction, sortedGarage, user, guildProfile);

        } catch (error) {
            console.error('Error in /garage command:', error);
            await interaction.editReply({ embeds: [errorEmbed('An error occurred while processing the garage. Please try again later.', initiatorAvatar)] });
        }
    },
};
