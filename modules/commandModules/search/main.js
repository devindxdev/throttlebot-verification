const { searchGlobal } = require('./searchGlobal.js')
const { searchExit } = require('./searchExit.js')
const { searchServer } = require('./searchServer.js')
const { obtainGuildProfile } = require('../../database.js');
const { botIcon } = require('../../utility.js')

async function vehicleSearch(
    interaction,
    initiatorData,
    guildData,
    embedColor,
    searchTerm
){

     //Initiator Details
     const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
     const initiatorUsername = initiatorData.username;
     const initiatorId = initiatorData.id;
     
     //Guild Details
     const guildId = guildData.id;
     const guildName = guildData.name;
     const guildIcon = guildData.iconURL({ dynamic: true });	
     const guildProfile = await obtainGuildProfile(guildId);
     if(!guildProfile){
         interaction.editReply({
             embeds: [errorEmbed('Server profile not setup, please kick the bot and invite it again.', initiatorAvatar)]
         });
         return;
     };

     //Misc
     const mainInteractionId = interaction.id
     let footerIcon = guildProfile.customFooterIcon || botIcon;
     const footerText = `${guildName} • Vehicle Verification`
     const footerData = {
         icon: footerIcon,
         text: footerText
     };
    /*
    Carrying out the search execution:
    1. Server search takes place by default. 
    If none are found, an error is displayed and the user has the option to search globally.
    2. Once the results are displayed, there will be 'Previous', 'Next' buttons for the pages and a 'Search Globally' option as well.- 
    */
    searchServer(
        interaction,
        initiatorData,
        guildData,
        footerData,
        embedColor,
        searchTerm
    );

};

module.exports = {
    vehicleSearch
}; 
