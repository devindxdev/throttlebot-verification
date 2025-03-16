const { obtainGuildProfile } = require('../modules/database.js');
const { guildJoinLogChannelId, botIcon } = require('../modules/constants.js');
const { EmbedBuilder, ChannelType } = require('discord.js');
const mongoose = require('mongoose');
const guildProfileSchema = require('../mongodb_schema/guildProfileSchema.js');
const moment = require('moment');

module.exports = {
    name: 'guildCreate',
    once: false,
    /**
     * Executes whenever the bot is added to a new server.
     * @param {import('discord.js').Guild} guild - The guild object
     */
    async execute(guild) {
        try {
            // Fetch the log channel
            const guildJoinLogChannel = await guild.client.channels.fetch(guildJoinLogChannelId);

            // Collect guild details
            const guildName = guild.name;
            const guildId = guild.id;
            const guildIcon = guild.iconURL({ dynamic: true });
            const guildOwnerId = guild.ownerId;
            const guildMemberCount = guild.memberCount;
            const todaysDate = moment.utc();

            // Calculate total guilds and members
            const totalGuilds = guild.client.guilds.cache.size;
            const totalMembers = guild.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

            // Check and create a guild profile if it doesn't exist
            const guildProfile = await obtainGuildProfile(guildId);
            if (!guildProfile) {
                await createGuildProfile(guildId, todaysDate);
            }

            // Generate a server invite
            let inviteLink = 'Missing permissions';
            try {
                const invite = await guild.channels.cache
                    .find(channel => channel.type === ChannelType.GuildText)
                    ?.createInvite({ maxAge: 0, maxUses: 0 });
                inviteLink = invite ? invite.url : 'No suitable channel found';
            } catch {
                // Ignored - will use default "Missing permissions"
            }

            // Create an embed for the guild join log
            const guildJoinLogEmbed = new EmbedBuilder()
                .setTitle(guildName)
                .setThumbnail(guildIcon)
                .setDescription(
                    `The bot was added to a new server! Now serving a total of **${totalGuilds.toLocaleString()} servers** with **${totalMembers.toLocaleString()} members**.\nBelow are the server details.`
                )
                .addFields(
                    { name: 'Name', value: guildName, inline: true },
                    { name: 'Server ID', value: guildId, inline: true },
                    { name: 'Owner', value: `<@${guildOwnerId}> | ${guildOwnerId}`, inline: true },
                    { name: 'Member Count', value: `${guildMemberCount.toLocaleString()} Members`, inline: true },
                    { name: 'Invite Link', value: inviteLink, inline: true }
                )
                .setColor('#FFFCFF')
                .setTimestamp()
                .setFooter({
                    text: 'ThrottleBot Vehicle Verification',
                    iconURL: botIcon
                });

            // Send the embed to the log channel
            if (guildJoinLogChannel) {
                await guildJoinLogChannel.send({ embeds: [guildJoinLogEmbed] });
            }
        } catch (error) {
            console.error(`Error in guildCreate event: ${error.message}`);
        }
    }
};

/**
 * Creates a guild profile in the database.
 * @param {string} guildId - The guild ID
 * @param {moment.Moment} todaysDate - The date of addition
 */
async function createGuildProfile(guildId, todaysDate) {
    try {
        const serverProfileDocument = new guildProfileSchema({
            _id: mongoose.Types.ObjectId(),
            guildId,
            guideChannelId: null,
            verificationChannelId: null,
            loggingChannelId: null,
            verifiedVehicleRoleId: null,
            addedOn: todaysDate,
            customFooterIcon: null,
            syncEnabled: false,
            syncedGuildId: null,
        });

        const result = await serverProfileDocument.save();
        console.log(`New server profile created:\n${result}`);
    } catch (error) {
        console.error(`Error creating guild profile: ${error.message}`);
    }
}
