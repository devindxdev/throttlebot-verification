module.exports = async (interaction) => {
    try {
        // Defer the update to prevent timeout issues
        await interaction.deferUpdate();

        // Delete the interaction message
        await interaction.deleteReply();
    } catch (error) {
        console.error('Error in exitSetup:', error);
        throw new Error('Failed to delete the setup message.');
    }
};
