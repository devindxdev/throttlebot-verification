const { obtainGuildProfile, obtainAllUserVehicles, defaultEmbedColor } = require('../../database.js');
const { errorEmbed } = require('../../utility.js');

/**
 * Collects and validates all data required for the settings command.
 * Returns `{ session }` on success or `{ errorEmbed }` on failure.
 */
async function buildSettingsSession(interaction) {
    const initiator = interaction.user;
    const guild = interaction.guild;
    const guildId = guild.id;
    const guildName = guild.name;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });

    const guildProfile = await obtainGuildProfile(guildId);
    if (!guildProfile) {
        return {
            errorEmbed: errorEmbed(
                'Server profile not setup, please kick the bot and invite it again.',
                initiatorAvatar
            ),
        };
    }

    const { verificationChannelId, guideChannelId, loggingChannelId, customFooterIcon } = guildProfile;
    if (!verificationChannelId || !guideChannelId || !loggingChannelId) {
        return {
            errorEmbed: errorEmbed(
                'This server has not been setup properly, please ask the moderation team to use the `/setup` command.',
                initiatorAvatar
            ),
        };
    }

    const logChannel = await interaction.member.guild.channels.fetch(loggingChannelId).catch(() => null);
    if (!logChannel) {
        return {
            errorEmbed: errorEmbed(
                'Failed to obtain the log channel where the logs are sent. Please ask staff to set it up.',
                initiatorAvatar
            ),
        };
    }

    const garageData = await obtainAllUserVehicles(initiator.id, guildId);
    if (!garageData || garageData.length === 0) {
        return {
            errorEmbed: errorEmbed(
                `**${initiator.username},**\nYou do not have any verified rides! Please have them verified first by using the \`/verify\` command first.`,
                initiatorAvatar
            ),
        };
    }

    const embedColor = (await defaultEmbedColor(initiator.id)) || '#FFFCFF';
    const footerIcon = customFooterIcon || guild.iconURL({ dynamic: true });
    const footerText = `${guildName} • Vehicle Verification`;

    return {
        session: {
            interaction,
            initiator,
            guild,
            embedColor,
            footer: { text: footerText, icon: footerIcon },
            garageData,
            logChannel,
            initiatorAvatar,
        },
    };
}

module.exports = { buildSettingsSession };
