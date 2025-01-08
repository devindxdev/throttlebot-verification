const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
} = require('discord.js');
const { botInvite, botInviteAdmin, ownerId } = require('../modules/constants.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite the bot to your own server!'),
    async execute(interaction) {

			const owner = await interaction.client.users.fetch(ownerId);
            // Create the embed
            const inviteEmbed = new EmbedBuilder()
                .setTitle('ThrottleBot Vehicle Verification')
                .setDescription(
                    "We're simplifying the process of verifying your vehicles across Discord by providing a seamless and feature-rich experience.\n" +
                    "The bot utilizes Discord's latest API features to deliver a powerful and interactive experience."
                )
                .addFields(
                    {
                        name: 'Features',
                        value:
                            '• A garage system to store and display all your vehicles.\n' +
                            '• Seamless verification process with the help of buttons.\n' +
                            '• Slash commands for a powerful and interactive experience.\n' +
                            '• Syncing across different servers.',
                    }
                )
                .setColor('#FFFCFF')
                .setFooter({
					text: `Made with 💖 by ${owner.username}`,
					iconURL: owner.displayAvatarURL({ dynamic: true }),
				});

            // Create buttons for invites
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Invite')
                    .setStyle(ButtonStyle.Link)
                    .setURL(botInvite),
                new ButtonBuilder()
                    .setLabel('Invite (Admin)')
                    .setStyle(ButtonStyle.Link)
                    .setURL(botInviteAdmin)
            );

            // Reply to the interaction with the embed and buttons
            await interaction.reply({
                embeds: [inviteEmbed],
                components: [buttons],
                ephemeral: true, 
            });
	}
};
