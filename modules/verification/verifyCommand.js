const { SlashCommandBuilder } = require('discord.js');

function buildVerifyCommand({ videoOnly = false } = {}) {
    return new SlashCommandBuilder()
        .setName('verify')
        .setDescription(videoOnly ? 'Submit a video to verify ownership of your vehicle.' : 'Apply for verification of your vehicle.')
        .addStringOption(option => option.setName('vehicle').setDescription('Enter the name of your vehicle.').setRequired(true))
        .addAttachmentOption(option => option
            .setName(videoOnly ? 'video' : 'image')
            .setDescription(videoOnly ? 'Upload your video: say the server name and username, then show the vehicle starting with your keys.' : 'Upload verification evidence: a photo or video, as required by this server.')
            .setRequired(true));
}

module.exports = { buildVerifyCommand };
