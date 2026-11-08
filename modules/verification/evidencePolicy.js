const { escapeMarkdown } = require('discord.js');

function attachmentKind(attachment) {
    const mime = typeof attachment?.contentType === 'string'
        ? attachment.contentType.toLowerCase().split(';', 1)[0].trim() : '';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('image/')) return 'image';
    return null;
}

function videoGuidance(guildProfile, { guildName, username } = {}) {
    if (!guildProfile.videoVerificationRequired) {
        return `Make sure your video clearly shows your vehicle and meets the requirements in <#${guildProfile.guideChannelId}>. Server staff will review your video.`;
    }
    const server = guildName ? `**${escapeMarkdown(guildName)}**` : 'this server’s name';
    const user = username ? `**${escapeMarkdown(username)}** (your Discord username)` : 'your Discord username';
    return [
        'Record a short, original, unedited video:',
        '',
        `• Say ${server} out loud.`,
        `• Say ${user} out loud.`,
        '• Clearly show yourself **starting the vehicle with your keys**.',
        '• Keep the vehicle, keys and start visible, with clear audio.',
        '',
        `Read <#${guildProfile.guideChannelId}> and watch the example before submitting.`,
        'Staff will review your video.',
    ].join('\n');
}

function submissionErrorMessage(error, { video = false } = {}) {
    if (error?.code === 'VIDEO_REQUIRED') return error.message;
    if (error?.code === 40005 || /file size|entity too large|payload too large/i.test(error?.message || '')) {
        return video
            ? 'Your video is too large to upload. Shorten or compress it while keeping your voice audible and the vehicle, keys and start clearly visible, then try `/verify` again.'
            : 'The uploaded file is too large for this server. Please upload a smaller file.';
    }
    return video
        ? 'Something went wrong while processing your video verification. Please try again or contact server staff for help.'
        : 'An unexpected error occurred while processing your verification request.';
}

function assertEvidenceAllowed(guildProfile, attachment, context = {}) {
    if (guildProfile.videoVerificationRequired === true && attachmentKind(attachment) !== 'video') {
        const error = new Error(`This server requires video verification for every vehicle. ${videoGuidance(guildProfile, context)} Photos are not accepted.`);
        error.code = 'VIDEO_REQUIRED';
        throw error;
    }
}

module.exports = { attachmentKind, videoGuidance, assertEvidenceAllowed, submissionErrorMessage };
