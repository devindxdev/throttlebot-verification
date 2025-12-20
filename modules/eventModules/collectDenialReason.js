const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

/**
 * Presents a modal to collect a denial reason.
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<string|null>} reason or null if timed out/cancelled
 */
async function collectDenialReason(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('denyReasonModal')
        .setTitle('Denial Reason');

    const reasonInput = new TextInputBuilder()
        .setCustomId('deny_reason')
        .setLabel('Why are you denying this application?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

    await interaction.showModal(modal);

    try {
        const submitted = await interaction.awaitModalSubmit({
            time: 60_000,
            filter: (i) => i.user.id === interaction.user.id && i.customId === 'denyReasonModal',
        });

        const reason = submitted.fields.getTextInputValue('deny_reason')?.trim() || 'No reason provided';
        await submitted.deferUpdate(); // acknowledge the modal submit
        return reason;
    } catch (err) {
        return null; // timeout or error; caller should handle
    }
}

module.exports = { collectDenialReason };
