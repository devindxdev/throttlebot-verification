const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const mongoose = require('mongoose');
const { removeNonIntegers } = require('../../utility.js');
const { capitalizeFirstLetter } = require('../../utility.js')

async function searchSelection(
    interaction,
    guildData,
    initiatorData,
    footerData,
    embedColor,
    searchTerm,
    searchData,
    type = 'server'
    ){
    return new Promise(async function(resolve, reject) {
        try{
            //Initiator Details
            const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
            const initiatorUsername = initiatorData.username;
            const initiatorId = initiatorData.id;
            
             //Guild Details
            const guildId = guildData.id;
            const guildName = guildData.name;
            const guildIcon = guildData.iconURL({ dynamic: true });	

            //Filter
            const messageFilter = (m) => m.author.id === initiatorId && m.guild.id === guildId;
			const buttonFilter = i => i.user.id === initiatorId && i.guild.id === guildId;

            //Misc
            const mainInteractionId = interaction.id; 
            const searchType = capitalizeFirstLetter(type);

            if(searchData.length === 1){
                resolve(searchData[0]);
            }else{
                const searchOrganizedData = [];
                for await (const x of searchData){
                    const userId = x.userId;
                    const guildId = x.guildId;
                    const vehicle = x.vehicle;
                    const vehicleImages = x.vehicleImages;
                    const guild = await interaction.client.guilds.fetch(guildId).catch(e=> {});
                    const guildName = guild?.name || 'Unknown';
                    const vehicleOwnerData = await interaction.client.users.fetch(userId).catch(e=> {});
                    const vehicleOwnerTag = vehicleOwnerData?.tag || 'Unknown User';
                    searchOrganizedData.push({
                        vehicleData: x,
                        guildData: guild,
                        userData: vehicleOwnerData,
                        guildName: guildName,
                        userTag: vehicleOwnerTag
                    });
                };
                const numberOfitemsOnPage = 10;
                const searchOutput = searchOrganizedData.map((x,y) => {
                    const vehicleImages = x.vehicleData.vehicleImages;
                    if(vehicleImages.length > 0){
                        return `\`${y+1}.\` [${x.vehicleData.vehicle}](${vehicleImages[0]}) • ${x.userTag}`;
                    }else{
                        return `\`${y+1}.\` ${x.vehicleData.vehicle} • ${x.userTag}`;
                    };
                });
                const pageOutput = new Array(Math.ceil(searchOutput.length / numberOfitemsOnPage))
                .fill()
                .map(_ => searchOutput.splice(0, numberOfitemsOnPage))
                const pages = pageOutput;
                let page = 1;
                if(!searchTerm) searchTerm = 'All';
                const searchSelectionEmbed = new MessageEmbed()
                .setAuthor({
                    name: `${searchType} Search - ${searchTerm} • ${page} of ${pages.length}`,
                    iconURL: initiatorAvatar
                })
                .setDescription(pages[page-1].join('\n'))
                .setColor(embedColor)
                .setFooter({
                    text: footerData.text,
                    iconURL: footerData.icon
                });

                const previousButton = new MessageButton()
                .setCustomId(`previousSearchPage+${mainInteractionId}`)
                .setLabel('Previous')
                .setStyle('PRIMARY')
                .setDisabled(true);
                const nextButton = new MessageButton()
                .setCustomId(`nextSearchPage+${mainInteractionId}`)
                .setLabel('Next')
                .setStyle('PRIMARY');

                let componentsArray = []
                const row = new MessageActionRow()
                row.addComponents(previousButton, nextButton);
                if(pages.length > 1) componentsArray = [row]
                await interaction.editReply({
                    embeds: [searchSelectionEmbed],
                    components: componentsArray
                });

                const buttonCollector = interaction.channel.createMessageComponentCollector({ time: 600000, filter: buttonFilter}); 
                
                buttonCollector.on('collect', async (collected) => {
					const buttonId = collected.customId;
					switch(buttonId){
                        case `previousSearchPage+${mainInteractionId}`:
                            await collected.deferUpdate();
                            if (page <= 1) return;
								page--;
                                nextButton.setDisabled(false);
								if (page <= 1){
									previousButton.setDisabled(true);
								};
								const previousRow = new MessageActionRow() 
								previousRow.addComponents(previousButton).addComponents(nextButton);
                                searchSelectionEmbed
                                .setAuthor({
                                    name: `${searchType} Search - ${searchTerm} • ${page} of ${pages.length}`,
                                    iconURL: initiatorAvatar
                                })
                                .setDescription(pages[page-1].join('\n'));
                                await interaction.editReply({
                                    embeds: [searchSelectionEmbed],
                                    components: [row]
                                });

                            break;
                        case `nextSearchPage+${mainInteractionId}`:
                            await collected.deferUpdate();
                            if (page >= pages.length) return;
                            page++;
                            previousButton.setDisabled(false);
                            if (page >= pages.length){
                                nextButton.setDisabled(true);
                            };
                            const nextRow = new MessageActionRow()
                            .addComponents(previousButton).addComponents(nextButton);
                            searchSelectionEmbed
                            .setAuthor({
                                name: `${searchType} Search - ${searchTerm} • ${page} of ${pages.length}`,
                                iconURL: initiatorAvatar
                            })
                            .setDescription(pages[page-1].join('\n'));
                            await interaction.editReply({
                                embeds: [searchSelectionEmbed],
                                components: [nextRow]
                            });
                            break;
                    };
                });
                
                buttonCollector.on('end', async (collected) => {
                    const collectedData = collected?.first();
					if(!collectedData){
						await interaction.editReply({
                            embeds: [searchSelectionEmbed],
                            components: []
                        });
					};
					
				});

                const allowedResponses = Array.from(Array(searchOrganizedData.length + 1).keys()).slice(1).map(x => `${x}`);
                const messageCollector = interaction.channel.createMessageCollector({ filter: messageFilter, time: 600000, max: 3});
                messageCollector.on('collect', async (collectedMessage) => {
                    const messageContent = collectedMessage.content;
                    const selectedOption = removeNonIntegers(messageContent);
                    if(!allowedResponses.includes(selectedOption)) return;
                    messageCollector.stop();
                    collectedMessage.delete();
                    const selectedVehicle = searchOrganizedData[parseInt(selectedOption) - 1];
                    resolve(selectedVehicle);
                });

                messageCollector.on('end', async (collected) => {
                    /*
                    Checking if there were no responses collected 
                    Or if the responses that were collected are invalid.
                    */
                    const collectedResponses = collected.map(x => x.content);
                    const whetherAllInvalidResponses = collectedResponses.every(x => {
                        return !allowedResponses.includes(x);
                    });
                    if(whetherAllInvalidResponses){
                        await interaction.editReply({
                            embeds: [searchSelectionEmbed],
                            components: []
                        });
                        return;
                    }
                });
            };
        }catch(err){
            reject(err)
        };
    });
};


module.exports = { 
    searchSelection
};