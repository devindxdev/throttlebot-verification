const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const { redColor, botId } = require('../constants.js');

/** Check one known applicant via REST; never use a stale cached member. */
async function fetchApplicantMember(guild, userId) {
    try {
        return await guild.members.fetch({ user: userId, force: true });
    } catch (error) {
        // Only a confirmed departure should close a request. Permission/network
        // failures must reach the handler so the moderator can retry safely.
        if (error.code === 10007) return null;
        throw error;
    }
}

async function closeDepartedApplication(interaction, application) {
    await verificationSchema.updateOne(
        { _id: application._id, guildId: interaction.guild.id, status: application.status },
        { $set: {
            status: 'closed',
            decision: 'denied | User Left',
            decidedBy: botId,
            decidedOn: Date.now(),
        } }
    );

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const statusField = (embed.data.fields || []).find(field => field.name.toLowerCase().includes('status'));
    const status = 'Verification Denied | Reason: User left the server.';
    if (statusField) statusField.value = status;
    else embed.addFields({ name: 'Status', value: status });
    embed.setColor(redColor).addFields({ name: 'Decided By', value: 'Automatic' });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('disabled').setLabel('Denied - User Left')
            .setStyle(ButtonStyle.Danger).setDisabled(true)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
    await interaction.followUp({
        content: 'The applicant is no longer in this server. Their application has been closed without approval.',
        ephemeral: true,
    });
}

module.exports = { fetchApplicantMember, closeDepartedApplication };
