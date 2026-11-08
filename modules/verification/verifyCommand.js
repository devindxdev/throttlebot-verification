const { SlashCommandBuilder } = require('discord.js');

function buildVerifyCommand() {
    return new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Apply for verification of your vehicle.')
        .addStringOption(option => option.setName('vehicle').setDescription('Enter the name of your vehicle.').setRequired(true))
        .addAttachmentOption(option => option
            .setName('media')
            .setDescription('Upload your verification video, or a photo if your server allows it.')
            .setRequired(true));
}

module.exports = { buildVerifyCommand };
