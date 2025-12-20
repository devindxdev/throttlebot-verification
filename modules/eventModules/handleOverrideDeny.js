const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../mongodb_schema/garageSchema.js');
const { obtainGuildProfile } = require('../database.js');
const { errorEmbed } = require('../utility.js');

module.exports = async function handleOverrideDeny(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
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
        updatedEmbed.addFields({ name: 'Overridden By', value: `${initiatorTag} | <@${initiatorId}>` });

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

        await interaction.followUp({ content: 'Application overridden and denied.', ephemeral: true });
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
