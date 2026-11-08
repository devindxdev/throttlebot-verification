const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const { obtainGuildProfile } = require('../database.js');
const { errorEmbed } = require('../utility.js');
const { greenColor } = require('../constants.js');
const { resolveBrandFields } = require('../vehicleUtils.js');
const { commitDecision } = require('../verification/decisions');
const { fetchApplicantMember, closeDepartedApplication } = require('./checkApplicantMembership.js');

/**
 * Overrides an auto-denied application and approves it.
 */
module.exports = async function handleOverrideApprove(interaction) {
    try {
        const modalId = `overrideApproveReason+${interaction.id}`;
        const reasonInputId = 'overrideApproveReasonInput';
        await interaction.showModal(
            new (require('discord.js').ModalBuilder)()
                .setCustomId(modalId)
                .setTitle('Override Approval Reason')
                .addComponents(
                    new (require('discord.js').ActionRowBuilder)().addComponents(
                        new (require('discord.js').TextInputBuilder)()
                            .setCustomId(reasonInputId)
                            .setLabel('Reason for override')
                            .setStyle(require('discord.js').TextInputStyle.Paragraph)
                            .setMinLength(5)
                            .setMaxLength(500)
                            .setRequired(true)
                    )
                )
        );

        let modalSubmit;
        try {
            modalSubmit = await interaction.awaitModalSubmit({
                filter: (m) => m.customId === modalId && m.user.id === interaction.user.id,
                time: 60000,
            });
            await modalSubmit.deferUpdate();
        } catch (err) {
            await interaction.followUp({
                embeds: [errorEmbed('No reason provided. Override cancelled.', interaction.user.displayAvatarURL({ dynamic: true }))],
                ephemeral: true,
            }).catch(() => {});
            return;
        }

        const overrideReason = modalSubmit.fields.getTextInputValue(reasonInputId).trim();
        const guildId = interaction.guild.id;
        const moderatorId = interaction.user.id;
        const moderatorTag = interaction.user.tag;

        const guildProfile = await obtainGuildProfile(guildId);
        if (!guildProfile) throw new Error('Server profile not set up.');

        const footerIcon = guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true });
        const footerText = `${interaction.guild.name} • Vehicle Verification`;

        // Find the auto-denied application tied to this message
        const applicationMessageId = interaction.message.id;
        const application = await verificationSchema.findOne({
            applicationMessageId,
            guildId,
            status: 'auto-denied',
        });
        if (!application) throw new Error('No auto-denied application found for this message.');

        const { userId, vehicle, vehicleImageURL, vehicleImageProxyURL } = application;
        const applicantMember = await fetchApplicantMember(interaction.guild, userId);
        if (!applicantMember) {
            await closeDepartedApplication(modalSubmit, application);
            return;
        }
        const brandMeta = resolveBrandFields({
            vehicleName: vehicle,
            vehicleBrand: application.vehicleBrand,
            vehicleModel: application.vehicleModel,
        });

        await commitDecision(application, {
            status: 'closed', decision: 'overridden-approved', decidedBy: moderatorId, decidedOn: new Date(),
            vehicleBrand: application.vehicleBrand || brandMeta.brand,
            vehicleModel: application.vehicleModel || brandMeta.model,
            overrideReason,
        }, 'approve');

        // Update message embed
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(greenColor);
        const fields = updatedEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Overridden - Approved';
        } else {
            updatedEmbed.addFields({ name: 'Status', value: 'Overridden - Approved' });
        }
        updatedEmbed.addFields(
            { name: 'Decided By', value: `${moderatorTag} | <@${moderatorId}>` },
            { name: 'Override Reason', value: overrideReason || 'None provided' }
        );
        updatedEmbed.setFooter({ text: footerText, iconURL: footerIcon });

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('overrideApproved').setLabel('Overridden').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });

        // Assign verified role if configured
        if (guildProfile.verifiedVehicleRoleId) {
            await applicantMember.roles.add(guildProfile.verifiedVehicleRoleId).catch(() => {});
        }

        // Log to logging channel
        if (guildProfile.loggingChannelId) {
            await interaction.guild.channels
                .fetch(guildProfile.loggingChannelId)
                .then((channel) =>
                    channel.send({
                        embeds: [
                            EmbedBuilder.from(updatedEmbed).setDescription(
                                `Auto-denial overridden and approved in <#${guildProfile.verificationChannelId}>.`
                            ),
                        ],
                    })
                )
                .catch(() => {});
        }

        // Notify user via DM
        try {
            const applicant = await interaction.client.users.fetch(userId);
            const dmEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Verification Processed', iconURL: footerIcon })
                .setDescription(`Your verification for **${vehicle}** was approved by staff after review.`)
                .addFields({
                    name: 'Next Steps',
                    value:
                        '• View your verified vehicles with `/garage`.\n' +
                        '• Customize images and descriptions with `/settings`.\n' +
                        '• Verify another vehicle anytime with `/verify`.',
                },
                { name: 'Override Reason', value: overrideReason || 'None provided' })
                .setColor(greenColor)
                .setFooter({ text: footerText, iconURL: footerIcon });
            if (vehicleImageURL) dmEmbed.setThumbnail(vehicleImageURL);
            await applicant.send({ embeds: [dmEmbed] });
        } catch {
            await interaction.followUp({
                embeds: [errorEmbed('Could not notify the user via DM.', interaction.user.displayAvatarURL({ dynamic: true }))],
                ephemeral: true,
            });
        }

        await interaction.followUp({
            content: `Override approved for **${vehicle}**.\nReason: ${overrideReason || 'None provided'}`,
            ephemeral: true,
        });
    } catch (err) {
        console.error('Error handling override approve:', err);
        const payload = {
            embeds: [errorEmbed(err.message, interaction.user.displayAvatarURL({ dynamic: true }))],
            ephemeral: true,
        };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
};
