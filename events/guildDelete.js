const { guildLeaveLogChannelId } = require('../modules/constants.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'guildDelete',
    once: false,
    /**
     * Executes whenever the bot is removed from a server.
     * @param {import('discord.js').Guild} guild - The guild object
     */
    async execute(guild) {
        try {
            // Fetch the log channel
            const guildLeaveLogChannel = await guild.client.channels.fetch(guildLeaveLogChannelId);

            // Collect guild details
            const guildName = guild.name ?? 'Unknown Server';
            const guildId = guild.id;
            const guildIcon = guild.iconURL({ dynamic: true }) ?? null;
            const guildOwnerId = guild.ownerId ?? 'Unknown Owner';
            const guildMemberCount = guild.memberCount ?? 0;

            // Calculate total guilds and members
            const totalGuilds = guild.client.guilds.cache.size;
            const totalMembers = guild.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

            // Create an embed for the guild leave log
            const guildLeaveLogEmbed = new EmbedBuilder()
                .setTitle(guildName)
                .setThumbnail(guildIcon)
                .setDescription(
                    `The bot was removed from a server! Now serving a total of **${totalGuilds.toLocaleString()} servers** with **${totalMembers.toLocaleString()} members.**\nBelow are the server details.`
                )
                .addFields(
                    { name: 'Name', value: guildName, inline: true },
                    { name: 'Server ID', value: guildId, inline: true },
                    { name: 'Owner', value: `<@${guildOwnerId}> | ${guildOwnerId}`, inline: true },
                    { name: 'Member Count', value: `${guildMemberCount.toLocaleString()} members`, inline: true }
                )
                .setColor('#FFFCFF')
                .setTimestamp()
                .setFooter({
                    text: 'ThrottleBot Vehicle Verification',
                });

            // Send the embed to the log channel
            if (guildLeaveLogChannel) {
                await guildLeaveLogChannel.send({ embeds: [guildLeaveLogEmbed] });
            }
        } catch (error) {
            console.error(`Error in guildDelete event: ${error.message}`);
        }
    },
};
