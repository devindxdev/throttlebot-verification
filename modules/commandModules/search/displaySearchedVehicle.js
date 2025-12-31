const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

async function displaySearchedVehicle(
    interaction,
    guildData,
    initiatorData,
    footerData,
    embedColor,
    searchTerm,
    searchData,
    type = 'server',
    selection
){

    //Initiator Details
    const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
    const initiatorUsername = initiatorData.username;
    const initiatorId = initiatorData.id;
    
     //Guild Details
    const guildId = guildData.id;
    const guildName = guildData.name;
    const guildIcon = guildData.iconURL({ dynamic: true });	

    //Vehicle Data
    const vehicleName = selection.vehicleData.vehicle;
    const vehicleImages = selection.vehicleData.vehicleImages;
    const vehicleDescription = selection.vehicleData.vehicleDescription;
    const vehicleEmbedColor = selection.vehicleData.embedColor || embedColor || '#FFFCFF';

    //Vehicle Owner Data
    const userTag = selection.userTag
    const userAvatar = selection?.userData?.displayAvatarURL?.({ dynamic: true }) || null;

    //Misc
    const mainInteractionId = interaction.id;

    //Filter
    const buttonFilter = (i, messageId) =>
        i.user.id === initiatorId &&
        i.guildId === guildId &&
        (!messageId || i.message?.id === messageId);

    if(!vehicleImages || vehicleImages.length <=0){
        await interaction.followUp({
            content: `There are no images to display for **${vehicleName}** driven by **\`${userTag}\`**`,
            ephemeral: false
        });
        return;
    };

    const vehicleEmbed = new EmbedBuilder()
    .setAuthor({
        name: `${vehicleName} - Driven By ${userTag}`,
        iconURL: userAvatar
    })
    .setColor(vehicleEmbedColor)
    .setImage(vehicleImages[0])
    .setFooter({
        text: `${guildName} • Image 1 of ${vehicleImages.length}`,
        iconURL: footerData.icon
    })
    if(vehicleDescription) vehicleEmbed.setDescription(vehicleDescription);
    let componentsArray = [];
    const row = new ActionRowBuilder() 
    const previousButton = new ButtonBuilder()
    .setCustomId(`previousVehicleImageSearch+${mainInteractionId}`)
    .setLabel('Previous')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);
    const nextButton = new ButtonBuilder()
    .setCustomId(`nextVehicleImageSearch+${mainInteractionId}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary);
    if(vehicleImages.length > 1){
        row.addComponents(previousButton).addComponents(nextButton);
        componentsArray = [row];
    };
    await interaction.editReply({
        embeds: [vehicleEmbed],
        components: componentsArray
    });

    if(vehicleImages.length > 1){
        let pages = vehicleImages;
        let page = 1;
        //600000 = 10 minutes.
        const searchMessage = await interaction.fetchReply().catch(() => null);
        const messageId = searchMessage?.id;
        const buttonCollector = interaction.channel.createMessageComponentCollector({
            time: 600000,
            componentType: ComponentType.Button,
            filter: (i) => buttonFilter(i, messageId),
        }); 
        buttonCollector.on('collect', async (collected) => {
            const buttonId = collected.customId;
            switch(buttonId){
                case `nextVehicleImageSearch+${mainInteractionId}`:
                    await collected.deferUpdate();
                    if (page >= pages.length) return;
                    page++;
                    vehicleEmbed
                    .setImage(pages[page - 1])
                    .setFooter({
                        text: `${guildName} • Image ${page} of ${vehicleImages.length}`,
                        iconURL: footerData.icon
                    });
                    previousButton.setDisabled(false);
                    if (page >= pages.length){
                        nextButton.setDisabled(true);
                    };
                    const nextRow = new ActionRowBuilder() 
                    nextRow.addComponents(previousButton).addComponents(nextButton);
                    await interaction.editReply({
                        embeds: [vehicleEmbed],
                        components: [nextRow]
                    });
                    break;
                case `previousVehicleImageSearch+${mainInteractionId}`:
                    await collected.deferUpdate();
                    if (page <= 1) return;
                    page--;
                    vehicleEmbed
                    .setImage(pages[page - 1])
                    .setFooter({
                        text: `${guildName} • Image ${page} of ${vehicleImages.length}`,
                        iconURL: footerData.icon
                    })
                    nextButton.setDisabled(false);
                    if (page <= 1){
                        previousButton.setDisabled(true);
                    };
                    const prevRow = new ActionRowBuilder() 
                    prevRow.addComponents(previousButton).addComponents(nextButton);
                    await interaction.editReply({
                        embeds: [vehicleEmbed],
                        components: [prevRow]
                    });
                    break
            };
        });

        buttonCollector.on('end', async (collected) => {
            await interaction.editReply({
                embeds: [vehicleEmbed],
                components: []
            });
        });
    };

};

module.exports = {
    displaySearchedVehicle
};
