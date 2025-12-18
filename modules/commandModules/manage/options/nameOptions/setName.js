const { EmbedBuilder } = require('discord.js');
const { updateVehicleName } = require('../../services/vehicleService.js');

async function setName(
    initiatorData, 
    userData,
    guildData,
    embedColor,
    footerData,
    garageData,
    selectedVehicleData,
    logChannel,
    providedName
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

const footerIcon = footerData.icon;
const footerText = footerData.text;

try {
    await updateVehicleName({
        guildId,
        userId,
        currentName: vehicleName,
        newName: providedName,
    });
} catch (err) {
    return {
        success: false,
        errorMessage: 'Failed to update the vehicle name. Please try again later.',
    };
}

const manageNameConfirmDashboardEmbed = new EmbedBuilder()
.setAuthor({
    name: 'Management Dashboard - Vehicle Name',
    iconURL: initiatorAvatar
})
.setDescription('The name has been updated successfully for the following vehicle.')
.setColor(embedColor || '#77DD77')
.addFields(
    { name: 'Previous Vehicle Name', value: `[${vehicleName}](${verificationImage})`, inline: true },
    { name: 'New Vehicle Name', value: `[${providedName}](${verificationImage})`, inline: true },
    { name: 'Owner', value: userTag, inline: true }
)
.setFooter({
    text: footerText,
    iconURL: footerIcon
});

await logChannel.send({
    embeds: [manageNameConfirmDashboardEmbed]
}).catch(() => {});
    
return {
    success: true,
    embed: manageNameConfirmDashboardEmbed
};
};


module.exports = { 
    setName
};
