const { SlashCommandBuilder } = require('@discordjs/builders');
const { obtainGuildProfile, defaultEmbedColor, obtainAllUserVehicles, obtainUserProfile, obtainVehicleSearch } = require('../modules/database.js');
const {  errorEmbed, removeNonIntegers, tipsEmbed } = require('../modules/utility.js');
const { vehicleSearch } = require('../modules/commandModules/search/main.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for a specific vehicle.')
        .addStringOption(option => option.setName('vehicle').setDescription('Enter what vehicle you would like to search for.')),
        async execute(interaction) {
            await interaction.deferReply();
            const initiatorData = interaction.user;
            const initiatorId = interaction.user.id;
            const initiatorUsername = interaction.user.username;
            const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });

            //Guild information
            const guildData = interaction.guild;
            const guildId = interaction.guild.id;
            const guildName = interaction.guild.name;
            const guildIcon = interaction.guild.iconURL({ dynamic: true });    

            //Misc
            const embedColor = await defaultEmbedColor(initiatorId);
            let searchTerm = interaction.options.getString('vehicle') || '';

            vehicleSearch(
                interaction,
                initiatorData,
                guildData,
                embedColor,
                searchTerm
            );
    },
};