case `removeImage+${mainInteractionId}`:
										async function removeImageOption(){
											if(!buttonCollected.deferred) await buttonCollected.deferUpdate();
											const vehicleImagesOutput = vehicleImages.map((x, i) => `${`\`${i+1}.\` [Click Here](${x})`}`)
											const removeImageSelectionEmbed = new MessageEmbed()
											.setAuthor({
												name: `${vehicleName} - Remove Vehicle Image`,
												iconURL: initiatorAvatar
											})
											.setDescription('Please click on the \'Delete\' button to remove the image you wish to remove.')
											.addField('Vehicle', `[${vehicleName}](${verificationImage})`, true)
											.addField('Owner', initiatorTag, true)
											.addField('Image(s)', vehicleImagesOutput.join('\n'))
											.setColor(embedColor)
											.setFooter({
												text: footerText,
												iconURL: footerIcon
											});
											const buttonsRow = new MessageActionRow()
											.addComponents(
												new MessageButton()
													.setLabel('Previous')
													.setStyle('SECONDARY')
													.setCustomId(`previousImage+${mainInteractionId}`),
												new MessageButton()
													.setLabel('Next')
													.setStyle('SECONDARY')
													.setCustomId(`nextImage+${mainInteractionId}`),
												new MessageButton()
													.setLabel('Delete Image')
													.setStyle('DANGER')
													.setCustomId(`deleteImage+${mainInteractionId}`),
												new MessageButton()
													.setLabel('Back')
													.setStyle('SECONDARY')
													.setCustomId(`removeImageBack+${mainInteractionId}`),
												new MessageButton()
													.setLabel('Exit')
													.setStyle('DANGER')
													.setCustomId(`removeImageExit+${mainInteractionId}`),
											);
											await interaction.editReply({
												embeds: [removeImageSelectionEmbed],
												components: [buttonsRow]
											});
											
											let whetherButtonCollected = false;
											const buttonCollector = interaction.channel.createMessageComponentCollector({
												filter: buttonFilter,
												max: 1,
												componentType: 'BUTTON',
												time: 60000
											});
											
											buttonCollector.on('end', async (allCollected) => {
												const collected = allCollected?.first();
												if(!collected) return;
												whetherButtonCollected = true;
												await collected.deferUpdate();
												const buttonId = collected.customId;
												if(buttonId === `removeImageBack+${mainInteractionId}`){
													return imagesOption();
												}else if(buttonId === `removeImageExit+${mainInteractionId}`){
													await interaction.deleteReply();
												};
											});

											const messageCollector = interaction.channel.createMessageCollector({ filter: messageFilter, time: 60000, max: 1});
											messageCollector.on('end', async (allCollected) => {
												const collected = allCollected.first();
												if(!collected){
													if(whetherButtonCollected){
														return;
													}else{
														await interaction.deleteReply();
													};
												};
												buttonCollector.stop();
												const messageContent = collected.content;
												const allowedResponses = Array.from(Array(vehicleImages.length + 1).keys()).slice(1).map(x => `${x}`);
												const selectedOption = removeNonIntegers(messageContent);
												if(!allowedResponses.includes(selectedOption)){
													await interaction.followUp({
														embeds:[errorEmbed('You entered an invalid input, going back to image menu...')],
														ephemeral: true
													});
													return imagesOption();
												};
												const selectedIndex = parseInt(selectedOption) - 1
												const vehicleImagesOutputNew = vehicleImages.map((x,i) => {
													if(i !== selectedIndex){
														return `${`\`${i+1}.\` [Click Here](${x})`}`
													}else{
														return `${`\`${i+1}.\` ~~[Click Here](${x})~~`}`
													};
												});
												const imageRemoved = vehicleImages[selectedIndex]
												vehicleImages.splice(selectedIndex, 1);

												await garageSchema.updateOne({guildId: guildId, userId: initiatorId, vehicle: vehicleName }, {$set: {vehicleImages: vehicleImages }})
												.catch(async e => {
													await interaction.editReply({
														embeds: [errorEmbed(e, initiatorAvatar)],
														components: []
													})
													return;
												});
												
												const removeImageConfirmationEmbed = new MessageEmbed()
												.setAuthor({
													name: 'Removed Vehicle Image Successfully',
													iconURL: initiatorAvatar
												})
												.setDescription(`The [image](${imageRemoved}) has been removed from your vehicle successfully.`)
												.addField('Vehicle', `[${vehicleName}](${verificationImage})`, true)
												.addField('Owner', initiatorTag, true)
												.addField('Image(s)', vehicleImagesOutputNew.join('\n'))
												.setColor(greenColor)
												.setFooter({
													text: footerText,
													iconURL: footerIcon
												});
												const buttonsRow = new MessageActionRow()
												.addComponents(
													new MessageButton()
														.setLabel('Back')
														.setStyle('SECONDARY')
														.setCustomId(`removeImageConfirmedBack+${mainInteractionId}`),
													new MessageButton()
														.setLabel('Exit')
														.setStyle('DANGER')
														.setCustomId(`removeImageConfirmedExit+${mainInteractionId}`),
												);
												await interaction.editReply({
													embeds: [removeImageConfirmationEmbed],
													components: [buttonsRow]
												});

												const removeImageLogEmbed = new MessageEmbed()
												.setAuthor({
													name: 'Vehicle Image Removed',
													iconURL: initiatorAvatar
												})
												.setDescription(`An [image](${imageRemoved}) was removed from the vehicle specified below.`)
												.addField('Vehicle', `[${vehicleName}](${verificationImage})`, true)
												.addField('Owner', initiatorTag, true)
												.addField('Image(s)', vehicleImagesOutputNew.join('\n'))
												.setThumbnail(imageRemoved)
												.setColor(greenColor)
												.setFooter({
													text: footerText,
													iconURL: footerIcon
												});
												logChannel.send({
													embeds: [removeImageLogEmbed]
												});
												const buttonCollected = await interaction.channel.awaitMessageComponent({ filter: buttonFilter, componentType: 'BUTTON', time: 60000, max: 1 })
												.catch(e => {});
												if(!buttonCollected){
													await interaction.editReply({
														embeds: [removeImageConfirmationEmbed],
														components: []
													});
													return;
												};
												const buttonId = buttonCollected.customId;
												switch(buttonId){
													case `removeImageConfirmedBack+${mainInteractionId}`:
														async function removeImageConfirmedBack(){
															await buttonCollected.deferUpdate();
															return imagesOption();
														};
														removeImageConfirmedBack();
														break;
													case `removeImageConfirmedExit+${mainInteractionId}`:
														async function removeImageConfirmedExit(){
															await buttonCollected.deferUpdate();
															await interaction.deleteReply();
														};
														removeImageConfirmedExit();
														break;
												};

											});
										};
										removeImageOption();
										break;
									