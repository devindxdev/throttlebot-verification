const { SlashCommandBuilder } = require('discord.js');
const { defaultEmbedColor } = require('../modules/database.js');
const { vehicleSearch } = require('../modules/commandModules/search/main.js');
const { safeExecute } = require('../modules/commandUtils/safeExecute.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for a specific vehicle.')
        .addStringOption(option => option.setName('vehicle').setDescription('Enter the vehicle name/model to search.'))
        .addStringOption(option => option.setName('brand').setDescription('Search by brand (e.g., BMW, Ford).'))
        .addBooleanOption(option => option.setName('brands').setDescription('Browse brands instead of typing.')),
        async execute(interaction) {
            await safeExecute(interaction, async () => {
                await interaction.deferReply();
                const initiatorId = interaction.user.id;
                const embedColor = (await defaultEmbedColor(initiatorId)) || '#FFFCFF';
                const searchTerm = interaction.options.getString('vehicle') || '';
                const brandTerm = interaction.options.getString('brand') || '';
                const browseBrands = interaction.options.getBoolean('brands') || false;

                await vehicleSearch(
                    interaction,
                    interaction.user,
                    interaction.guild,
                    embedColor,
                    searchTerm,
                    brandTerm,
                    browseBrands
                );
            });
    },
};
