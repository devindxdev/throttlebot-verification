const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../mongodb_schema/garageSchema.js');
const { obtainGuildProfile } = require('../database.js');
const { errorEmbed } = require('../utility.js');

module.exports = async function handleOverrideDeny(interaction) {
    try {
        const modalId = `overrideDenyReason+${interaction.id}`;
        const reasonInputId = 'overrideDenyReasonInput';
        await interaction.showModal(
            new (require('discord.js').ModalBuilder)()
                .setCustomId(modalId)
                .setTitle('Override Denial Reason')
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
        const initiatorId = interaction.user.id;
        const initiatorTag = interaction.user.tag;
        const applicationMessageId = interaction.message.id;

        const application = await verificationSchema.findOne({ applicationMessageId, guildId });
        if (!application) throw new Error('No application found for this message.');

        const guildProfile = await obtainGuildProfile(guildId);
        if (!guildProfile) throw new Error('Server profile not set up.');

        // Delete garage entry created by auto-approval
        await garageSchema.deleteOne({ guildId, userId: application.userId, vehicle: application.vehicle });

        // Remove verified role if present
        if (guildProfile.verifiedVehicleRoleId) {
            await interaction.guild.members.fetch(application.userId)
                .then((member) => member.roles.remove(guildProfile.verifiedVehicleRoleId).catch(() => {}))
                .catch(() => {});
        }

        // Update application
        await verificationSchema.updateOne(
            { applicationMessageId },
            {
                $set: {
                    status: 'closed',
                    decision: 'overridden-denied',
                    decidedBy: initiatorId,
                    decidedOn: new Date().toISOString(),
                },
            }
        );

        // Update message embed
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#FF6961');
        const fields = updatedEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Overridden - Denied';
        } else {
            updatedEmbed.addFields({ name: 'Status', value: 'Overridden - Denied' });
        }
        updatedEmbed.addFields(
            { name: 'Overridden By', value: `${initiatorTag} | <@${initiatorId}>` },
            { name: 'Override Reason', value: overrideReason || 'None provided' }
        );

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('disabled').setLabel('Overridden').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });

        // Notify staff via logging channel if available
        if (guildProfile.loggingChannelId) {
            await interaction.guild.channels
                .fetch(guildProfile.loggingChannelId)
                .then((channel) => channel.send({ embeds: [updatedEmbed] }))
                .catch(() => {});
        }

        // Notify user via DM
        try {
            const applicant = await interaction.client.users.fetch(application.userId);
            const dmEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Verification Processed', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                .setDescription(`Your verification for **${application.vehicle}** was overridden and denied.`)
                .addFields({ name: 'Reason', value: overrideReason || 'None provided' })
                .setColor('#FF6961');
            if (application.vehicleImageURL) dmEmbed.setThumbnail(application.vehicleImageURL);
            await applicant.send({ embeds: [dmEmbed] });
        } catch {
            await interaction.followUp({
                embeds: [errorEmbed('Could not notify the user via DM.', interaction.user.displayAvatarURL({ dynamic: true }))],
                ephemeral: true,
            });
        }

        await interaction.followUp({ content: `Application overridden and denied.\nReason: ${overrideReason || 'None provided'}`, ephemeral: true });
    } catch (err) {
        console.error('Error handling override deny:', err);
        const payload = { embeds: [errorEmbed(err.message, interaction.user.displayAvatarURL({ dynamic: true }))], ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
};
