const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const { capitalizeFirstLetter } = require('../../utility.js');

async function searchSelection(
    interaction,
    guildData,
    initiatorData,
    footerData,
    embedColor,
    searchTerm,
    searchData,
    type = 'server',
    allowGlobal = false
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
			const buttonFilter = (i, messageId) =>
                i.user.id === initiatorId &&
                i.guildId === guildId &&
                (!messageId || i.message?.id === messageId);

            //Misc
            const mainInteractionId = interaction.id; 
            const searchType = capitalizeFirstLetter(type);

            const userCache = new Map();
            const guildCache = new Map();
            const resolveUser = async (userId) => {
                if (userCache.has(userId)) return userCache.get(userId);
                const user = await interaction.client.users.fetch(userId).catch(() => null);
                userCache.set(userId, user);
                return user;
            };
            const resolveGuild = async (guildIdValue) => {
                if (guildCache.has(guildIdValue)) return guildCache.get(guildIdValue);
                const guild = await interaction.client.guilds.fetch(guildIdValue).catch(() => null);
                guildCache.set(guildIdValue, guild);
                return guild;
            };

            const searchOrganizedData = [];
            for await (const x of searchData){
                const userId = x.userId;
                const guildIdValue = x.guildId;
                const vehicleOwnerData = await resolveUser(userId);
                const vehicleOwnerTag = vehicleOwnerData?.tag || 'Unknown User';
                const guildData = await resolveGuild(guildIdValue);
                const guildName = guildData?.name || 'Unknown Server';
                searchOrganizedData.push({
                    vehicleData: x,
                    userData: vehicleOwnerData,
                    userTag: vehicleOwnerTag,
                    guildName
                });
            };
            if(searchOrganizedData.length === 1){
                resolve(searchOrganizedData[0]);
            }else{
                const numberOfitemsOnPage = 10;
                const searchOutput = searchOrganizedData.map((x,y) => {
                    const vehicleImages = x.vehicleData.vehicleImages;
                    const guildSuffix = x.vehicleData.guildId === guildId ? '' : ` • ${x.guildName}`;
                    return `\`${y+1}.\` ${x.vehicleData.vehicle} • ${x.userTag}${guildSuffix}${vehicleImages.length > 0 ? ' • 📷' : ''}`;
                });
                const pageOutput = new Array(Math.ceil(searchOutput.length / numberOfitemsOnPage))
                .fill()
                .map(_ => searchOutput.splice(0, numberOfitemsOnPage))
                const pages = pageOutput;
                let page = 1;
                if(!searchTerm) searchTerm = 'All';
                const buildFooterText = () =>
                    pages.length > 1
                        ? `${footerData.text} • Page ${page} of ${pages.length}`
                        : footerData.text;

                const searchSelectionEmbed = new EmbedBuilder()
                .setAuthor({
                    name: `${searchType} Search - ${searchTerm}`,
                    iconURL: initiatorAvatar
                })
                .setDescription(pages[page-1].join('\n'))
                .setColor(embedColor)
                .setFooter({
                    text: buildFooterText(),
                    iconURL: footerData.icon
                });

                const buildSelectMenu = () => {
                    const pageItems = searchOrganizedData.slice((page - 1) * numberOfitemsOnPage, page * numberOfitemsOnPage);
                    const options = pageItems.map((item, index) => {
                        const vehicleImages = item.vehicleData.vehicleImages || [];
                        const label = item.vehicleData.vehicle?.slice(0, 100) || `Vehicle ${index + 1}`;
                        const guildSuffix = item.vehicleData.guildId === guildId ? '' : ` • ${item.guildName}`;
                        const description = `${item.userTag}${guildSuffix}${vehicleImages.length > 0 ? ` • ${vehicleImages.length} image${vehicleImages.length === 1 ? '' : 's'}` : ''}`.slice(0, 100);
                        const value = String((page - 1) * numberOfitemsOnPage + index);
                        return { label, description, value };
                    });

                    return new StringSelectMenuBuilder()
                        .setCustomId(`searchSelect+${mainInteractionId}`)
                        .setPlaceholder('Select a vehicle...')
                        .addOptions(options);
                };

                const previousButton = new ButtonBuilder()
                .setCustomId(`previousSearchPage+${mainInteractionId}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);
                const nextButton = new ButtonBuilder()
                .setCustomId(`nextSearchPage+${mainInteractionId}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary);

                let componentsArray = [];
                const menuRow = new ActionRowBuilder().addComponents(buildSelectMenu());
                const navRow = new ActionRowBuilder().addComponents(previousButton, nextButton);
                const globalRow = allowGlobal
                    ? new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`searchGlobal+${mainInteractionId}`)
                            .setLabel('Search Globally')
                            .setStyle(ButtonStyle.Secondary)
                    )
                    : null;
                componentsArray = pages.length > 1 ? [menuRow, navRow] : [menuRow];
                if (globalRow) componentsArray.push(globalRow);
                await interaction.editReply({
                    embeds: [searchSelectionEmbed],
                    components: componentsArray
                });

                const searchMessage = await interaction.fetchReply().catch(() => null);
                const messageId = searchMessage?.id;
                const buttonCollector = interaction.channel.createMessageComponentCollector({
                    time: 600000,
                    componentType: ComponentType.Button,
                    filter: (i) => buttonFilter(i, messageId),
                }); 

                const selectCollector = interaction.channel.createMessageComponentCollector({
                    time: 600000,
                    componentType: ComponentType.StringSelect,
                    filter: (i) =>
                        i.customId === `searchSelect+${mainInteractionId}` &&
                        buttonFilter(i, messageId),
                });
                
                buttonCollector.on('collect', async (collected) => {
					const buttonId = collected.customId;
                    switch(buttonId){
                        case `searchGlobal+${mainInteractionId}`:
                            await collected.deferUpdate();
                            selectCollector.stop('global');
                            buttonCollector.stop('global');
                            resolve({ action: 'global' });
                            return;
                        case `previousSearchPage+${mainInteractionId}`:
                            await collected.deferUpdate();
                            if (page <= 1) return;
								page--;
                                nextButton.setDisabled(false);
								if (page <= 1){
									previousButton.setDisabled(true);
								};
								const previousRow = new ActionRowBuilder().addComponents(previousButton, nextButton);
                                searchSelectionEmbed
                                .setAuthor({
                                    name: `${searchType} Search - ${searchTerm}`,
                                    iconURL: initiatorAvatar
                                })
                                .setDescription(pages[page-1].join('\n'));
                                searchSelectionEmbed.setFooter({
                                    text: buildFooterText(),
                                    iconURL: footerData.icon
                                });
                                const updatedRowsPrev = pages.length > 1
                                    ? [new ActionRowBuilder().addComponents(buildSelectMenu()), previousRow]
                                    : [new ActionRowBuilder().addComponents(buildSelectMenu())];
                                if (globalRow) updatedRowsPrev.push(globalRow);
                                await interaction.editReply({
                                    embeds: [searchSelectionEmbed],
                                    components: updatedRowsPrev
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
                            const nextRow = new ActionRowBuilder().addComponents(previousButton, nextButton);
                            searchSelectionEmbed
                            .setAuthor({
                                name: `${searchType} Search - ${searchTerm}`,
                                iconURL: initiatorAvatar
                            })
                            .setDescription(pages[page-1].join('\n'));
                            searchSelectionEmbed.setFooter({
                                text: buildFooterText(),
                                iconURL: footerData.icon
                            });
                            const updatedRowsNext = pages.length > 1
                                ? [new ActionRowBuilder().addComponents(buildSelectMenu()), nextRow]
                                : [new ActionRowBuilder().addComponents(buildSelectMenu())];
                            if (globalRow) updatedRowsNext.push(globalRow);
                            await interaction.editReply({
                                embeds: [searchSelectionEmbed],
                                components: updatedRowsNext
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

                selectCollector.on('collect', async (collected) => {
                    await collected.deferUpdate();
                    const selectedIndex = parseInt(collected.values[0], 10);
                    const selectedVehicle = searchOrganizedData[selectedIndex];
                    selectCollector.stop('selected');
                    buttonCollector.stop('selected');
                    resolve(selectedVehicle);
                });

                selectCollector.on('end', async (_collected, reason) => {
                    if (reason !== 'selected' && reason !== 'global') {
                        await interaction.editReply({
                            embeds: [searchSelectionEmbed],
                            components: []
                        });
                        resolve(null);
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
