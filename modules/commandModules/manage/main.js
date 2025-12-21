
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { obtainGuildProfile, obtainAllUserVehicles } = require('../../database.js');
const { vehicleSelection } = require('../garage/vehicleSelection.js');
const { botIcon, errorEmbed } = require('../../utility.js');
const { manageName } = require('./manage_name.js');
const { manageDescription } = require('./manage_description.js');
const { manageImage } = require('./manage_image.js');
const { manageGarageIcon } = require('./manage_garageIcon.js');
const { manageDelete } = require('./manage_delete.js');
const { manageReset } = require('./manage_reset.js');
const { manageExit } = require('./manage_exit.js');

async function manageDashboard(
    interaction,
    initiatorData, 
    userData,
    guildData,
    embedColor
){

    //Initiator Details
    const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
    const initiatorUsername = initiatorData.username;
    const initiatorId = initiatorData.id;
    
    //User Details
    const userId = userData.id;
    const userTag = userData.tag;
    
    //Guild Details
    const guildId = guildData.id;
    const guildName = guildData.name;
    const guildIcon = guildData.iconURL({ dynamic: true });	
    
    //Misc
    const mainInteractionId = interaction.id;
    const safeEmbedColor = embedColor || '#FFFCFF';
    const menuFilter = (menuInteraction) =>
        menuInteraction.componentType === ComponentType.StringSelect &&
        menuInteraction.customId === `manageMenu+${mainInteractionId}` &&
        menuInteraction.user.id === initiatorId &&
        menuInteraction.guild?.id === guildId &&
        menuInteraction.message?.id === interaction.id;

    //Guild Profile
    const guildProfile = await obtainGuildProfile(guildId);
    if(!guildProfile){
        interaction.editReply({
            embeds: [errorEmbed('Server profile not setup, please kick the bot and invite it again.', initiatorAvatar)]
        });
        return;
    };
    const verificationChannelId = guildProfile.verificationChannelId;
    const guideChannelId = guildProfile.guideChannelId;
    const loggingChannelId = guildProfile.loggingChannelId;
    const verificationRoleId = guildProfile.verifiedVehicleRoleId;
    const syncEnabled = guildProfile.syncEnabled;
    const syncedGuildId = guildProfile.syncedGuildId;
    let syncedGuildData;
    let footerIcon = guildProfile.customFooterIcon || botIcon;
    const footerText = `${guildName} • Vehicle Verification`
    const footerData = {
        icon: footerIcon,
        text: footerText
    };
    if(syncEnabled){
        if(!syncedGuildData){
            await interaction.editReply({
                embeds: [errorEmbed(`There was an error when fetching details of the synced server \`(ID: ${syncedGuildId})\``, initiatorAvatar)],
                ephemeral: true
            });
            return;
        };
        const syncedServerName = syncedGuildData.name;
        await interaction.editReply({
            embeds: [errorEmbed(`This server is synced to the \`${syncedServerName}\` server.\nPlease apply for vehicle verification in there.`, initiatorAvatar)],
            ephemeral: true
        });
        return;
    };

    if(!verificationChannelId || !guideChannelId || !loggingChannelId){
        await interaction.editReply({
            embeds: [errorEmbed('This server has not been setup properly, please ask the moderation team to use the `/setup` command.', initiatorAvatar)]
        });
        return;
    };

    const logChannel = await interaction.member.guild.channels.fetch(loggingChannelId);
    if(!logChannel){
        await interaction.editReply({
            embeds: [errorEmbed(`Failed to obtain the log channel where the logs are sent.\nPlease ask the staff to make sure the log channel is setup properly.`, initiatorAvatar)],
        });
        return;
    };

    const garageData = await obtainAllUserVehicles(userId, guildId);
    if(!garageData || garageData?.length === 0){
        await interaction.editReply({
            embeds:[errorEmbed(`**${initiatorUsername},**\nYou do not have any verified rides! Please have them verified first by using the \`/verify\` command first.`)],
            ephemeral: true
        });
        return;
    };

    const selectedVehicleData = await vehicleSelection(
        garageData,
        userData,
        footerText,
        footerIcon,
        safeEmbedColor,
        interaction
    );
    if(!selectedVehicleData) return;
    const vehicleName = selectedVehicleData.vehicle;
    const verificationImage = selectedVehicleData.verificationImageLink || "https://www.youtube.com/watch?v=dQw4w9WgXcQ" //Checkout this link.
    const vehicleOwnerId = selectedVehicleData.userId;
    let vehicleDescription = selectedVehicleData.vehicleDescription;
    let vehicleImages = selectedVehicleData.vehicleImages;
    
    const settingsDashboardEmbed = new EmbedBuilder()
    .setAuthor({
        name: 'Verified Vehicle Management',
        iconURL: initiatorAvatar
    })
    .setDescription('This dashboard allows you to configure verified vehicles owned by a user.\nStart by selecting on the option you would ike to explore from the menu below. ')
    .addFields(
        { name: 'Vehicle', value: `[${vehicleName}](${verificationImage})`, inline: true },
        { name: 'Owner', value: userTag, inline: true }
    )
    .setColor(safeEmbedColor)
    .setFooter({
        text: footerText,
        iconURL: footerIcon
    });
    
    const row = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`manageMenu+${mainInteractionId}`)
            .setPlaceholder('Select the option you wish to configure...')
            .addOptions([
                {
                    label: 'Name',
                    description: 'Edit the name of the vehicle.',
                    value: `manage_name+${mainInteractionId}`,
                },
                {
                    label: 'Images',
                    description: 'Review or remove vehicle images.',
                    value: `manage_image+${mainInteractionId}`,
                },
                {
                    label: 'Description',
                    description: 'Edit the vehicle description.',
                    value: `manage_description+${mainInteractionId}`,
                },
                {
                    label: 'Garage Icon',
                    description: 'Update the user\'s garage icon.',
                    value: `manage_garageIcon+${mainInteractionId}`,
                },
                {
                    label: 'Delete',
                    description: 'Delete a vehicle from the user\`s garage.',
                    value: `manage_delete+${mainInteractionId}`,
                },
                {
                    label: 'Exit',
                    description: 'Exit the interface.',
                    value: `manage_exit+${mainInteractionId}`,
                },
            ]),
    );

    await interaction.editReply({
        embeds: [settingsDashboardEmbed],
        components: [row]
    });

    const manageMessage = await interaction.fetchReply().catch(() => null);

    const menuCollector = interaction.channel.createMessageComponentCollector({
        filter: (menuInteraction) =>
            menuInteraction.componentType === ComponentType.StringSelect &&
            menuInteraction.customId === `manageMenu+${mainInteractionId}` &&
            menuInteraction.user.id === initiatorId &&
            menuInteraction.guild?.id === guildId &&
            (!manageMessage || menuInteraction.message?.id === manageMessage.id),
        max: 1,
        time: 120000
    });

    menuCollector.on('end', async (menuCollected) => {
        const menuCollectedData = menuCollected?.first();
        if(!menuCollectedData){
            await interaction.deleteReply();
            return;
        };
        const selectedOptionId = menuCollectedData.values[0];
        if(!menuCollectedData.deferred) await menuCollectedData.deferUpdate();
        switch(selectedOptionId){
            case `manage_name+${mainInteractionId}`:
                manageName(
                    interaction,
                    initiatorData, 
                    userData,
                    guildData,
                    safeEmbedColor,
                    footerData,
                    garageData,
                    selectedVehicleData,
                    logChannel
                );
                break;
            case `manage_image+${mainInteractionId}`:
                manageImage(
                    interaction,
                    initiatorData,
                    userData,
                    guildData,
                    safeEmbedColor,
                    footerData,
                    garageData,
                    selectedVehicleData,
                    logChannel
                );
                break;
                
            case `manage_description+${mainInteractionId}`:
                manageDescription(
                    interaction,
                    initiatorData, 
                    userData,
                    guildData,
                    safeEmbedColor,
                    footerData,
                    garageData,
                    selectedVehicleData,
                    logChannel
                );
                break;
            case `manage_garageIcon+${mainInteractionId}`:
                manageGarageIcon(
                    interaction,
                    initiatorData, 
                    userData,
                    guildData,
                    safeEmbedColor,
                    footerData,
                    garageData,
                    selectedVehicleData,
                    logChannel
                );
                break;
            case `manage_delete+${mainInteractionId}`:
                manageDelete(
                    interaction,
                    initiatorData, 
                    userData,
                    guildData,
                    safeEmbedColor,
                    footerData,
                    garageData,
                    selectedVehicleData,
                    logChannel
                );
                break;
            case `manage_reset+${mainInteractionId}`:
                manageReset();
                break;
            case `manage_exit+${mainInteractionId}`:
                manageExit(
                    interaction
                );
                break;
            
        };
    });

};


exports.manageDashboard = manageDashboard;
