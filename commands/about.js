const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const {
    botInvite,
    embedColor,
    ownerId,
    supportServerInvite,
    patreonLink,
} = require('../modules/constants.js');

const garageSchema = require('../mongodb_schema/garageSchema.js');
const { buildLinkRow } = require('../modules/commandUtils/linkButtons.js');
const { safeExecute } = require('../modules/commandUtils/safeExecute.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Information about the bot and its features.'),
    async execute(interaction) {
        await safeExecute(interaction, async () => {
            const owner = await interaction.client.users.fetch(ownerId);

            const totalGuilds = interaction.client.guilds.cache.size;
            const totalMembers = interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

            const [totalVerifiedRides, verifiedRidesInServer, totalVerifiedUsers, verifiedUsersInServer] = await Promise.all([
                garageSchema.countDocuments(),
                garageSchema.countDocuments({ guildId: interaction.guild.id }),
                garageSchema.distinct('userId').then((users) => users.length),
                garageSchema.distinct('userId', { guildId: interaction.guild.id }).then((users) => users.length),
            ]);

            const inviteEmbed = new EmbedBuilder()
                .setTitle('ThrottleBot Vehicle Verification')
                .setDescription(
                    'ThrottleBot simplifies vehicle verification across Discord by providing a seamless, feature-rich experience.'
                )
                .addFields(
                    {
                        name: 'Features',
                        value:
                            '• A garage system to store and display all your vehicles.\n' +
                            '• Seamless verification process with buttons.\n' +
                            '• Slash commands for powerful and interactive experiences.\n' +
                            '• Syncing across different servers.',
                    },
                    {
                        name: 'Servers',
                        value: `${totalGuilds.toLocaleString()} Servers`,
                        inline: true,
                    },
                    {
                        name: 'Members',
                        value: `${totalMembers.toLocaleString()} Members`,
                        inline: true,
                    },
                    {
                        name: 'Verified Users',
                        value: `${totalVerifiedUsers.toLocaleString()} Users | ${verifiedUsersInServer} Users in this server`,
                        inline: true,
                    },
                    {
                        name: 'Verified Rides',
                        value: `${totalVerifiedRides.toLocaleString()} Vehicles | ${verifiedRidesInServer} Vehicles in this server`,
                        inline: true,
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
                embeds: [inviteEmbed],
                components: [buildLinkRow(links)],
            });
        });
    },
};
