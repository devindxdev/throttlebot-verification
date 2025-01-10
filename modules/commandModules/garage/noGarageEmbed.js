const { EmbedBuilder } = require('discord.js');

module.exports = (user, guildProfile) => {
    try {
        const passportEnabled = guildProfile.passportEnabled;
        const guideChannelId = guildProfile.guideChannelId;
        const userTag = user.tag;
        const userAvatar = user.displayAvatarURL({ dynamic: true });

        // Create the embed
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${userTag}'s Garage`,
                iconURL: userAvatar,
            })
            .setColor('#FF6961') // Red color for no vehicles
            .setFooter({
                text: 'Vehicle Verification',
                iconURL: guildProfile.footerIcon || null,
            });

        // Message depending on whether passport is enabled
        if (passportEnabled) {
            embed.setDescription(
                `No verified vehicles found for **${userTag}**.\n\nThis server is linked to a [Global Passport server](https://discord.com/invite/cars). You can verify vehicles in either this server or the linked Passport Server.`
            );
        } else {
            embed.setDescription(
                `No verified vehicles found for **${userTag}**.\n\nTo get started, verify your vehicles by following the guide in <#${guideChannelId}>.`
            );
        }

        return embed;
    } catch (error) {
        console.error('Error creating noGarageEmbed:', error);
        throw new Error('Failed to create the no garage embed.');
    }
};
