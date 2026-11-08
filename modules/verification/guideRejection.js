const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require('discord.js');
const { buildVerificationGuide } = require('./guideEmbed');

function buildGuideRejectionMessage({ application, guildProfile, guildName, footerIcon }) {
    const guide = buildVerificationGuide(guildProfile, guildName).toJSON();
    const submission = guildProfile.videoVerificationRequired ? 'a new video' : 'a new application';
    const embed = new EmbedBuilder()
        .setTitle('Verification Rejected')
        .setDescription(
            `Your verification application for **${escapeMarkdown(application.vehicle)}** has been **rejected** because it did not meet the verification requirements.\n\n` +
            `Read the guide below, then submit ${submission} using \`/verify\` when you are ready.\n\n${guide.description || ''}`
        )
        .addFields(guide.fields || [])
        .setColor('#FF6961')
        .setFooter({ text: `${guildName} • Vehicle Verification`, ...(footerIcon ? { iconURL: footerIcon } : {}) });

    // Photo-accepting servers can retain their example image. Video guides have
    // no image, author icon or thumbnail: their only server logo is the footer.
    if (guide.image?.url) embed.setImage(guide.image.url);
    const payload = { embeds: [embed], allowedMentions: { parse: [] } };
    if (guildProfile.guideChannelId) {
        const isTcc = application.guildId === '438650836512669699';
        const hasExample = isTcc && guildProfile.guideChannelId === '630811744213925916';
        const url = `https://discord.com/channels/${application.guildId}/${guildProfile.guideChannelId}` +
            (hasExample ? '/982331631236956260' : '');
        payload.components = [new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setLabel(hasExample && guildProfile.videoVerificationRequired ? 'View Guide & Video Example' : 'View Server Guide')
            .setStyle(ButtonStyle.Link).setURL(url))];
    }
    return payload;
}

module.exports = { buildGuideRejectionMessage };
