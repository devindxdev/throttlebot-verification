const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const { obtainGuildProfile } = require('../database.js');
const { errorEmbed } = require('../utility.js');

/**
 * Handles the "Read The Guide" denial path, closing the application and nudging the applicant to review requirements.
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

        await verificationSchema.updateOne(
            { _id: application._id },
            {
                $set: {
                    status: 'closed',
                    decision: 'denied-read-guide',
                    decidedBy: moderatorId,
                    decidedOn: new Date().toISOString(),
                },
            }
        );

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#FFB347'); // orange tone
        const fields = updatedEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Denied - Read The Guide';
        } else {
            updatedEmbed.addFields({ name: 'Status', value: 'Denied - Read The Guide' });
        }
        updatedEmbed.addFields({ name: 'Decided By', value: `${moderatorTag} | <@${moderatorId}>` });
        updatedEmbed.setFooter({ text: footerText, iconURL: footerIcon });

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('guideDenied')
                .setLabel('Guide Sent')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });

        // DM applicant with guidance
        try {
            const applicant = await interaction.client.users.fetch(application.userId);
            const dmEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Verification Needs Updates', iconURL: footerIcon })
                .setDescription(
                    `Your verification application for **${application.vehicle}** was closed. Please review the requirements in <#${guildProfile.guideChannelId}> and re-submit once ready.`
                )
                .setColor('#FFB347')
                .setFooter({ text: footerText, iconURL: footerIcon });
            await applicant.send({ embeds: [dmEmbed] });
        } catch {
            await interaction.followUp({
                embeds: [errorEmbed('Could not notify the user via DM.', interaction.user.displayAvatarURL({ dynamic: true }))],
                ephemeral: true,
            });
        }

        if (guildProfile.loggingChannelId) {
            await interaction.guild.channels
                .fetch(guildProfile.loggingChannelId)
                .then((channel) =>
                    channel.send({
                        embeds: [
                            EmbedBuilder.from(updatedEmbed).setDescription(
                                `Application closed with "Read The Guide" in <#${guildProfile.verificationChannelId}>.`
                            ),
                        ],
                    })
                )
                .catch(() => {});
        }

        await interaction.followUp({
            content: `Requested **${application.vehicle}** applicant to read the guide.`,
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
