const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const userProfileSchema = require('../../mongodb_schema/userProfileSchema.js');
const { obtainGuildProfile, obtainUserProfile } = require('../database.js');
const { errorEmbed } = require('../utility.js');

/**
 * Bans a user from submitting future verification applications.
 */
module.exports = async function handleVerificationBan(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const guildId = interaction.guild.id;
        const moderatorId = interaction.user.id;
        const moderatorTag = interaction.user.tag;

        const guildProfile = await obtainGuildProfile(guildId);
        if (!guildProfile) throw new Error('Server profile not set up.');

        const footerIcon = guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true });
        const footerText = `${interaction.guild.name} • Vehicle Verification`;

        const applicationMessageId = interaction.message.id;
        const application = await verificationSchema.findOne({
            applicationMessageId,
            guildId,
            status: 'open',
        });
        if (!application) throw new Error('No open verification application found for this message.');

        // Ensure user profile exists and mark banned
        const existingProfile = await obtainUserProfile(application.userId);
        if (!existingProfile) {
            await userProfileSchema.create({
                userId: application.userId,
                verificationBanned: true,
            });
        } else {
            await userProfileSchema.updateOne(
                { userId: application.userId },
                { $set: { verificationBanned: true } }
            );
        }

        // Update application record
        await verificationSchema.updateOne(
            { _id: application._id },
            {
                $set: {
                    status: 'closed',
                    decision: 'banned',
                    decidedBy: moderatorId,
                    decidedOn: new Date().toISOString(),
                },
            }
        );

        // Update embed
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#FF6961');
        const fields = updatedEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Verification Banned';
        } else {
            updatedEmbed.addFields({ name: 'Status', value: 'Verification Banned' });
        }
        updatedEmbed.addFields({ name: 'Decided By', value: `${moderatorTag} | <@${moderatorId}>` });
        updatedEmbed.setFooter({ text: footerText, iconURL: footerIcon });

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('banned').setLabel('Banned').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });

        // Notify the user via DM (best effort)
        try {
            const applicant = await interaction.client.users.fetch(application.userId);
            const dmEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Verification Access Revoked', iconURL: footerIcon })
                .setDescription(
                    'You have been banned from submitting verification applications. If you believe this is an error, contact the server staff.'
                )
                .setColor('#FF6961')
                .setFooter({ text: footerText, iconURL: footerIcon });
            await applicant.send({ embeds: [dmEmbed] });
        } catch {
            await interaction.followUp({
                embeds: [errorEmbed('Could not notify the user via DM.', interaction.user.displayAvatarURL({ dynamic: true }))],
                ephemeral: true,
            });
        }

        // Log to logging channel
        if (guildProfile.loggingChannelId) {
            await interaction.guild.channels
                .fetch(guildProfile.loggingChannelId)
                .then((channel) =>
                    channel.send({
                        embeds: [
                            EmbedBuilder.from(updatedEmbed).setDescription(
                                `User <@${application.userId}> was banned from verification.`
                            ),
                        ],
                    })
                )
                .catch(() => {});
        }

        await interaction.followUp({
            content: `User <@${application.userId}> has been banned from verification.`,
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error handling verification ban:', error);
        const payload = {
            embeds: [errorEmbed(error.message, interaction.user.displayAvatarURL({ dynamic: true }))],
            ephemeral: true,
        };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
};
