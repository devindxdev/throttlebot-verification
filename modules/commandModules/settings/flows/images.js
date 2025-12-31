const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    ModalBuilder,
    LabelBuilder,
    FileUploadBuilder,
} = require('discord.js');
const { errorEmbed } = require('../../../utility.js');
const { saveVehicleImages } = require('../../manage/services/vehicleService.js');

    /**
     * Handles the Images settings flow: review, upload, and remove vehicle images.
     */
module.exports = async function imagesFlow(triggerInteraction, ctx) {
    const { interaction, initiator, guild, embedColor, footer, selectedVehicle, logChannel } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const guildName = guild.name;

    let vehicleImages = Array.isArray(selectedVehicle.vehicleImages)
        ? [...selectedVehicle.vehicleImages]
        : [];
    let currentIndex = 0;
    const mainInteractionId = interaction.id;

    const buildEmbed = () => {
        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Garage Settings - Images', iconURL: initiatorAvatar })
            .setColor(embedColor)
            .addFields(
                { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                { name: 'Owner', value: initiator.tag, inline: true }
            )
            .setFooter({
                text:
                    vehicleImages.length > 0
                        ? `${guildName} • Image ${currentIndex + 1} of ${vehicleImages.length}`
                        : `${guildName} • No Images`,
                iconURL: footer.icon,
            });

        if (vehicleImages.length > 0) {
            embed.setImage(vehicleImages[currentIndex]);
        } else {
            embed.setDescription('No images are associated with this vehicle.');
        }

        return embed;
    };

    const buildRow = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`settingsImgPrev+${mainInteractionId}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(vehicleImages.length <= 1 || currentIndex === 0),
            new ButtonBuilder()
                .setCustomId(`settingsImgNext+${mainInteractionId}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(vehicleImages.length <= 1 || currentIndex === vehicleImages.length - 1),
            new ButtonBuilder()
                .setCustomId(`settingsImgUpload+${mainInteractionId}`)
                .setLabel('Upload Image')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`settingsImgRemove+${mainInteractionId}`)
                .setLabel('Remove Image')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(vehicleImages.length === 0),
            new ButtonBuilder()
                .setCustomId(`settingsImgExit+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({ embeds: [buildEmbed()], components: [buildRow()] });

    const settingsMessage = await interaction.fetchReply().catch(() => null);

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) =>
            i.user.id === initiator.id &&
            (!settingsMessage || i.message.id === settingsMessage.id),
        time: 120000,
    });

    collector.on('collect', async (btn) => {
        const id = btn.customId;

        if (id === `settingsImgPrev+${mainInteractionId}`) {
            if (currentIndex > 0) currentIndex -= 1;
            await btn.update({ embeds: [buildEmbed()], components: [buildRow()] });
            return;
        }
        if (id === `settingsImgNext+${mainInteractionId}`) {
            if (currentIndex < vehicleImages.length - 1) currentIndex += 1;
            await btn.update({ embeds: [buildEmbed()], components: [buildRow()] });
            return;
        }
       if (id === `settingsImgRemove+${mainInteractionId}`) {
           if (vehicleImages.length === 0) {
               await btn.reply({ embeds: [errorEmbed('No images to remove.', initiatorAvatar)], ephemeral: true });
               return;
           }

            const removed = vehicleImages.splice(currentIndex, 1)[0];
            try {
                await saveVehicleImages({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    images: vehicleImages,
                });
            } catch (err) {
                console.error('Failed to remove image in settings flow:', err);
                vehicleImages.splice(currentIndex, 0, removed);
                await btn.reply({ embeds: [errorEmbed('Failed to remove the image. Try again later.', initiatorAvatar)], ephemeral: true });
                return;
            }

            if (vehicleImages.length === 0) {
                currentIndex = 0;
            } else if (currentIndex >= vehicleImages.length) {
                currentIndex = vehicleImages.length - 1;
            }

            selectedVehicle.vehicleImages = [...vehicleImages];

            const logEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Image Removed', iconURL: initiatorAvatar })
                .setColor('#FF6961')
                .setDescription(`${initiator.tag} removed an image from their vehicle.`)
                .addFields(
                    { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                    { name: 'Removed Image', value: removed ? `[View Image](${removed})` : 'Unknown' }
                )
                .setFooter({ text: footer.text, iconURL: footer.icon });

           await logChannel.send({ embeds: [logEmbed] }).catch((err) => {
               console.error('Failed to log image removal from settings:', err);
           });

           await btn.update({ embeds: [buildEmbed()], components: [buildRow()] });
           return;
       }
        if (id === `settingsImgUpload+${mainInteractionId}`) {
            const uploadComponent = new FileUploadBuilder()
                .setCustomId('settingsVehicleImageUpload')
                .setMinValues(1)
                .setMaxValues(1)
                .setRequired(true);

            const uploadLabel = new LabelBuilder()
                .setLabel('Upload an image (png/jpg/gif/webp) under 8MB.')
                .setFileUploadComponent(uploadComponent);

            const modal = new ModalBuilder()
                .setCustomId(`settingsImgUploadModal+${mainInteractionId}`)
                .setTitle('Upload Vehicle Image')
                .addLabelComponents(uploadLabel);

            await btn.showModal(modal);

            let submission;
            try {
                submission = await interaction.awaitModalSubmit({
                    filter: (m) =>
                        m.customId === `settingsImgUploadModal+${mainInteractionId}` &&
                        m.user.id === initiator.id,
                    time: 60000,
                });
            } catch (err) {
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true,
                });
                collector.stop('timeout');
                return;
            }

            const uploadedFiles = submission.fields.getUploadedFiles('settingsVehicleImageUpload');
            const uploadedFile = uploadedFiles?.values().next().value;

            if (!uploadedFile) {
                await submission.reply({
                    embeds: [errorEmbed('No file was uploaded. Please try again.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }
            console.log(uploadedFile)
            const iconUrl = uploadedFile.url;
            const fileSize = uploadedFile.size ?? 0;
            const mimeType = uploadedFile.contentType?.toLowerCase() ?? '';
            const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
            const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
            const extensionMatch = iconUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
            const isMimeValid = mimeType ? allowedMimeTypes.includes(mimeType) : true;
            const isExtensionValid = allowedExtensions.includes(extensionMatch);

            if ((!mimeType && !isExtensionValid) || (mimeType && !isMimeValid)) {
                await submission.reply({
                    embeds: [errorEmbed('The uploaded file must be an image (png/jpg/gif/webp).', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            if (fileSize > 8_000_000) {
                await submission.reply({
                    embeds: [errorEmbed('The uploaded file exceeds 8MB. Please upload a smaller image.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            const insertIndex = vehicleImages.length === 0 ? 0 : currentIndex + 1;
            if (!logChannel) {
                await submission.reply({
                    embeds: [errorEmbed('Image uploads are unavailable because the log channel is not configured.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            let storedUrl = iconUrl;
            try {
                const uploadName = uploadedFile.name || `vehicle-image.${extensionMatch || 'png'}`;
                const uploadMessage = await logChannel.send({
                    files: [{ attachment: iconUrl, name: uploadName }],
                });
                const uploadedAttachment = uploadMessage.attachments.first();
                if (uploadedAttachment?.url) {
                    storedUrl = uploadedAttachment.url;
                }
            } catch (err) {
                await submission.reply({
                    embeds: [errorEmbed('Failed to store the image. Please try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            vehicleImages.splice(insertIndex, 0, storedUrl);
            try {
                await saveVehicleImages({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    images: vehicleImages,
                });
            } catch (err) {
                vehicleImages.splice(insertIndex, 1);
                await submission.reply({
                    embeds: [errorEmbed('Failed to save the image. Please try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            currentIndex = insertIndex;
            selectedVehicle.vehicleImages = [...vehicleImages];

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Image Uploaded', iconURL: initiatorAvatar })
                .setDescription('Your image has been uploaded successfully.')
                .addFields(
                    { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                    { name: 'Owner', value: initiator.tag, inline: true },
                    { name: 'Image', value: `[View Image](${storedUrl})` }
                )
                .setImage(storedUrl)
                .setColor('#77DD77')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel.send({ embeds: [successEmbed.setDescription(`${initiator.tag} uploaded a vehicle image.`)] }).catch(() => {});

            await submission.update({
                embeds: [buildEmbed()],
                components: [buildRow()],
            });
            return;
        }
        if (id === `settingsImgExit+${mainInteractionId}`) {
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
