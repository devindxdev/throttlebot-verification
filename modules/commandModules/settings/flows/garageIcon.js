const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    LabelBuilder,
    FileUploadBuilder,
} = require('discord.js');
const { errorEmbed } = require('../../../utility.js');
const { garageIconExample } = require('../../../constants.js');
const { findProfile, upsertGarageIcon, clearGarageIcon } = require('../../manage/services/profileService.js');

/**
 * Handles the Garage Icon settings flow: set or clear a user's garage icon via file upload.
 */
module.exports = async function garageIconFlow(triggerInteraction, ctx) {
    const { interaction, initiator, embedColor, footer, logChannel } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const userId = initiator.id;
    const mainInteractionId = interaction.id;
    const modalFilter = (modalInteraction) =>
        modalInteraction.customId === `settingsGarageIconModal+${mainInteractionId}` &&
        modalInteraction.user.id === initiator.id;

    let profile;
    try {
        profile = await findProfile(userId);
    } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('Failed to load your profile.', initiatorAvatar)], components: [] });
        return;
    }

    let garageIcon = profile?.garageThumbnail || null;

    const buildEmbed = () =>
        new EmbedBuilder()
            .setAuthor({ name: 'Garage Settings - Garage Icon', iconURL: initiatorAvatar })
            .setDescription('Set or reset your global garage icon.')
            .setColor(embedColor)
            .addFields({ name: 'Current Icon', value: garageIcon ? `[View Icon](${garageIcon})` : 'Not set' })
            .setImage(garageIcon || garageIconExample)
            .setFooter({ text: footer.text, iconURL: footer.icon });

    const buildControls = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`settingsGarageIconSet+${mainInteractionId}`)
                .setLabel('Set Icon')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`settingsGarageIconReset+${mainInteractionId}`)
                .setLabel('Reset')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!garageIcon),
            new ButtonBuilder()
                .setCustomId(`settingsGarageIconExit+${mainInteractionId}`)
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

        if (id === `settingsGarageIconSet+${mainInteractionId}`) {
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
                .setCustomId(`settingsGarageIconModal+${mainInteractionId}`)
                .setTitle('Set Garage Icon')
                .addLabelComponents(uploadLabel);

            await btn.showModal(modal);

            let submission;
            try {
                submission = await interaction.awaitModalSubmit({ filter: modalFilter, time: 60000 });
            } catch (err) {
                await interaction.followUp({ embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)], ephemeral: true });
                collector.stop('timeout');
                return;
            }

            const uploadedFiles = submission.fields.getUploadedFiles('garageIconUpload');
            const uploadedFile = uploadedFiles?.values().next().value;
            if (!uploadedFile) {
                await submission.reply({ embeds: [errorEmbed('No file was uploaded. Please try again.', initiatorAvatar)], ephemeral: true });
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
                await submission.reply({ embeds: [errorEmbed('The uploaded file must be an image (png/jpg/gif/webp).', initiatorAvatar)], ephemeral: true });
                return;
            }

            if (fileSize > 8_000_000) {
                await submission.reply({ embeds: [errorEmbed('The uploaded file exceeds 8MB. Please upload a smaller image.', initiatorAvatar)], ephemeral: true });
                return;
            }

            try {
                await upsertGarageIcon(userId, iconUrl);
            } catch (err) {
                await submission.reply({ embeds: [errorEmbed('Failed to update the garage icon. Please try again later.', initiatorAvatar)], ephemeral: true });
                return;
            }

            garageIcon = iconUrl;
            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Garage Icon Updated', iconURL: initiatorAvatar })
                .setDescription('The garage icon has been updated successfully.')
                .setColor('#77DD77')
                .addFields({ name: 'Icon', value: `[View Icon](${iconUrl})` })
                .setImage(iconUrl)
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel.send({ embeds: [successEmbed.setDescription(`${initiator.tag} updated their garage icon.`)] }).catch(() => {});
            await submission.update({ embeds: [successEmbed], components: [] });
            collector.stop('submitted');
            return;
        }

        if (id === `settingsGarageIconReset+${mainInteractionId}`) {
            if (!garageIcon) {
                await btn.reply({ embeds: [errorEmbed('No garage icon is set to reset.', initiatorAvatar)], ephemeral: true });
                return;
            }

            try {
                await clearGarageIcon(userId);
            } catch (err) {
                await btn.reply({ embeds: [errorEmbed('Failed to reset the garage icon. Try again later.', initiatorAvatar)], ephemeral: true });
                return;
            }

            garageIcon = null;
            const resetEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Garage Icon Cleared', iconURL: initiatorAvatar })
                .setDescription('The garage icon has been removed.')
                .setColor('#FF6961')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel.send({ embeds: [resetEmbed.setDescription(`${initiator.tag} cleared their garage icon.`)] }).catch(() => {});
            await btn.update({ embeds: [resetEmbed], components: [] });
            collector.stop('reset');
            return;
        }

        if (id === `settingsGarageIconExit+${mainInteractionId}`) {
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
