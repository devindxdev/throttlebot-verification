const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { errorEmbed } = require('../../../utility.js');
const { updateEmbedColor } = require('../../manage/services/profileService.js');
const isHexColor = require('validate.io-color-hexadecimal');

/**
 * Handles the Embed Color settings flow: set or reset the user's preferred embed color.
 */
module.exports = async function embedColorFlow(triggerInteraction, ctx) {
    const { interaction, initiator, embedColor, footer } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const mainInteractionId = interaction.id;
    const modalFilter = (modalInteraction) =>
        modalInteraction.customId === `settingsEmbedColorModal+${mainInteractionId}` &&
        modalInteraction.user.id === initiator.id;

    const buildEmbed = () =>
        new EmbedBuilder()
            .setAuthor({ name: 'Garage Settings - Embed Color', iconURL: initiatorAvatar })
            .setDescription('Customize the embed color used in your interactions.')
            .setColor(embedColor)
            .addFields({ name: 'Current Color', value: embedColor || '#FFFCFF' })
            .setFooter({ text: footer.text, iconURL: footer.icon });

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`settingsEmbedColorSet+${mainInteractionId}`)
            .setLabel('Set Color')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`settingsEmbedColorReset+${mainInteractionId}`)
            .setLabel('Reset')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`settingsEmbedColorExit+${mainInteractionId}`)
            .setLabel('Exit')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [buildEmbed()], components: [controls] });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === initiator.id,
        time: 120000,
    });

    collector.on('collect', async (btn) => {
        const id = btn.customId;

        if (id === `settingsEmbedColorSet+${mainInteractionId}`) {
            const modal = new ModalBuilder()
                .setCustomId(`settingsEmbedColorModal+${mainInteractionId}`)
                .setTitle('Set Embed Color')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('embedColorInput')
                            .setLabel('Hex Color (e.g. #FF0000)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(7)
                            .setValue(embedColor || '#FFFCFF')
                    )
                );

            await btn.showModal(modal);

            let submission;
            try {
                submission = await interaction.awaitModalSubmit({ filter: modalFilter, time: 60000 });
            } catch (err) {
                await interaction.followUp({ embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)], ephemeral: true });
                collector.stop('timeout');
                return;
            }

            const color = submission.fields.getTextInputValue('embedColorInput').trim();
            if (!isHexColor(color)) {
                await submission.reply({ embeds: [errorEmbed('Please provide a valid hex color (e.g. #FF0000).', initiatorAvatar)], ephemeral: true });
                return;
            }

            try {
                await updateEmbedColor(initiator.id, color);
            } catch (err) {
                await submission.reply({ embeds: [errorEmbed('Failed to update embed color. Try again later.', initiatorAvatar)], ephemeral: true });
                return;
            }

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Embed Color Updated', iconURL: initiatorAvatar })
                .setDescription('Your embed color has been updated successfully.')
                .addFields({ name: 'New Color', value: color })
                .setColor(color)
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await submission.update({ embeds: [successEmbed], components: [] });
            collector.stop('submitted');
            return;
        }

        if (id === `settingsEmbedColorReset+${mainInteractionId}`) {
            try {
                await updateEmbedColor(initiator.id, null);
            } catch (err) {
                await btn.reply({ embeds: [errorEmbed('Failed to reset embed color.', initiatorAvatar)], ephemeral: true });
                return;
            }

            const resetEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Embed Color Reset', iconURL: initiatorAvatar })
                .setDescription('Your embed color has been reset to the default.')
                .setColor('#FFFCFF')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await btn.update({ embeds: [resetEmbed], components: [] });
            collector.stop('reset');
            return;
        }

        if (id === `settingsEmbedColorExit+${mainInteractionId}`) {
            await btn.deferUpdate();
            collector.stop('exit');
            await interaction.deleteReply().catch(() => {});
        }
    });

    collector.on('end', async (_c, reason) => {
        if (reason === 'time') {
            await interaction.deleteReply().catch(() => {});
        }
    });
};
