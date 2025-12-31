const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { errorEmbed } = require('../../utility.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');
const { searchSelection } = require('./searchSelection.js');
const { displaySearchedVehicle } = require('./displaySearchedVehicle.js');
const { searchExit } = require('./searchExit.js');

async function searchServer(
    interaction,
    initiatorData,
    guildData,
    footerData,
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

    //Filter
    const buttonFilter = (i, messageId) =>
        i.user.id === initiatorId &&
        i.guildId === guildId &&
        (!messageId || i.message?.id === messageId);
    
     //Misc
     const mainInteractionId = interaction.id;

    //Search term returned no results.
    //User can search globally in this case.

    const searchData = await garageSchema.find( { vehicle: { $regex: searchTerm , $options : 'i'} , guildId: guildId} )
    
    if(!searchData || searchData?.length === 0){
        const exitButton = new ButtonBuilder()
        .setCustomId(`searchExit+${mainInteractionId}`)
        .setLabel('Exit')
        .setStyle(ButtonStyle.Danger);

        const searchGlobalData = await garageSchema.find( { vehicle: { $regex: searchTerm , $options : 'i'} } );

        if(!searchGlobalData || searchGlobalData.length === 0){
            const row = new ActionRowBuilder() 
            .addComponents(exitButton);
            await interaction.editReply({
                embeds:[errorEmbed(`No results found for **${searchTerm || 'your search'}** across all servers.`,initiatorAvatar)],
                components: [row]
            });
            const searchMessage = await interaction.fetchReply().catch(() => null);
            const messageId = searchMessage?.id;
            const buttonCollected = await interaction.channel.awaitMessageComponent({
                filter: (i) => buttonFilter(i, messageId),
                componentType: ComponentType.Button,
                time: 60000,
                max: 1
            }).catch(() => null);
            if (buttonCollected?.customId === `searchExit+${mainInteractionId}`) {
                await buttonCollected.deferUpdate();
                searchExit(interaction);
            }
            return;
        }

        const selectedGlobalVehicle = await searchSelection(
            interaction,
            guildData,
            initiatorData,
            footerData,
            embedColor,
            searchTerm,
            searchGlobalData,
            'global',
            false
        );
        if (!selectedGlobalVehicle) return;
        displaySearchedVehicle(
            interaction,
            guildData,
            initiatorData,
            footerData,
            embedColor,
            searchTerm,
            searchGlobalData,
            'global',
            selectedGlobalVehicle
        );
        return;
    };

    const selectedVehicle = await searchSelection(
        interaction,
        guildData,
        initiatorData,
        footerData,
        embedColor,
        searchTerm,
        searchData,
        'server',
        true
    );
    if (!selectedVehicle) return;
    if (selectedVehicle.action === 'global') {
        const searchGlobalData = await garageSchema.find( { vehicle: { $regex: searchTerm , $options : 'i'} } );
        if (!searchGlobalData || searchGlobalData.length === 0) {
            await interaction.editReply({
                embeds:[errorEmbed(`The search returned no results.`,initiatorAvatar)],
                components: []
            });
            return;
        }
        const selectedGlobalVehicle = await searchSelection(
            interaction,
            guildData,
            initiatorData,
            footerData,
            embedColor,
            searchTerm,
            searchGlobalData,
            'global',
            false
        );
        if (!selectedGlobalVehicle) return;
        displaySearchedVehicle(
            interaction,
            guildData,
            initiatorData,
            footerData,
            embedColor,
            searchTerm,
            searchGlobalData,
            'global',
            selectedGlobalVehicle
        );
        return;
    }
    displaySearchedVehicle(
        interaction,
        guildData,
        initiatorData,
        footerData,
        embedColor,
        searchTerm,
        searchData,
        'server',
        selectedVehicle
    );
};

module.exports = {
    searchServer    
};
