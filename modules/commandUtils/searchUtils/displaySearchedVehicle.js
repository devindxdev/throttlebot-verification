const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

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
    const vehicleEmbedColor = selection.vehicleData.embedColor || embedColor;

    //Vehicle Owner Data
    const userTag = selection.userTag
    const userAvatar = selection?.userData?.user?.displayAvatarURL({ dynamic: true }) || null;

    //Misc
    const mainInteractionId = interaction.id;

    //Filter
    const buttonFilter = i => i.user.id === initiatorId && i.guild.id === guildId;

    if(!vehicleImages || vehicleImages.length <=0){
        await interaction.followUp({
            content: `There are no images to display for **${vehicleName}** driven by **\`${userTag}\`**`,
            ephemeral: false
        });
        return;
    };

    const vehicleEmbed = new MessageEmbed()
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
    const row = new MessageActionRow() 
    const previousButton = new MessageButton()
    .setCustomId(`previousVehicleImageSearch+${mainInteractionId}`)
    .setLabel('Previous')
    .setStyle('PRIMARY')
    .setDisabled(true);
    const nextButton = new MessageButton()
    .setCustomId(`nextVehicleImageSearch+${mainInteractionId}`)
    .setLabel('Next')
    .setStyle('PRIMARY');
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
        const buttonCollector = interaction.channel.createMessageComponentCollector({ time: 600000, filter: buttonFilter}); 
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
                    const nextRow = new MessageActionRow() 
                    nextRow.addComponents(previousButton).addComponents(nextButton);
                    await interaction.editReply({
                        embeds: [vehicleEmbed],
                        components: [row]
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
                    const prevRow = new MessageActionRow() 
                    prevRow.addComponents(previousButton).addComponents(nextButton);
                    await interaction.editReply({
                        embeds: [vehicleEmbed],
                        components: [row]
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