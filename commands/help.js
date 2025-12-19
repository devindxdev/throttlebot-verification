const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { botInvite, supportServerInvite, patreonLink, embedColor, ownerId } = require('../modules/constants.js');
const { buildLinkRow } = require('../modules/commandUtils/linkButtons.js');
const { safeExecute } = require('../modules/commandUtils/safeExecute.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Provides guidance on using the bot.'),
    async execute(interaction) {

        await safeExecute(interaction, async () => {
            const owner = await interaction.client.users.fetch(ownerId);

            const supportEmbed = new EmbedBuilder()
                .setTitle('ThrottleBot Vehicle Verification')
                .setDescription(
                    "Simplify the process of verifying your vehicles across Discord with ThrottleBot. Enjoy a seamless, feature-packed experience using Discord's latest API capabilities."
                )
                .addFields(
                    {
                        name: 'Usage',
                        value:
                            '1. ThrottleBot uses slash commands exclusively. Type `/` to bring up the slash command interface. Select the ThrottleBot logo to see all commands.\n' +
                            '2. Click the desired command and press Enter.\n' +
                            '3. Alternatively, type `/command`. Example: `/about`.\n' +
                            '4. [Discord Slash Commands Guide](https://support-apps.discord.com/hc/en-us/articles/26501837786775-Slash-Commands-FAQ)',
                    },
                    {
                        name: 'Setting Up the Bot',
                        value:
                            'Setting up ThrottleBot is easy! Use the `/setup` command and follow the on-screen instructions.',
                    },
                    {
                        name: 'Need Support?',
                        value: 'Click the "Support Server" button below to join our support community!',
                    }
                )
                .setColor(embedColor)
                .setFooter({
                    text: `Made with 💖 by ${owner.username}`,
                    iconURL: owner.displayAvatarURL({ dynamic: true }),
                });

            const links = [
                { label: 'Invite', url: botInvite },
                { label: 'Support Server', url: supportServerInvite },
                { label: 'Patreon', url: patreonLink },
            ];

            await interaction.reply({
                embeds: [supportEmbed],
                components: [buildLinkRow(links)],
            });
        });
    },
};
