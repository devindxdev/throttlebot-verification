const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { commitDecision } = require('../verification/decisions');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const { obtainGuildProfile } = require('../database.js');
const { buildGuideRejectionMessage } = require('../verification/guideRejection');
const { errorEmbed } = require('../utility.js');

/**
 * Rejects an application and DMs a complete copy of the verification guide.
 */
module.exports = async function handleGuideDenial(interaction) {
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

        await commitDecision(application, {
            status: 'closed', decision: 'denied-read-guide', decidedBy: moderatorId, decidedOn: new Date(),
            denialReason: 'Submission did not meet the verification requirements. Please read the guide and resubmit.',
        });

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#FF6961');
        const fields = updatedEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Rejected - Read The Guide';
        } else {
            updatedEmbed.addFields({ name: 'Status', value: 'Rejected - Read The Guide' });
        }
        updatedEmbed.addFields({ name: 'Decided By', value: `${moderatorTag} | <@${moderatorId}>` });
        updatedEmbed.setFooter({ text: footerText, iconURL: footerIcon });

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('guideDenied')
                .setLabel('Rejected - Read Guide')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        let cardUpdated = true;
        try {
            await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });
        } catch (error) {
            cardUpdated = false;
            console.warn('Application rejected, but the review message could not be updated:', error.name);
        }

        let guideDelivered = false;
        try {
            const applicant = await interaction.client.users.fetch(application.userId);
            await applicant.send(buildGuideRejectionMessage({
                application, guildProfile, guildName: interaction.guild.name, footerIcon,
            }));
            guideDelivered = true;
        } catch (error) {
            console.warn('Application rejected, but the guide DM could not be delivered:', error.name);
        }

        if (guildProfile.loggingChannelId) {
            await interaction.guild.channels
                .fetch(guildProfile.loggingChannelId)
                .then((channel) =>
                    channel.send({
                        embeds: [
                            EmbedBuilder.from(updatedEmbed).setDescription(
                                `Application rejected with "Read The Guide" in <#${guildProfile.verificationChannelId}>.`
                            ),
                        ],
                    })
                )
                .catch(() => {});
        }

        await interaction.followUp({
            content: `Verification for **${application.vehicle}** rejected. ` +
                (guideDelivered ? 'A copy of the guide was sent to the applicant by DM.' :
                    `The guide could not be delivered by DM. Ask the applicant to enable DMs or read <#${guildProfile.guideChannelId}>.`) +
                (cardUpdated ? '' : ' The review message could not be updated.'),
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error handling guide denial:', error);
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
