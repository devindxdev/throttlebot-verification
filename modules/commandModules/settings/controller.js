const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const { obtainGuildProfile, obtainAllUserVehicles, defaultEmbedColor } = require('../../database.js');
const { vehicleSelection } = require('../garage/vehicleSelection.js');
const { errorEmbed } = require('../../utility.js');
const imagesFlow = require('./flows/images.js');
const descriptionFlow = require('./flows/description.js');
const garageIconFlow = require('./flows/garageIcon.js');
const embedColorFlow = require('./flows/embedColor.js');

/**
 * Entry point for the /settings command. Performs guild/user prechecks, vehicle selection,
 * and dispatches to the appropriate settings subflow.
 */
async function settingsController(interaction) {
    if (!interaction.deferred) await interaction.deferReply({ ephemeral: true });

    const initiator = interaction.user;
    const guild = interaction.guild;
    const guildId = guild.id;
    const guildName = guild.name;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });

    const guildProfile = await obtainGuildProfile(guildId);
    if (!guildProfile) {
        await interaction.editReply({
            embeds: [errorEmbed('Server profile not setup, please kick the bot and invite it again.', initiatorAvatar)],
        });
        return;
    }

    const { verificationChannelId, guideChannelId, loggingChannelId, customFooterIcon } = guildProfile;
    if (!verificationChannelId || !guideChannelId || !loggingChannelId) {
        await interaction.editReply({
            embeds: [errorEmbed('This server has not been setup properly, please ask the moderation team to use the `/setup` command.', initiatorAvatar)],
        });
        return;
    }

    const logChannel = await interaction.member.guild.channels.fetch(loggingChannelId).catch(() => null);
    if (!logChannel) {
        await interaction.editReply({
            embeds: [errorEmbed('Failed to obtain the log channel where the logs are sent. Please ask staff to set it up.', initiatorAvatar)],
        });
        return;
    }

    const garageData = await obtainAllUserVehicles(initiator.id, guildId);
    if (!garageData || garageData.length === 0) {
        await interaction.editReply({
            embeds: [errorEmbed(`**${initiator.username},**\nYou do not have any verified rides! Please have them verified first by using the \`/verify\` command first.`, initiatorAvatar)],
        });
        return;
    }

    const embedColor = await defaultEmbedColor(initiator.id);
    const footerIcon = customFooterIcon || guild.iconURL({ dynamic: true });
    const footerText = `${guildName} • Vehicle Verification`;

    const selectedVehicle = await vehicleSelection(
        garageData,
        initiator,
        footerText,
        footerIcon,
        embedColor,
        interaction
    );
    if (!selectedVehicle) return;

    await showDashboard({
        interaction,
        initiator,
        guild,
        embedColor,
        footer: { text: footerText, icon: footerIcon },
        garageData,
        selectedVehicle,
        logChannel,
    });
}

async function showDashboard(context) {
    const {
        interaction,
        initiator,
        guild,
        embedColor,
        footer,
        garageData,
        selectedVehicle,
        logChannel,
    } = context;

    const menuId = `settingsMenu+${interaction.id}`;
    const dashboardEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Garage Settings Dashboard', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
        .setDescription('Configure your garage and verified vehicles. Choose an option below to continue:')
        .addFields(
            { name: 'Vehicle', value: `[${selectedVehicle.vehicle}](${selectedVehicle.verificationImageLink || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})`, inline: true },
            { name: 'Owner', value: initiator.tag, inline: true }
        )
        .setColor(embedColor)
        .setFooter({ text: footer.text, iconURL: footer.icon });

    const menu = new StringSelectMenuBuilder()
        .setCustomId(menuId)
        .setPlaceholder('Select an option to configure...')
        .addOptions([
            { label: 'Images', description: 'View or remove vehicle images.', value: 'images' },
            { label: 'Description', description: 'Set or reset vehicle description.', value: 'description' },
            { label: 'Garage Icon', description: 'Set or reset your garage icon.', value: 'garageIcon' },
            { label: 'Embed Color', description: 'Customize your embed color.', value: 'embedColor' },
            { label: 'Exit', description: 'Exit the settings interface.', value: 'exit' },
        ]);

    await interaction.editReply({
        embeds: [dashboardEmbed],
        components: [new ActionRowBuilder().addComponents(menu)],
    });

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.customId === menuId && i.user.id === initiator.id,
        time: 120000,
        max: 1,
    });

    collector.on('collect', async (selectInteraction) => {
        const choice = selectInteraction.values[0];
        await selectInteraction.deferUpdate();
        switch (choice) {
            case 'images':
                await imagesFlow(selectInteraction, { interaction, initiator, guild, embedColor, footer, garageData, selectedVehicle, logChannel });
                break;
            case 'description':
                await descriptionFlow(selectInteraction, { interaction, initiator, guild, embedColor, footer, garageData, selectedVehicle, logChannel });
                break;
            case 'garageIcon':
                await garageIconFlow(selectInteraction, { interaction, initiator, guild, embedColor, footer, logChannel });
                break;
            case 'embedColor':
                await embedColorFlow(selectInteraction, { interaction, initiator, embedColor, footer });
                break;
            case 'exit':
                await interaction.deleteReply().catch(() => {});
                break;
            default:
                break;
        }
    });

    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            await interaction.deleteReply().catch(() => {});
        }
    });
}

module.exports = settingsController;
