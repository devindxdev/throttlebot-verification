const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ComponentType,
} = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { errorEmbed } = require('../../utility.js');
const { greenIndicator } = require('../../constants.js');

module.exports = async (interaction, guildProfile) => {
    try {
        // Defer the interaction to allow for processing
        
        // Create and display the modal for user input
        const modal = new ModalBuilder()
            .setCustomId('embed_footer_icon_modal')
            .setTitle('Set Embed Footer Icon');

        const inputField = new TextInputBuilder()
            .setCustomId('icon_url_input')
            .setLabel('Provide a valid image or GIF URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://example.com/icon.png')
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(inputField);

        modal.addComponents(actionRow);

        await interaction.showModal(modal);

        // Await modal submission
        const modalSubmission = await interaction.awaitModalSubmit({
            filter: (i) => i.customId === 'embed_footer_icon_modal' && i.user.id === interaction.user.id,
            time: 60000,
        });

        // Extract user input
        const iconUrl = modalSubmission.fields.getTextInputValue('icon_url_input');

        // Validate the URL
        if (!iconUrl.startsWith('http') || !iconUrl.match(/\.(jpeg|jpg|png|gif)$/i)) {
            throw new Error('The provided URL is invalid or not a supported image format. Please try again.');
        }

        // Update the database
        await guildProfileSchema.updateOne(
            { guildId: guildProfile.guildId },
            { $set: { customFooterIcon: iconUrl } }
        );

        // Send a confirmation embed
        const confirmationEmbed = new EmbedBuilder()
            .setTitle('Embed Footer Icon Set')
            .setDescription(
                `The embed footer icon has been successfully updated.\n\n` +
                `[View Icon](${iconUrl})`
            )
            .setImage(iconUrl)
            .setColor('#77DD77');

        await modalSubmission.reply({ embeds: [confirmationEmbed], ephemeral: true });

    } catch (error) {
        console.error('Error in handleEmbedFooterIcon:', error);

        // Handle errors gracefully
        if (interaction.replied || interaction.deferred) {
            const { embed, components } = errorEmbed(
                error.message,
                interaction.user.displayAvatarURL({ dynamic: true }),
                null, // No example
                interaction.client.user.displayAvatarURL({ dynamic: true }),
                'Ensure the URL is valid and try again.',
                true // Include Support Server button
            );W

            await interaction.followUp({ embeds: [embed], components, ephemeral: true });
        }
    }
};
