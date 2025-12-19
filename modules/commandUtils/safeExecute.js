const { errorEmbed } = require('../utility.js');

/**
 * Wraps command execution with consistent error handling.
 * If an error occurs, it logs and replies/follows up with a standard error embed.
 */
async function safeExecute(interaction, handler) {
    try {
        await handler();
    } catch (err) {
        console.error('Command execution failed:', err);
        const avatar = interaction.user?.displayAvatarURL?.({ dynamic: true });
        const payload = {
            embeds: [errorEmbed('An unexpected error occurred while running this command.', avatar)],
            ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
}

module.exports = { safeExecute };
