const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { errorEmbed } = require('../../utility.js');
const { exitGlobal } = require('./options/exitGlobal.js');
const { backGlobal } = require('./options/backGlobal.js');
const { cancelDelete } = require('./options/deleteOptions/cancelDelete.js');
const { confirmDelete } = require('./options/deleteOptions/confirmDelete.js');


async function manageDelete(
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
    const buttonFilter = i => i.user.id === initiatorId && i.guild.id === guildId;

    const manageDeleteDashboardEmbed = new EmbedBuilder()
    .setAuthor({
        name: 'Management Dashboard - Delete Vehicle',
        iconURL: initiatorAvatar
    })
    .setDescription('Are you sure you would like to permanently delete the following vehicle? This action is irreversible!')
    .setColor(embedColor)
    .addFields(
        { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
        { name: 'Owner', value: userTag, inline: true }
    )
    .setFooter({
        text: footerText,
        iconURL: footerIcon
    });

    const buttonsRow = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success)
        .setCustomId(`confirmDelete+${mainInteractionId}`),
        new ButtonBuilder()
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`cancelDelete+${mainInteractionId}`),
        new ButtonBuilder()
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`backDelete+${mainInteractionId}`),
        new ButtonBuilder()
        .setLabel('Exit')
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`exitDelete+${mainInteractionId}`)
    );

    await interaction.editReply({
        embeds: [manageDeleteDashboardEmbed],
        components: [buttonsRow]
    });

    const collectedButton = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button, time: 60000, max: 1 })
    .catch(e => {
    });
    if(!collectedButton){
        await interaction.followUp({
            embeds: [errorEmbed('No response was received, Ending operation.', initiatorAvatar)],
            ephemeral: true
        });
        await interaction.deleteReply();
        return;
    };
    if(!collectedButton.deferred) await collectedButton.deferUpdate();
    const buttonId = collectedButton.customId;
    switch(buttonId){
        case `confirmDelete+${mainInteractionId}`:
            confirmDelete(
                interaction,
                initiatorData, 
                userData,
                guildData,
                embedColor,
                footerData,
                garageData,
                selectedVehicleData,
                logChannel
            );
            break;
        case `cancelDelete+${mainInteractionId}`:
            cancelDelete(
                interaction,
                initiatorData, 
                userData,
                guildData,
                embedColor,
                footerData,
                garageData,
                selectedVehicleData
            );
            break;
        case `backDelete+${mainInteractionId}`:
            //Back function would take you back to main.
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
            break;
        case `exitDelete+${mainInteractionId}`:
            exitGlobal(
                interaction
            );
            break;
    };

};

module.exports = { 
    manageDelete,
};
