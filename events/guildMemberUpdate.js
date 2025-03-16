const { obtainUserProfile } = require('../modules/database.js');
const { 
    patreonLogChannelId, 
    botIcon, 
    patreonT1, 
    patreonT2, 
    patreonT3, 
    patreonT4, 
    patreonRedColor, 
    supportServerId 
} = require('../modules/constants.js');
const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const userProfileSchema = require('../mongodb_schema/userProfileSchema.js');

module.exports = {
    name: 'guildMemberUpdate',
    once: false,
    /**
     * Executes whenever a member's roles or profile is updated.
     * @param {import('discord.js').GuildMember} oldMember - The member before the update.
     * @param {import('discord.js').GuildMember} newMember - The member after the update.
     */
    async execute(oldMember, newMember) {
        if (oldMember.user.bot) return;

        const guildId = newMember.guild.id;
        if (guildId !== supportServerId) return;

        const userId = newMember.user.id;
        const userTag = newMember.user.tag;
        const oldRoles = new Set(oldMember.roles.cache.keys());
        const newRoles = new Set(newMember.roles.cache.keys());
        const addedRoles = [...newRoles].filter(role => !oldRoles.has(role));

        // Fetch the Patreon log channel
        const patreonLogChannel = await newMember.client.channels.fetch(patreonLogChannelId);

        for (const role of addedRoles) {
            if ([patreonT1, patreonT2, patreonT3, patreonT4].includes(role)) {
                // Ensure user profile exists
                let userProfile = await obtainUserProfile(userId);
                if (!userProfile) {
                    const newUserProfile = new userProfileSchema({
                        _id: mongoose.Types.ObjectId(),
                        userId,
                        premiumUser: false,
                        premiumTier: 0,
                        embedColor: '',
                        garageThumbnail: '',
                    });
                    try {
                        await newUserProfile.save();
                        userProfile = newUserProfile; // Use the newly created profile
                    } catch (err) {
                        console.error(`Error saving user profile: ${err.message}`);
                        continue;
                    }
                }

                // Determine the premium tier based on the role
                const premiumTierMap = {
                    [patreonT1]: 1,
                    [patreonT2]: 2,
                    [patreonT3]: 3,
                    [patreonT4]: 4,
                };

                const premiumTier = premiumTierMap[role];
                if (!premiumTier) continue;

                // Update the user profile in the database
                try {
                    await userProfile.updateOne({ 
                        userId 
                    }, { 
                        $set: { premiumUser: true, premiumTier } 
                    });
                } catch (err) {
                    console.error(`Error updating user profile: ${err.message}`);
                    continue;
                }

                // Create an embed for the Patreon log
                const patreonLogEmbed = new EmbedBuilder()
                    .setTitle('New Patron Registered')
                    .setDescription('A new patron was registered into the database.')
                    .addFields(
                        { name: 'User', value: `${userTag} | <@${userId}>`, inline: true },
                        { name: 'Tier', value: `<@&${role}>`, inline: true }
                    )
                    .setColor(patreonRedColor)
                    .setFooter({ text: 'ThrottleBot Vehicle Verification', iconURL: botIcon });

                // Send the embed to the Patreon log channel
                if (patreonLogChannel) {
                    await patreonLogChannel.send({ embeds: [patreonLogEmbed] });
                }
            }
        }
    },
};
