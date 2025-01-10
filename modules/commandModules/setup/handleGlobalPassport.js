const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { greenIndicator } = require('../../constants.js');
const { getServerStats } = require('../../database.js');


module.exports = async (interaction, guildProfile) => {
    try {
        // Defer the interaction to prevent timeout
        await interaction.deferUpdate();

        // Fetch the server details
        const passportGuildId = '438650836512669699';
        const vehicleStats = await getServerStats(passportGuildId);
        //const passportServer = interaction.client.guilds.cache.get(passportServerId);

        // if (!passportServer) {
        //     throw new Error('Unable to fetch the passport server details.');
        // }

        // Stubbed values for demonstration
        const totalVerifiedRides = vehicleStats.totalVerifiedRides; // Replace with actual logic
        const totalVerifiedUsers = vehicleStats.totalVerifiedUsers;  // Replace with actual logic

        // Create the Global Passport explanation embed
        const embed = new EmbedBuilder()
            .setTitle('Global Passport')
            .setDescription(
                `Global Passport allows you to link your server with a larger verified community, providing:\n` +
                `- Access to a shared pool of verified vehicles and users.\n` +
                `- Increased visibility for your server.\n` +
                `Would you like to enable the Global Passport feature for your server?`
            )
            .addFields(
                {
                    name: 'Available Passport Server(s)',
                    value: `\`1. The Car Community\`` +
                        `\n- Verified Rides: **${totalVerifiedRides.toLocaleString()}**\n` +
                        `- Verified Users: **${totalVerifiedUsers.toLocaleString()}**`,
                    inline: false,
                }
            )
            .setColor('#FFFCFF');

        // Create the buttons for accepting or declining
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('passport_accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('passport_decline')
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
        );

        // Reply with the embed and buttons
        await interaction.editReply({ embeds: [embed], components: [row] });

        // Create a collector for button interactions
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: (i) => i.user.id === interaction.user.id,
        });

        collector.on('collect', async (buttonInteraction) => {
            const choice = buttonInteraction.customId;
            collector.stop(); // Stop the collector after a valid interaction
            if (choice === 'passport_accept') {
                // Update the database to enable the Global Passport
                await guildProfileSchema.updateOne(
                    { guildId: guildProfile.guildId },
                    { $set: { passportGuildId: passportGuildId, passportEnabled: true } }
                );

                await buttonInteraction.reply({
                    content: `${greenIndicator} \`|\` Global Passport has been successfully enabled for your server!`,
                    ephemeral: true,
                });

            } else if (choice === 'passport_decline') {
                await buttonInteraction.reply({
                    content: 'You have declined the Global Passport setup. Returning to the main menu.',
                    ephemeral: true,
                });
            }

            // Return to the main menu
            const setupCommand = require('../../../commands/setup.js');
            await setupCommand.execute(interaction);

           
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.followUp({
                    content: 'Timed out, no selection was made.',
                    ephemeral: true,
                });

            }
        });
    } catch (error) {
        console.error('Error in GlobalPassport:', error);
        throw new Error('An error occurred while setting up the Global Passport.');
    }
};
