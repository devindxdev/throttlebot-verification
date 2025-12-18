const { SlashCommandBuilder } = require('@discordjs/builders');
const settingsController = require('../modules/commandModules/settings/controller.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure your garage images, descriptions, icons, and embed colors.'),
    async execute(interaction) {
        await settingsController(interaction);
    },
};
