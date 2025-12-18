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
const { updateVehicleDescription, clearVehicleDescription } = require('../../manage/services/vehicleService.js');

/**
 * Handles the Description settings flow: set or clear a vehicle description.
 */
module.exports = async function descriptionFlow(triggerInteraction, ctx) {
    const { interaction, initiator, guild, embedColor, footer, selectedVehicle, logChannel } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const mainInteractionId = interaction.id;
    const modalFilter = (modalInteraction) =>
        modalInteraction.customId === `settingsDescriptionModal+${mainInteractionId}` &&
        modalInteraction.user.id === initiator.id;

    const buildEmbed = () =>
        new EmbedBuilder()
            .setAuthor({ name: 'Garage Settings - Description', iconURL: initiatorAvatar })
            .setDescription('Set or clear the description for this vehicle.')
            .addFields(
                { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                { name: 'Owner', value: initiator.tag, inline: true },
                {
                    name: 'Current Description',
                    value: selectedVehicle.vehicleDescription || 'No description set.',
                }
            )
            .setColor(embedColor)
            .setFooter({ text: footer.text, iconURL: footer.icon });

    const buildControls = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`settingsDescSet+${mainInteractionId}`)
                .setLabel('Set Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`settingsDescReset+${mainInteractionId}`)
                .setLabel('Reset')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!selectedVehicle.vehicleDescription),
            new ButtonBuilder()
                .setCustomId(`settingsDescExit+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({ embeds: [buildEmbed()], components: [buildControls()] });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === initiator.id,
        time: 120000,
    });

    collector.on('collect', async (btn) => {
        const id = btn.customId;

        if (id === `settingsDescSet+${mainInteractionId}`) {
            const modal = new ModalBuilder()
                .setCustomId(`settingsDescriptionModal+${mainInteractionId}`)
                .setTitle('Update Description')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('vehicleDescriptionInput')
                            .setLabel('Vehicle Description (30-600 chars)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMinLength(30)
                            .setMaxLength(600)
                            .setRequired(true)
                            .setValue(selectedVehicle.vehicleDescription || '')
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

            const description = submission.fields.getTextInputValue('vehicleDescriptionInput').trim();
            if (!description) {
                await submission.reply({ embeds: [errorEmbed('Description cannot be empty.', initiatorAvatar)], ephemeral: true });
                return;
            }

            try {
                await updateVehicleDescription({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    description,
                });
            } catch (err) {
                await submission.reply({ embeds: [errorEmbed('Failed to update the description. Try again later.', initiatorAvatar)], ephemeral: true });
                return;
            }

            selectedVehicle.vehicleDescription = description;

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Description Updated', iconURL: initiatorAvatar })
                .setDescription('The vehicle description has been updated successfully.')
                .addFields(
                    { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                    { name: 'Owner', value: initiator.tag, inline: true },
                    { name: 'Description', value: description }
                )
                .setColor('#77DD77')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [successEmbed.setDescription(`${initiator.tag} updated a vehicle description.`)] })
                .catch(() => {});

            await submission.update({ embeds: [successEmbed], components: [] });
            collector.stop('submitted');
            return;
        }

        if (id === `settingsDescReset+${mainInteractionId}`) {
            if (!selectedVehicle.vehicleDescription) {
                await btn.reply({ embeds: [errorEmbed('This vehicle does not have a description to reset.', initiatorAvatar)], ephemeral: true });
                return;
            }

            try {
                await clearVehicleDescription({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                });
            } catch (err) {
                await btn.reply({ embeds: [errorEmbed('Failed to reset the description. Try again later.', initiatorAvatar)], ephemeral: true });
                return;
            }

            selectedVehicle.vehicleDescription = null;

            const resetEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Description Cleared', iconURL: initiatorAvatar })
                .setDescription('The vehicle description has been removed.')
                .addFields(
                    { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                    { name: 'Owner', value: initiator.tag, inline: true }
                )
                .setColor('#FF6961')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [resetEmbed.setDescription(`${initiator.tag} cleared a vehicle description.`)] })
                .catch(() => {});

            await btn.update({ embeds: [resetEmbed], components: [] });
            collector.stop('reset');
            return;
        }

        if (id === `settingsDescExit+${mainInteractionId}`) {
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
