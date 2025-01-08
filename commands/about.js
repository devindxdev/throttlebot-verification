const { SlashCommandBuilder } = require('@discordjs/builders');

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const {
    botInvite,
    supportServerInvite,
    githubLink,
    ownerTag,
    ownerAvatar,
    patreonLink,
} = require('../modules/utility.js');

const garageSchema = require('../mongodb_schema/garageSchema.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Information regarding the bot.'),
    async execute(interaction) {
        
        const ownerId = '378171973429231616'; 
        const owner = await interaction.client.users.fetch(ownerId); 
        
        let totalGuilds = 0;
        let totalMembers = 0;
        interaction.client.guilds.cache.forEach((x) => {
            const memberCount = x.memberCount;
            totalGuilds++;
            totalMembers += memberCount;
        });
        const totalVerifiedRides = (await garageSchema.find()).length;
        const verifiedRidesInServer = (await garageSchema.find({ guildId: interaction.guild.id })).length;
        const totalVerifiedUsers = (await garageSchema.distinct('userId')).length;
        const verifiedUsersInServer = (await garageSchema.distinct('userId', { guildId: interaction.guild.id })).length;

        const inviteEmbed = new EmbedBuilder()
            .setTitle('ThrottleBot Vehicle Verification')
            .setDescription(
                "We're simplifying the process of verifying your vehicles across Discord by providing a seamless and feature full experience."
            )
            .addFields(
                {
                    name: 'Features',
                    value:
                        '• A garage system to store and display all your vehicles.\n• Seamless verification process with the help of buttons.\n• Slash commands for a powerful and interactive experience.\n• Syncing across different servers.',
                },
                {
                    name: 'Servers',
                    value: `${totalGuilds.toLocaleString()} Servers`,
                    inline: true,
                },
                {
                    name: 'Verified Users',
                    value: `${totalVerifiedUsers.toLocaleString()} Users | ${verifiedUsersInServer} Users In Server`,
                    inline: true,
                },
                {
                    name: 'Verified Rides',
                    value: `${totalVerifiedRides.toLocaleString()} Vehicles | ${verifiedRidesInServer} Vehicles In Server`,
                    inline: true,
                }
            )
            .setColor('#FFFCFF')
            .setFooter({
                text: `Made with 💖 by ${owner.username}`,
                iconURL: owner.displayAvatarURL({ dynamic: true }),
            });

        const inviteButton = new ButtonBuilder()
            .setLabel('Invite')
            .setStyle(ButtonStyle.Link)
            .setURL(botInvite);

        const supportServerButton = new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL(supportServerInvite);

        const patreonButton = new ButtonBuilder()
            .setLabel('Patreon')
            .setStyle(ButtonStyle.Link)
            .setURL(patreonLink);

        const row = new ActionRowBuilder().addComponents(
            inviteButton,
            supportServerButton,
            patreonButton
        );

        await interaction.reply({
            embeds: [inviteEmbed],
            components: [row],
        });
    },
};
