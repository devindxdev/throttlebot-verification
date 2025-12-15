const { 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');
const { errorEmbed } = require('../../utility.js');
const { exitGlobal } = require('./options/exitGlobal.js');
const { backGlobal } = require('./options/backGlobal.js');

async function manageDescription(
    interaction,
    initiatorData, 
    userData,
    guildData,
    embedColor,
    footerData,
    garageData,
    selectedVehicleData,
    logChannel
){
    const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
    const initiatorId = initiatorData.id;

    const userTag = userData.tag;

    const guildId = guildData.id;

    const vehicleName = selectedVehicleData.vehicle;
    const verificationImage = selectedVehicleData.verificationImageLink || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    let vehicleDescription = selectedVehicleData.vehicleDescription;

    const mainInteractionId = interaction.id;
    const footerIcon = footerData.icon;
    const footerText = footerData.text;

    const buttonFilter = (btn) => btn.user.id === initiatorId && btn.guild.id === guildId;
    const modalFilter = (modalInteraction) => modalInteraction.customId === `setDescriptionModal+${mainInteractionId}` && modalInteraction.user.id === initiatorId;

    const descriptionPreview = vehicleDescription
        ? (vehicleDescription.length > 1024 ? `${vehicleDescription.slice(0, 1021)}...` : vehicleDescription)
        : 'No description has been set for this vehicle.';

    const buildDashboardEmbed = () =>
        new EmbedBuilder()
            .setAuthor({
                name: 'Management Dashboard - Vehicle Description',
                iconURL: initiatorAvatar
            })
            .setDescription('Use the options below to set or reset the vehicle description.')
            .setColor(embedColor)
            .addFields(
                { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                { name: 'Owner', value: userTag, inline: true },
                { name: 'Current Description', value: descriptionPreview }
            )
            .setFooter({
                text: footerText,
                iconURL: footerIcon
            });

    const buildControls = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`setDescription+${mainInteractionId}`)
                .setLabel('Set Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`resetDescription+${mainInteractionId}`)
                .setLabel('Reset')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!vehicleDescription),
            new ButtonBuilder()
                .setCustomId(`backDescription+${mainInteractionId}`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`exitDescription+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.editReply({
        embeds: [buildDashboardEmbed()],
        components: [buildControls()]
    });

    const buttonCollector = interaction.channel.createMessageComponentCollector({
        filter: buttonFilter,
        componentType: ComponentType.Button,
        time: 60000
    });

    buttonCollector.on('collect', async (collected) => {
        const buttonId = collected.customId;

        if (buttonId === `setDescription+${mainInteractionId}`) {
            const modal = new ModalBuilder()
                .setCustomId(`setDescriptionModal+${mainInteractionId}`)
                .setTitle('Update Vehicle Description')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('vehicleDescriptionInput')
                            .setLabel('Vehicle Description')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMinLength(30)
                            .setMaxLength(600)
                            .setRequired(true)
                            .setPlaceholder('Provide the description you would like to assign to this vehicle.')
                            .setValue(vehicleDescription ? vehicleDescription.slice(0, 600) : '')
                    )
                );

            await collected.showModal(modal);

            let modalSubmission;
            try {
                modalSubmission = await interaction.awaitModalSubmit({
                    filter: modalFilter,
                    time: 60000
                });
            } catch (err) {
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true
                });
                buttonCollector.stop('timeout');
                return;
            }

            const providedDescription = modalSubmission.fields.getTextInputValue('vehicleDescriptionInput').trim();
            if (!providedDescription) {
                await modalSubmission.reply({
                    embeds: [errorEmbed('The provided description cannot be empty.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            try {
                await garageSchema.updateOne(
                    { guildId, userId: userData.id, vehicle: vehicleName },
                    { $set: { vehicleDescription: providedDescription } }
                );
            } catch (err) {
                await modalSubmission.reply({
                    embeds: [errorEmbed('Failed to update the description. Please try again later.', initiatorAvatar)],
                    ephemeral: true
                });
                buttonCollector.stop('error');
                return;
            }

            vehicleDescription = providedDescription;
            selectedVehicleData.vehicleDescription = providedDescription;

            const confirmationEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Vehicle Description Updated',
                    iconURL: initiatorAvatar
                })
                .setDescription('The vehicle description has been updated successfully.')
                .setColor('#77DD77')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true },
                    { name: 'Description', value: providedDescription }
                )
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            const logEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Vehicle Description Updated',
                    iconURL: initiatorAvatar
                })
                .setDescription(`A new description has been set by ${initiatorData.tag} for the vehicle below.`)
                .setColor('#77DD77')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true },
                    { name: 'Description', value: providedDescription }
                )
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});

            await modalSubmission.update({
                embeds: [confirmationEmbed],
                components: []
            });

            buttonCollector.stop('submitted');
            return;
        }

        if (buttonId === `resetDescription+${mainInteractionId}`) {
            await collected.deferUpdate();

            if (!vehicleDescription) {
                await interaction.followUp({
                    embeds: [errorEmbed('This vehicle does not have a description to reset.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            try {
                await garageSchema.updateOne(
                    { guildId, userId: userData.id, vehicle: vehicleName },
                    { $set: { vehicleDescription: null } }
                );
            } catch (err) {
                await interaction.followUp({
                    embeds: [errorEmbed('Failed to reset the description. Please try again later.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            vehicleDescription = null;
            selectedVehicleData.vehicleDescription = null;

            const resetEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Vehicle Description Cleared',
                    iconURL: initiatorAvatar
                })
                .setDescription('The vehicle description has been removed successfully.')
                .setColor('#FF6961')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true }
                )
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            const logEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Vehicle Description Cleared',
                    iconURL: initiatorAvatar
                })
                .setDescription(`The description for the vehicle below was cleared by ${initiatorData.tag}.`)
                .setColor('#FF6961')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true }
                )
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});

            await interaction.editReply({
                embeds: [resetEmbed],
                components: []
            });

            buttonCollector.stop('reset');
            return;
        }

        if (buttonId === `backDescription+${mainInteractionId}`) {
            await collected.deferUpdate();
            buttonCollector.stop('back');
            backGlobal(
                interaction,
                initiatorData, 
                userData,
                guildData,
                embedColor,
                footerData,
                garageData,
                selectedVehicleData
            );
            return;
        }

        if (buttonId === `exitDescription+${mainInteractionId}`) {
            await collected.deferUpdate();
            buttonCollector.stop('exit');
            exitGlobal(interaction);
        }
    });

    buttonCollector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
            await interaction.deleteReply().catch(() => {});
        }
    });
};

module.exports = { 
    manageDescription
};
