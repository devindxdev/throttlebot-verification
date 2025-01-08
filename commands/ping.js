const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong and latency information!'),
    async execute(interaction) {
        // Record the current timestamp
        const startTimestamp = Date.now();

        // Send a temporary "Pinging..." message and fetch it
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });

        // Calculate latencies
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiPing = Math.round(interaction.client.ws.ping);

        // Create an embed with latency details
        const pingEmbed = new EmbedBuilder()
            .setTitle('🏓 - Pong!')
            .setDescription('Here are the latency details:')
            .addFields(
                { name: 'Bot Latency', value: `\`${latency}ms\``, inline: true },
                { name: 'API Latency', value: `\`${apiPing}ms\``, inline: true }
            )
            .setColor('#FFFCFF') // A soft white color

        // Edit the initial reply to include the embed
        await interaction.editReply({ content: null, embeds: [pingEmbed] });
    },
};
