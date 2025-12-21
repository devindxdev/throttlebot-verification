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
const { exitGlobal } = require('./options/exitGlobal.js');
const { backGlobal } = require('./options/backGlobal.js');
const { setName } = require('./options/nameOptions/setName.js');
const { errorEmbed } = require('../../utility.js');

async function manageName(
    interaction,
    initiatorData, 
    userData,
    guildData,
    embedColor,
    footerData,
    garageData,
    selectedVehicleData,
    logChannel
)
{

    //Initiator Details
    const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
    const initiatorUsername = initiatorData.username;
    const initiatorId = initiatorData.id;

    //User Details
    const userId = userData.id;
    const username = userData.username;
    const userAvatar = userData.displayAvatarURL({ dynamic: true });
    const userTag = userData.tag;

    //Guild Details
    const guildId = guildData.id;
    const guildName = guildData.name;
    const guildIcon = guildData.iconURL({ dynamic: true });	

    //Vehicle Details
    const vehicleName = selectedVehicleData.vehicle;
    const verificationImage = selectedVehicleData.verificationImageLink || "https://www.youtube.com/watch?v=dQw4w9WgXcQ" //Checkout this link.
    const vehicleOwnerId = selectedVehicleData.userId;
    let vehicleDescription = selectedVehicleData.vehicleDescription;
    let vehicleImages = selectedVehicleData.vehicleImages;
    
    //Misc
    const mainInteractionId = interaction.id;
    const footerIcon = footerData.icon;
    const footerText = footerData.text;

    //Filters
    const manageMessage = await interaction.fetchReply().catch(() => null);
    const buttonFilter = (i) =>
        i.user.id === initiatorId &&
        i.guild?.id === guildId &&
        (!manageMessage || i.message?.id === manageMessage.id);
    const modalFilter = (modalInteraction) => modalInteraction.customId === `setNameModal+${mainInteractionId}` && modalInteraction.user.id === initiatorId;

    const buildDashboardEmbed = () =>
        new EmbedBuilder()
            .setAuthor({
                name: 'Management Dashboard - Vehicle Name',
                iconURL: initiatorAvatar
            })
            .setDescription('Use the button below to provide a new name for the selected vehicle.')
            .setColor(embedColor)
            .addFields(
                { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
                { name: 'Owner', value: userTag, inline: true }
            )
            .setFooter({
                text: footerText,
                iconURL: footerIcon
            });

    const buildControls = () =>
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Set Name')
                .setStyle(ButtonStyle.Primary)
                .setCustomId(`setName+${mainInteractionId}`),
            new ButtonBuilder()
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`backName+${mainInteractionId}`),
            new ButtonBuilder()
                .setLabel('Exit')
                .setStyle(ButtonStyle.Danger)
                .setCustomId(`exitName+${mainInteractionId}`)
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

        if(buttonId === `setName+${mainInteractionId}`){
            const modal = new ModalBuilder()
                .setCustomId(`setNameModal+${mainInteractionId}`)
                .setTitle('Update Vehicle Name')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('newVehicleName')
                            .setLabel('Enter the new vehicle name')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(100)
                            .setValue(vehicleName ? vehicleName.slice(0, 100) : '')
                    )
                );

            await collected.showModal(modal);

            let modalSubmission;
            try{
                modalSubmission = await interaction.awaitModalSubmit({
                    filter: modalFilter,
                    time: 60000
                });
            }catch(error){
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true
                });
                buttonCollector.stop('noresponse');
                return;
            }

            const providedName = modalSubmission.fields.getTextInputValue('newVehicleName').trim();
            if(!providedName){
                await modalSubmission.reply({
                    embeds: [errorEmbed('The provided name cannot be empty.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            // Prevent duplicate vehicle names across the user's garage.
            const normalizedProvidedName = providedName.toLowerCase();
            const selectedVehicleId = selectedVehicleData?._id?.toString?.();
            const duplicateVehicle = garageData.some(vehicle => {
                const normalizedVehicleName = vehicle?.vehicle ? vehicle.vehicle.trim().toLowerCase() : '';
                if (!normalizedVehicleName) return false;
                if (normalizedVehicleName !== normalizedProvidedName) return false;
                const vehicleId = vehicle?._id?.toString?.();
                if (selectedVehicleId && vehicleId && vehicleId === selectedVehicleId) return false;
                if (!selectedVehicleId && vehicle.vehicle === vehicleName) return false;
                return true;
            });

            if(duplicateVehicle){
                await modalSubmission.reply({
                    embeds: [errorEmbed('You already have another vehicle with that name. Please choose a unique name.', initiatorAvatar)],
                    ephemeral: true
                });
                return;
            }

            const updateResult = await setName(
                initiatorData, 
                userData,
                guildData,
                embedColor,
                footerData,
                garageData,
                selectedVehicleData,
                logChannel,
                providedName
            );

            if(!updateResult?.success){
                await modalSubmission.reply({
                    embeds: [errorEmbed(updateResult?.errorMessage || 'Failed to update the vehicle name.', initiatorAvatar)],
                    ephemeral: true
                });
                buttonCollector.stop('error');
                return;
            }

            selectedVehicleData.vehicle = providedName;

            await modalSubmission.update({
                embeds: [updateResult.embed],
                components: []
            });

            buttonCollector.stop('submitted');
            return;
        }

        if(buttonId === `backName+${mainInteractionId}`){
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

        if(buttonId === `exitName+${mainInteractionId}`){
            await collected.deferUpdate();
            buttonCollector.stop('exit');
            exitGlobal(interaction);
        }
    });

    buttonCollector.on('end', async (_collected, reason) => {
        if(reason === 'time'){
            await interaction.deleteReply().catch(() => {});
        }
    });

};

module.exports = { 
    manageName
};
