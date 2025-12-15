const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { exitGlobal } = require('../exitGlobal.js');
const { backGlobal } = require('../backGlobal.js');
const { redColor, errorEmbed } = require('../../../../utility.js');

async function cancelDelete(
    interaction,
    initiatorData, 
    userData,
    guildData,
    embedColor,
    footerData,
    garageData,
    selectedVehicleData
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

    const cancelDeleteEmbed = new EmbedBuilder()
    .setAuthor({
        name: 'Management Dashboard - Delete Vehicle',
        iconURL: initiatorAvatar
    })
    .setDescription('The operation was cancelled. Please use the buttons below to proceed.')
    .setColor(redColor)
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
        .setLabel('Canceled')
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`disabled`)
        .setDisabled(true),
        new ButtonBuilder()
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`backCancelDelete+${mainInteractionId}`),
        new ButtonBuilder()
        .setLabel('Exit')
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`exitCancelDelete+${mainInteractionId}`)
    );
    
    await interaction.editReply({
        embeds: [cancelDeleteEmbed],
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
        case `backCancelDelete+${mainInteractionId}`:
            backGlobal(
                interaction,
                initiatorData, 
                userData,
                guildData,
                embedColor,
                backConfirmDelete
            );
            break;
        case `exitCancelDelete+${mainInteractionId}`:
            exitGlobal(interaction)
            break;
    };

};

module.exports = { 
    cancelDelete
};
