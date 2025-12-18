const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType
} = require('discord.js');
const { errorEmbed } = require('../../utility.js');
const { exitGlobal } = require('./options/exitGlobal.js');
const { saveVehicleImages } = require('./services/vehicleService.js');

async function manageImage(
    interaction,
    initiatorData,
    userData,
    guildData,
    embedColor,
    footerData,
    garageData,
    selectedVehicleData,
    logChannel
) {
    const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
    const initiatorId = initiatorData.id;
    const userTag = userData.tag;
    const userId = userData.id;
    const guildId = guildData.id;

    const vehicleName = selectedVehicleData.vehicle;
    const verificationImage =
        selectedVehicleData.verificationImageLink || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    let vehicleImages = Array.isArray(selectedVehicleData.vehicleImages)
        ? [...selectedVehicleData.vehicleImages]
        : [];

    const mainInteractionId = interaction.id;
    const footerIcon = footerData.icon;
    const footerText = footerData.text;
    const guildDisplayName = interaction.guild?.name || guildData.name || 'Vehicle Verification';

    const buttonFilter = (btn) => btn.user.id === initiatorId && btn.guild.id === guildId;

    let currentIndex = 0;

    // Shows the currently selected vehicle image (or a placeholder message if none exist).
    const buildVehicleEmbed = () => {
        const embed = new EmbedBuilder()
            .setAuthor({
                name: 'Management Dashboard - Vehicle Images',
                iconURL: initiatorAvatar
            })
            .setColor(embedColor)
            .addFields(
                { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                { name: 'Owner', value: userTag, inline: true }
            )
            .setFooter({
                text:
                    vehicleImages.length > 0
                        ? `${guildDisplayName} • Image ${currentIndex + 1} of ${vehicleImages.length}`
                        : `${guildDisplayName} • No Images`,
                iconURL: footerIcon
            });

        if (vehicleImages.length > 0) {
            embed.setImage(vehicleImages[currentIndex]);
        } else {
            embed.setDescription('No images are currently associated with this vehicle.');
        }

        return embed;
    };

    // Navigation layout: previous/next remain adjacent, with destructive/remove + exit actions on the same row.
    const buildNavigationRow = () => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`manageImagePrev+${mainInteractionId}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(vehicleImages.length <= 1 || currentIndex === 0),
            new ButtonBuilder()
                .setCustomId(`manageImageNext+${mainInteractionId}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(
                    vehicleImages.length <= 1 || currentIndex === vehicleImages.length - 1
                ),
            new ButtonBuilder()
                .setCustomId(`manageImageRemove+${mainInteractionId}`)
                .setLabel('Remove Image')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(vehicleImages.length === 0),
            new ButtonBuilder()
                .setCustomId(`manageImageExit+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Secondary)
        );
    };

    const updateMessage = async (replyInteraction) => {
        return replyInteraction.editReply({
            embeds: [buildVehicleEmbed()],
            components: [buildNavigationRow()]
        });
    };

    await updateMessage(interaction);

    const collector = interaction.channel.createMessageComponentCollector({
        filter: buttonFilter,
        componentType: ComponentType.Button,
        time: 120000
    });

    collector.on('collect', async (collected) => {
        const buttonId = collected.customId;

        if (buttonId === `manageImagePrev+${mainInteractionId}`) {
            if (currentIndex > 0) currentIndex -= 1;
            await collected.update({
                embeds: [buildVehicleEmbed()],
                components: [buildNavigationRow()]
            });
            return;
        }

        if (buttonId === `manageImageNext+${mainInteractionId}`) {
            if (currentIndex < vehicleImages.length - 1) currentIndex += 1;
            await collected.update({
                embeds: [buildVehicleEmbed()],
                components: [buildNavigationRow()]
            });
            return;
        }

        if (buttonId === `manageImageRemove+${mainInteractionId}`) {
            if (vehicleImages.length === 0) {
                await collected.reply({
                    embeds: [errorEmbed('There are no images to remove.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            const removedImage = vehicleImages.splice(currentIndex, 1)[0];

            try {
                await saveVehicleImages({
                    guildId,
                    userId,
                    vehicleName,
                    images: vehicleImages,
                });
            } catch (err) {
                console.error('Failed to remove vehicle image:', err);
                vehicleImages.splice(currentIndex, 0, removedImage);
                await collected.reply({
                    embeds: [errorEmbed('Failed to remove the image. Please try again later.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            selectedVehicleData.vehicleImages = [...vehicleImages];
            if (vehicleImages.length === 0) {
                currentIndex = 0;
            } else if (currentIndex >= vehicleImages.length) {
                currentIndex = vehicleImages.length - 1;
            }

            const logEmbed = new EmbedBuilder()
                .setAuthor({
                    name: 'Vehicle Image Removed',
                    iconURL: initiatorAvatar
                })
                .setColor('#FF6961')
                .setDescription(`${initiatorData.tag} removed an image from ${userTag}'s vehicle.`)
                .addFields(
                    { name: 'Vehicle', value: vehicleName, inline: true },
                    { name: 'Owner', value: userTag, inline: true },
                    { name: 'Removed Image', value: removedImage ? `[View Image](${removedImage})` : 'Unknown' }
                )
                .setFooter({
                    text: footerText,
                    iconURL: footerIcon
                });

            await logChannel.send({ embeds: [logEmbed] }).catch((err) => {
                console.error('Failed to log image removal:', err);
            });

            await collected.update({
                embeds: [buildVehicleEmbed()],
                components: [buildNavigationRow()]
            });

            return;
        }

        if (buttonId === `manageImageExit+${mainInteractionId}`) {
            await collected.deferUpdate();
            collector.stop('exit');
            exitGlobal(interaction);
            return;
        }
    });

    collector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
            await interaction.deleteReply().catch(() => {});
        }
    });
}

module.exports = {
    manageImage
};
