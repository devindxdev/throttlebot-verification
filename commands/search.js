const { SlashCommandBuilder } = require('discord.js');
const { defaultEmbedColor } = require('../modules/database.js');
const { vehicleSearch } = require('../modules/commandModules/search/main.js');
const { safeExecute } = require('../modules/commandUtils/safeExecute.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for a specific vehicle.')
        .addStringOption(option => option.setName('vehicle').setDescription('Enter what vehicle you would like to search for.')),
        async execute(interaction) {
            await safeExecute(interaction, async () => {
                await interaction.deferReply();
                const initiatorId = interaction.user.id;
                const embedColor = await defaultEmbedColor(initiatorId);
                const searchTerm = interaction.options.getString('vehicle') || '';

                await vehicleSearch(
                    interaction,
                    interaction.user,
                    interaction.guild,
                    embedColor,
                    searchTerm
                );
            });
    },
};
