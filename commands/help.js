const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { botInvite, supportServerInvite, githubLink, ownerTag, ownerAvatar, patreonLink} = require('../modules/utility.js');
const garageSchema = require('../mongodb_schema/garageSchema.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Starting guide for dummies.'),
	async execute(interaction) {
        await interaction.deferReply({ ephemral: true });
        const initiatorId = interaction.user.id;
		const initiatorUsername = interaction.user.username;
		const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });
        const totalVerifiedRides = (await garageSchema.find()).length
        const supportEmbed = new MessageEmbed()
        .setTitle('ThrottleBot Vehicle Verification')
        .setDescription('We\'re simplifying the process of verifying your vehicles across Discord by providing a seamless and feature full experience.\nThe bot utilizes Discord\'s latest API version V9 to provide you with the latest features that are available.')
        .addField('Usage','The bot only uses slash commands. Simply type `/` and you will notice the slash command interface pop up. Select the ThrottleBot avatar/logo and you will see all of the bots commands.\nClick on the command you wish to execute and hit enter.\nAlternatively you can also type the command as `/command`\nExample: `/about`\nDiscord Guide: [Click Here](https://support.discord.com/hc/en-us/articles/1500000368501-Slash-Commands-FAQ)')
        .addField('Setting up the bot','Setting up the bot is really easy, simply use the `/setup` command and follow the instructions mentioned.')
        .addField('Need Support?', 'Click on the support button down below to join our support server!')
        .setColor('#FFFCFF')
        .setFooter({
            text: `Made with 💖 by ${ownerTag}`,
            iconURL: ownerAvatar
        });

        const InviteButton = new MessageButton()
        .setLabel('Invite')
        .setStyle('LINK')
        .setURL(botInvite);

        const supportServerButton = new MessageButton()
        .setLabel('Support Server')
        .setStyle('LINK')
        .setURL(supportServerInvite);

        const patreonButton = new MessageButton()
        .setLabel('Patreon')
        .setStyle('LINK')
        .setURL(patreonLink);

        const row = new MessageActionRow() 
        .addComponents(InviteButton, supportServerButton, patreonButton, githubLinkButton)
        
        await interaction.editReply({
            embeds: [supportEmbed],
            components: [row]
        });

	},
};