const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    MessageEmbed,
    MessageActionRow,
    MessageSelectMenu,
    MessageButton,
    Modal,
    TextInputComponent,
    PermissionsBitField,
} = require('discord.js');
const { obtainGuildProfile, defaultEmbedColor, obtainUserProfile, obtainAllUserVehicles } = require('../modules/database.js');
//const { vehicleSelection } = require('../modules/commandModules/garage/vehicleSelection.js');
const { manageDashboard } = require('../modules/commandModules/manage/main.js');
const userProfileSchema = require('../mongodb_schema/userProfileSchema.js');
const garageSchema = require('../mongodb_schema/garageSchema.js');
const { botIcon, greenColor, redColor, garageIconExample, garageEmbedColorExample, errorEmbed, removeNonIntegers, isValidHttpUrl, patreonAdvertEmbed } = require('../modules/utility.js');
const wait = require('node:timers/promises').setTimeout;
var isHexColor = require('validate.io-color-hexadecimal');
const { error } = require('node:console');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('manage')
		.setDescription('Staff-only: manage verified vehicles. For your own edits, use `/settings`.')
		.addUserOption(option => option.setName('user').setDescription('Manage the mentioned user.')),
	async execute(interaction) {
		if(!interaction.deferred) await interaction.deferReply({ ephemeral: false });
		//Initiator info
		const initiatorData = interaction.user;
		const initiatorId = interaction.user.id;
		const initiatorUsername = interaction.user.username;
		const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });
		const initiatorTag = interaction.user.tag;
        const hasManageNicknames = interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageNicknames);
        const isPrivilegedUser = initiatorId === "378171973429231616";
		if(!hasManageNicknames && !isPrivilegedUser){
			interaction.editReply({
				embeds: [errorEmbed('You do not have authorization to use this command. This tool is for staff. Please use `/settings` to edit your own vehicles.', initiatorAvatar)]
			});
			return;
		};
		const userData = interaction.options.getUser('user') 
		|| interaction.user;
		const userId = userData.id;
		const username = userData.username;
		const userAvatar = userData.displayAvatarURL({ dynamic: true });
		const userTag = userData.tag;
		if(userData.bot){
			interaction.editReply({
				embeds: [errorEmbed('Bots..cannot have verified rides....', initiatorAvatar)]
			});
			return;
		};
		//Guild information
		const guildData = interaction.guild;
		const guildId = interaction.guild.id;
		const guildName = interaction.guild.name;
		const guildIcon = interaction.guild.iconURL({ dynamic: true });	
		//Misc
		const embedColor = await defaultEmbedColor(initiatorId);
		

		manageDashboard(interaction, initiatorData, userData, guildData, embedColor);		
	},
	
};
