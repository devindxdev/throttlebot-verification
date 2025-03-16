const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { obtainGuildProfile, obtainAllOpenUserApplications } = require('../modules/database.js');
const verificationSchema = require('../mongodb_schema/verificationApplicationSchema.js');
const { redColor, botId } = require('../modules/constants.js');
const moment = require('moment');

module.exports = {
    name: 'guildMemberRemove',
    once: false,
    /**
     * Executes whenever a member leaves a server.
     * @param {import('discord.js').GuildMember} member - The member object
     */
    async execute(member) {
        if (member.user.bot) return; // Ignore bots

        try {
            const userId = member.user.id;
            const guildId = member.guild.id;

            // Fetch open applications and guild profile
            const openApplications = await obtainAllOpenUserApplications(userId, guildId);
            if (!openApplications?.length) return;

            const guildProfile = await obtainGuildProfile(guildId);
            if (!guildProfile) return;

            const { verificationChannelId } = guildProfile;

            // Fetch the verification channel
            const verificationChannel = await member.guild.channels.fetch(verificationChannelId);
            if (!verificationChannel) return;

            const todaysDate = moment.utc();

            // Iterate through open applications and update them
            for (const application of openApplications) {
                const vehicleName = application.vehicle;
                const applicationMessageId = application.applicationMessageId;

                // Fetch the application message
                const applicationMessage = await verificationChannel.messages.fetch(applicationMessageId).catch(() => null);
                if (!applicationMessage) continue;

                // Update the application status in the database
                await verificationSchema.updateOne(
                    { userId, vehicle: vehicleName, status: 'open' },
                    {
                        $set: {
                            status: 'closed',
                            decision: 'denied | User Left',
                            decidedBy: botId,
                            decidedOn: todaysDate,
                        },
                    }
                );

                // Update the embed in the application message
                const applicationEmbed = applicationMessage.embeds[0]?.toJSON();
                if (!applicationEmbed) continue;

                applicationEmbed.fields = applicationEmbed.fields.map(field =>
                    field.name === 'Status'
                        ? { ...field, value: `Verification Denied | Reason: User left the server.` }
                        : field
                );
                applicationEmbed.color = parseInt(redColor.replace('#', ''), 16); // Convert hex to integer
                applicationEmbed.fields.push({
                    name: 'Decided By',
                    value: 'Automatic',
                });

                // Create a "Denied" button
                const deniedButton = new ButtonBuilder()
                    .setCustomId('disabled')
                    .setLabel('Denied - User Left')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true);

                const row = new ActionRowBuilder().addComponents(deniedButton);

                // Edit the application message
                await applicationMessage.edit({
                    embeds: [applicationEmbed],
                    components: [row],
                });
            }
        } catch (error) {
            console.error(`Error in guildMemberRemove event: ${error.message}`);
        }
    },
};
