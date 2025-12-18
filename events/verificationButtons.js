const { InteractionType } = require('discord.js');
const { errorEmbed } = require('../modules/utility.js');
const handleApproval = require('../modules/eventModules/handleApproval.js');
const handleDenial = require('../modules/eventModules/handleDenial.js');
const handleGuideDenial = require('../modules/eventModules/handleGuideDenial.js');

module.exports = {
    name: 'interactionCreate',
    /**
     * Handles button interactions for verification actions.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        if (interaction.type !== InteractionType.MessageComponent || !interaction.isButton()) return;
        const action = interaction.customId;

        // Supported actions
        const supportedActions = ['approveApplication', 'denyApplication', 'denyReadGuide', 'autoOverrideDeny', 'autoOverrideApprove'];

        // Ignore interactions that aren't verification-related
        if (!supportedActions.includes(action)) return;

        try {
            // Defer the interaction to prevent timeout
            await interaction.deferUpdate();

            // Route the action to its corresponding handler
            switch (action) {
                case 'approveApplication':
                    await handleApproval(interaction);
                    break;

                case 'denyApplication':
                    await handleDenial(interaction);
                    break;

                case 'denyReadGuide':
                    await handleGuideDenial(interaction);
                    break;
                case 'autoOverrideDeny':
                    const handleOverrideDeny = require('../modules/eventModules/handleOverrideDeny.js');
                    await handleOverrideDeny(interaction);
                    break;
                case 'autoOverrideApprove':
                    const handleOverrideApprove = require('../modules/eventModules/handleOverrideApprove.js');
                    await handleOverrideApprove(interaction);
                    break;

                default:
                    await interaction.followUp({
                        embeds: [errorEmbed('Unknown action triggered. Please contact the administrator.')],
                        ephemeral: true,
                    });
                    break;
            }
        } catch (error) {
            console.error(`Error handling verification button interaction: ${error.message}`);

            // Send an error message to the user
            await interaction.followUp({
                embeds: [errorEmbed('An error occurred while processing your request. Please try again.')],
                ephemeral: true,
            });
        }
    },
};
