const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { botInvite, botInviteAdmin, ownerId } = require('../modules/constants.js');
const { buildLinkRow } = require('../modules/commandUtils/linkButtons.js');
const { safeExecute } = require('../modules/commandUtils/safeExecute.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite the bot to your own server!'),
    async execute(interaction) {

        await safeExecute(interaction, async () => {
            const owner = await interaction.client.users.fetch(ownerId);

            const inviteEmbed = new EmbedBuilder()
                .setTitle('ThrottleBot Vehicle Verification')
                .setDescription(
                    "We're simplifying the process of verifying your vehicles across Discord by providing a seamless and feature-rich experience.\n" +
                        "The bot utilizes Discord's latest API features to deliver a powerful and interactive experience."
                )
                .addFields({
                    name: 'Features',
                    value:
                        '• A garage system to store and display all your vehicles.\n' +
                        '• Seamless verification process with the help of buttons.\n' +
                        '• Slash commands for a powerful and interactive experience.\n' +
                        '• Syncing across different servers.',
                })
                .setColor('#FFFCFF')
                .setFooter({
                    text: `Made with 💖 by ${owner.username}`,
                    iconURL: owner.displayAvatarURL({ dynamic: true }),
                });

            const links = [
                { label: 'Invite', url: botInvite },
                { label: 'Invite (Admin)', url: botInviteAdmin },
            ];

            await interaction.reply({
                embeds: [inviteEmbed],
                components: [buildLinkRow(links)],
                ephemeral: true,
            });
        });
    },
};
