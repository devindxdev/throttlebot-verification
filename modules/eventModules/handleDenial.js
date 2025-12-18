const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const { obtainGuildProfile } = require('../database.js');
const { errorEmbed } = require('../utility.js');

/**
 * Handles staff-initiated denial of a verification application.
 */
module.exports = async function handleDenial(interaction) {
    try {
        const guildId = interaction.guild.id;
        const moderatorId = interaction.user.id;
        const moderatorTag = interaction.user.tag;

        const guildProfile = await obtainGuildProfile(guildId);
        if (!guildProfile) throw new Error('Server profile not set up.');

        const footerIcon = guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true });
        const footerText = `${interaction.guild.name} • Vehicle Verification`;

        // Fetch the open application tied to this message
        const applicationMessageId = interaction.message.id;
        const application = await verificationSchema.findOne({
            applicationMessageId,
            guildId,
            status: 'open',
        });
        if (!application) throw new Error('No open verification application found for this message.');

        // Persist decision
        await verificationSchema.updateOne(
            { _id: application._id },
            {
                $set: {
                    status: 'closed',
                    decision: 'denied',
                    decidedBy: moderatorId,
                    decidedOn: new Date().toISOString(),
                },
            }
        );

        // Update the message embed
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#FF6961');
        const fields = updatedEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Verification Denied';
        } else {
            updatedEmbed.addFields({ name: 'Status', value: 'Verification Denied' });
        }
        updatedEmbed.addFields({ name: 'Decided By', value: `${moderatorTag} | <@${moderatorId}>` });
        updatedEmbed.setFooter({ text: footerText, iconURL: footerIcon });

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('denied').setLabel('Denied').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });

        // Notify applicant via DM
        try {
            const applicant = await interaction.client.users.fetch(application.userId);
            const dmEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Verification Processed', iconURL: footerIcon })
                .setDescription(
                    `Your verification application for **${application.vehicle}** was denied by the staff.\n` +
                        `Please review the requirements in <#${guildProfile.guideChannelId}> and re-submit when ready.`
                )
                .setColor('#FF6961')
                .setFooter({ text: footerText, iconURL: footerIcon });
            await applicant.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            await interaction.followUp({
                embeds: [errorEmbed('Could not notify the user via DM.', interaction.user.displayAvatarURL({ dynamic: true }))],
                ephemeral: true,
            });
        }

        // Log to the configured logging channel
        if (guildProfile.loggingChannelId) {
            await interaction.guild.channels
                .fetch(guildProfile.loggingChannelId)
                .then((channel) =>
                    channel.send({
                        embeds: [
                            EmbedBuilder.from(updatedEmbed).setDescription(
                                `Application denied in <#${guildProfile.verificationChannelId}>.`
                            ),
                        ],
                    })
                )
                .catch(() => {});
        }

        await interaction.followUp({
            content: `Verification for **${application.vehicle}** denied.`,
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error handling denial:', error);
        await interaction.followUp({
            embeds: [errorEmbed(error.message, interaction.user.displayAvatarURL({ dynamic: true }))],
            ephemeral: true,
        });
    }
};
