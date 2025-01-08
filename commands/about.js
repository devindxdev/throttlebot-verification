const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    botInvite,
    embedColor,
    ownerId,
    supportServerInvite,
    patreonLink,
} = require('../modules/constants.js');

const garageSchema = require('../mongodb_schema/garageSchema.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Information about the bot and its features.'),
    async execute(interaction) {

        // Fetch owner details dynamically
        const owner = await interaction.client.users.fetch(ownerId);

        // Aggregate guild data
        const totalGuilds = interaction.client.guilds.cache.size;
        const totalMembers = interaction.client.guilds.cache.reduce(
            (acc, guild) => acc + guild.memberCount,
            0
        );

        // Query database for stats
        const [totalVerifiedRides, verifiedRidesInServer, totalVerifiedUsers, verifiedUsersInServer] =
            await Promise.all([
                garageSchema.countDocuments(), // Total verified rides
                garageSchema.countDocuments({ guildId: interaction.guild.id }), // Rides in current server
                garageSchema.distinct('userId').then((users) => users.length), // Total verified users
                garageSchema
                    .distinct('userId', { guildId: interaction.guild.id })
                    .then((users) => users.length), // Users in current server
            ]);

        // Create the embed
        const inviteEmbed = new EmbedBuilder()
            .setTitle('ThrottleBot Vehicle Verification')
            .setDescription(
                "ThrottleBot simplifies vehicle verification across Discord by providing a seamless, feature-rich experience."
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
            .setColor(embedColor) // Use the constant for the embed color
            .setFooter({
                text: `Made with 💖 by ${owner.username}`,
                iconURL: owner.displayAvatarURL({ dynamic: true }),
            });

        // Create buttons
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Invite')
                .setStyle(ButtonStyle.Link)
                .setURL(botInvite),
            new ButtonBuilder()
                .setLabel('Support Server')
                .setStyle(ButtonStyle.Link)
                .setURL(supportServerInvite),
            new ButtonBuilder()
                .setLabel('Patreon')
                .setStyle(ButtonStyle.Link)
                .setURL(patreonLink)
        );

        // Reply with the embed and buttons
        await interaction.reply({
            embeds: [inviteEmbed],
            components: [buttons],
        });
    },
};
