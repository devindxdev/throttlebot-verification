const {
    EmbedBuilder,
    ActionRowBuilder,
    RoleSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const guildProfileSchema = require('../../../mongodb_schema/guildProfileSchema.js');
const { greenIndicator } = require('../../constants.js');
const { errorEmbed } = require('../../utility.js');

module.exports = async (interaction, guildProfile) => {
    await interaction.deferUpdate();

    // Create the embed prompting the user to select a verified role
    const embed = new EmbedBuilder()
        .setTitle('Set Verified Role')
        .setDescription(
            'Select a role that will be assigned to users who verify their vehicles successfully.\n\n' +
            '**Important Notes:**\n' +
            '1. Ensure the bot has permissions to manage roles.\n' +
            '2. The selected role must be lower in the role hierarchy than the bot’s role.'
        )
        .setColor('#FFFCFF');

    // Create the Role Select Menu
    const row = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
            .setCustomId('verified_role_select')
            .setPlaceholder('Select a role...')
    );

    // Send the embed and role select menu
    await interaction.editReply({ embeds: [embed], components: [row] });

    // Create a collector for the Role Select interaction
    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        time: 60000,
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'verified_role_select',
        max: 1,
    });

    collector.on('collect', async (menuInteraction) => {
        try {
            const selectedRoleId = menuInteraction.values[0];
            collector.stop();
            const role = interaction.guild.roles.cache.get(selectedRoleId);

            // Validate the role
            if (!role) {
                throw new Error('Invalid role selected. Please try again.');
            }

            // Check if the bot can manage the role
            if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
                throw new Error('The bot lacks the "Manage Roles" permission.');
            }

            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                throw new Error(
                    `The selected role (${role.name}) is higher or equal in the role hierarchy than the bot's role. Please select a lower role or move the bot's role higher than the role you wish to assign.`
                );
            }

            // Update the database with the selected role
            await guildProfileSchema.updateOne(
                { guildId: guildProfile.guildId },
                { $set: { verifiedVehicleRoleId: role.id } }
            );

            await menuInteraction.reply({
                content: `${greenIndicator} | The verified role has been successfully set to <@&${role.id}>.`,
                ephemeral: true,
            });

            // Redirect back to the main setup menu
            const setupCommand = require('../../../commands/setup.js');
            await setupCommand.execute(interaction);

        } catch (err) {
            
            // Respond with the error embed
            const errorMessageEmbed = errorEmbed(
                err.message,
                interaction.user.displayAvatarURL({ dynamic: true }),
                null, // No example
                interaction.client.user.displayAvatarURL({ dynamic: true }),
                null,
                true // Include support button
            );

            await menuInteraction.reply({
                embeds: [errorMessageEmbed],
                components: errorMessageEmbed.components,
                ephemeral: true,
            });
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            // Notify the user of timeout and clean up
            await interaction.followUp({
                content: 'No role selected. The setup process timed out.',
                ephemeral: true,
            });
        }
    });
};
