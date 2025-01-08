const { errorEmbed } = require('../modules/utility.js'); // Adjust the path as needed

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		// Ignore non-command interactions
		if (!interaction.isCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		// If the command does not exist
		if (!command) {
			console.warn(`⚠️ Command "${interaction.commandName}" not found.`);
			return;
		}

		try {
			// Execute the command
			await command.execute(interaction);
		
		} catch (error) {
			console.error(`🔥 Error executing command "${interaction.commandName}":`, error);

			// Generate the error embed with the support button
			const { embed, components } = errorEmbed(
				'Something went wrong while executing the command.',
				interaction.user.displayAvatarURL({ dynamic: true }),
				null, // No example provided
				interaction.client.user.displayAvatarURL({ dynamic: true }),
				'Contact support if this issue persists.',
				true, // Include Support Server button
				
			);
			// Edit the deferred reply with the error embed
			try {
				await interaction.editReply({ embeds: [embed], components });
			} catch (editError) {
				// If editing the reply fails (e.g., interaction expired), send a fresh reply
				console.error(`🔥 Failed to edit deferred reply for "${interaction.commandName}":`, editError);
				await interaction.followUp({
					embeds: [embed],
					components,
					ephemeral: true,
				});
			}
		}
	},
};
