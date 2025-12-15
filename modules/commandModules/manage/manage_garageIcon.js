const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    LabelBuilder,
    FileUploadBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const userProfileSchema = require('../../../mongodb_schema/userProfileSchema.js');
const { errorEmbed } = require('../../utility.js');
const { garageIconExample } = require('../../constants.js');
const { backGlobal } = require('./options/backGlobal.js');
const { exitGlobal } = require('./options/exitGlobal.js');

async function manageGarageIcon(
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
    const userId = userData.id;
    const guildId = guildData.id;
    const vehicleName = selectedVehicleData.vehicle;
    const verificationImage = selectedVehicleData.verificationImageLink || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const mainInteractionId = interaction.id;
    const footerIcon = footerData.icon;
    const footerText = footerData.text;

    const buttonFilter = (btn) => btn.user.id === initiatorId && btn.guild.id === guildId;
    const modalFilter = (modalInteraction) => modalInteraction.customId === `setGarageIconModal+${mainInteractionId}` && modalInteraction.user.id === initiatorId;

    let userProfile;
    try {
        userProfile = await userProfileSchema.findOne({ userId }).lean();
    } catch (err) {
        console.error('Failed to retrieve the user profile for manageGarageIcon:', err);
        await interaction.editReply({
            embeds: [errorEmbed('Failed to retrieve the user profile. Please try again later.', initiatorAvatar)],
            components: []
        });
        return;
    }

    let garageIcon = userProfile?.garageThumbnail || null;

    const manageGarageIconEmbed = new EmbedBuilder()
        .setAuthor({
            name: 'Management Dashboard - Garage Icon',
            iconURL: initiatorAvatar
        })
        .setDescription('Use the options below to set or reset the garage icon for this user.')
        .setColor(embedColor)
        .addFields(
            { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
            { name: 'Owner', value: userTag, inline: true },
            { name: 'Current Icon', value: garageIcon ? `[View Icon](${garageIcon})` : 'Not set' }
        )
        .setImage(garageIcon || garageIconExample)
        .setFooter({
            text: footerText,
            iconURL: footerIcon
        });

    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`setGarageIcon+${mainInteractionId}`)
            .setLabel('Set Icon')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`resetGarageIcon+${mainInteractionId}`)
            .setLabel('Reset')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!garageIcon),
        new ButtonBuilder()
            .setCustomId(`backGarageIcon+${mainInteractionId}`)
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`exitGarageIcon+${mainInteractionId}`)
            .setLabel('Exit')
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
        embeds: [manageGarageIconEmbed],
        components: [buttonsRow]
    });

    const buttonCollector = interaction.channel.createMessageComponentCollector({
        filter: buttonFilter,
        componentType: ComponentType.Button,
        time: 60000
    });

    buttonCollector.on('collect', async (collected) => {
        const buttonId = collected.customId;

        if (buttonId === `setGarageIcon+${mainInteractionId}`) {
            // Discord file uploads arrive as a FileUpload component collection. Map them to the
            // familiar Attachment API for validation + persistence.
            const fileUpload = new FileUploadBuilder()
                .setCustomId('garageIconUpload')
                .setMinValues(1)
                .setMaxValues(1)
                .setRequired(true);

            const uploadLabel = new LabelBuilder()
                .setLabel('Garage Icon Upload')
                .setDescription('Upload an image (png/jpg/gif/webp) under 8MB.')
                .setFileUploadComponent(fileUpload);

            const modal = new ModalBuilder()
                .setCustomId(`setGarageIconModal+${mainInteractionId}`)
                .setTitle('Set Garage Icon')
                .addLabelComponents(uploadLabel);

            await collected.showModal(modal);

            let modalSubmission;
            try {
                modalSubmission = await interaction.awaitModalSubmit({
                    filter: modalFilter,
                    time: 60000
                });
            } catch (err) {
                console.error('No modal submission received for garage icon upload:', err);
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true
                });
                buttonCollector.stop('timeout');
                return;
            }
        
            const uploadedFiles = modalSubmission.fields.getUploadedFiles('garageIconUpload');
            const uploadedFile = uploadedFiles?.values().next().value;
            console.log(uploadedFile);

            if (!uploadedFile) {
                console.warn('Garage icon modal submitted without an attachment.');
                await modalSubmission.reply({
                    embeds: [errorEmbed('No file was uploaded. Please try again.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            const iconUrl = uploadedFile.url;
            const fileSize = uploadedFile.size ?? 0;
            const mimeType = uploadedFile.contentType?.toLowerCase() ?? '';
            const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
            const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

            const extensionMatch = iconUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
            const isMimeValid = mimeType ? allowedMimeTypes.includes(mimeType) : true;
            const isExtensionValid = allowedExtensions.includes(extensionMatch);

            if ((!mimeType && !isExtensionValid) || (mimeType && !isMimeValid)) {
                console.warn('Garage icon upload rejected due to invalid type:', { mimeType, extensionMatch });
                await modalSubmission.reply({
                    embeds: [errorEmbed('The uploaded file must be an image (png/jpg/gif/webp).', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            if (fileSize > 8_000_000) {
                console.warn('Garage icon upload rejected due to size limit:', fileSize);
                await modalSubmission.reply({
                    embeds: [errorEmbed('The uploaded file exceeds 8MB. Please upload a smaller image.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            try {
                if (userProfile) {
                    await userProfileSchema.updateOne(
                        { userId },
                        { $set: { garageThumbnail: iconUrl } }
                    );
                } else {
                    await userProfileSchema.create({
                        _id: new mongoose.Types.ObjectId(),
                        userId,
                        premiumUser: false,
                        premiumTier: 0,
                        embedColor: null,
                        garageThumbnail: iconUrl
                    });
                    userProfile = { userId, garageThumbnail: iconUrl };
                }
            } catch (err) {
                console.error('Failed to update garage icon in database:', err);
                await modalSubmission.reply({
                    embeds: [errorEmbed('Failed to update the garage icon. Please try again later.', initiatorAvatar)],
                    ephemeral: true
                });
                buttonCollector.stop('error');
                return;
            }

            garageIcon = iconUrl;

            const confirmationEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Garage Icon Updated',
                    iconURL: initiatorAvatar
                })
                .setDescription('The garage icon has been updated successfully.')
                .setColor('#77DD77')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true },
                    { name: 'Icon', value: `[View Icon](${iconUrl})` }
                )
                .setImage(iconUrl)
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            const logEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Garage Icon Updated',
                    iconURL: initiatorAvatar
                })
                .setDescription(`${initiatorData.tag} updated the garage icon for ${userTag}.`)
                .setColor('#77DD77')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true }
                )
                .setImage(iconUrl)
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            await logChannel.send({ embeds: [logEmbed] }).catch((err) => {
                console.error('Failed to send garage icon update log:', err);
            });

            await modalSubmission.update({
                embeds: [confirmationEmbed],
                components: []
            });

            buttonCollector.stop('submitted');
            return;
        }

        if (buttonId === `resetGarageIcon+${mainInteractionId}`) {
            await collected.deferUpdate();

            if (!garageIcon) {
                await interaction.followUp({
                    embeds: [errorEmbed('This user does not have a garage icon to reset.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            try {
                await userProfileSchema.updateOne(
                    { userId },
                    { $set: { garageThumbnail: '' } }
                );
            } catch (err) {
                console.error('Failed to reset garage icon:', err);
                await interaction.followUp({
                    embeds: [errorEmbed('Failed to reset the garage icon. Please try again later.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            garageIcon = null;

            const resetEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Garage Icon Cleared',
                    iconURL: initiatorAvatar
                })
                .setDescription('The garage icon has been removed successfully.')
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
                    name: 'Garage Icon Cleared',
                    iconURL: initiatorAvatar
                })
                .setDescription(`${initiatorData.tag} cleared the garage icon for ${userTag}.`)
                .setColor('#FF6961')
                .addFields(
                    { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                    { name: 'Owner', value: userTag, inline: true }
                )
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            await logChannel.send({ embeds: [logEmbed] }).catch((err) => {
                console.error('Failed to send garage icon reset log:', err);
            });

            await interaction.editReply({
                embeds: [resetEmbed],
                components: []
            });

            buttonCollector.stop('reset');
            return;
        }

        if (buttonId === `backGarageIcon+${mainInteractionId}`) {
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

        if (buttonId === `exitGarageIcon+${mainInteractionId}`) {
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
    manageGarageIcon
};
