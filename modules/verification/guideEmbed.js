const { EmbedBuilder } = require('discord.js');

function buildVideoGuide(guildName, { uploadOption = 'image' } = {}) {
    return new EmbedBuilder()
        .setTitle('How To Verify — Video Required')
        .setDescription(`All new vehicle verifications in ${guildName} require a video, regardless of vehicle value. Photos alone are no longer accepted.`)
        .addFields(
            {
                name: 'Record Your Verification Video',
                value:
                    '1. Record a short, clear video showing your vehicle and its keys.\n' +
                    `2. Say **${guildName}** and your **Discord username** out loud — not your display name or server nickname.\n` +
                    '3. Clearly show yourself starting the vehicle with your keys in the video.',
            },
            {
                name: 'Submit Your Application',
                value:
                    '1. Use `/verify` and enter your vehicle name.\n' +
                    `2. Attach your video in the \`${uploadOption}\` upload field.\n` +
                    '3. Confirm your submission and wait for staff review. Keep DMs open for updates.\n' +
                    'If the upload is too large, shorten or compress the video while keeping the evidence clear.',
            },
            {
                name: 'Rules & Requirements',
                value:
                    '• The vehicle must be yours. No rentals, borrowed vehicles, or friends’ vehicles.\n' +
                    '• Submit an original, unedited video with clear audio and a clear view of the vehicle and keys.\n' +
                    '• Photos and screenshots do not satisfy the video requirement.\n' +
                    '• AI-generated verification videos are not allowed.',
            },
            {
                name: 'After Verifying',
                value: '1. View your garage with `/garage`.\n2. Add images and descriptions with `/settings`.',
            },
        )
        .setColor('#FFFCFF');
}

function buildVerificationGuide(guildProfile, guildName) {
    if (guildProfile.videoVerificationRequired) {
        return buildVideoGuide(guildName, { uploadOption: guildProfile.guildId === '438650836512669699' ? 'video' : 'image' });
    }
    return new EmbedBuilder()
        .setTitle('How to Verify Your Vehicle')
        .setDescription('Follow the steps below to verify your vehicle. Make sure you meet all requirements.')
        .addFields(
            { name: 'Steps', value:
                '1. Take a picture of your vehicle while holding the keys and a handwritten note with:\n   - Server name\n   - Your Discord username and tag.\n' +
                '2. Use the `/verify` command to upload the image and provide vehicle details.\n' +
                '3. Wait for staff approval (keep DMs open).' },
            { name: 'Rules & Requirements', value:
                '1. The vehicle must be yours (no rentals or friends’ vehicles).\n' +
                '2. Handwritten note must be clear and visible.\n' +
                '3. Image must clearly show the vehicle and note.' },
            { name: 'After Verification', value: '1. View your garage using `/garage`.\n2. Customize your vehicle using `/settings`.' },
        )
        .setImage('https://cdn.discordapp.com/attachments/975485952325726278/999390701471141928/Example_Image_1.png')
        .setColor('#FFFCFF');
}

module.exports = { buildVideoGuide, buildVerificationGuide };
