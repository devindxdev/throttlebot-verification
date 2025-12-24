const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const imagesFlow = require('./flows/images.js');
const descriptionFlow = require('./flows/description.js');
const garageIconFlow = require('./flows/garageIcon.js');
const embedColorFlow = require('./flows/embedColor.js');
const sortingFlow = require('./flows/sorting.js');

const MENU_OPTIONS = [
    { label: 'Images', description: 'Down for maintenance (~48 hours).', value: 'images' },
    { label: 'Description', description: 'Set or reset vehicle description.', value: 'description' },
    { label: 'Garage Icon', description: 'Set or reset your garage icon.', value: 'garageIcon' },
    { label: 'Embed Color', description: 'Customize your embed color.', value: 'embedColor' },
    { label: 'Sorting', description: 'Choose how your garage is sorted.', value: 'sorting' },
    { label: 'Exit', description: 'Exit the settings interface.', value: 'exit' },
];

const buildDashboardEmbed = ({ initiator, selectedVehicle, embedColor, footer }) =>
    new EmbedBuilder()
        .setAuthor({ name: 'Garage Settings Dashboard', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
        .setDescription('Configure your garage and verified vehicles. Choose an option below to continue:')
        .addFields(
            {
                name: 'Vehicle',
                value:
                    `[${selectedVehicle.vehicle}](` +
                    `${selectedVehicle.verificationImageLink || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})`,
                inline: true,
            },
            { name: 'Owner', value: initiator.tag, inline: true }
        )
        .setColor(embedColor)
        .setFooter({ text: footer.text, iconURL: footer.icon });

const buildMenuRow = (menuId) =>
    new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(menuId)
            .setPlaceholder('Select an option to configure...')
            .addOptions(MENU_OPTIONS)
    );

async function presentSettingsDashboard(context) {
    const { interaction, initiator, guild, embedColor, footer, garageData, selectedVehicle, logChannel } = context;

    const menuId = `settingsMenu+${interaction.id}`;

    await interaction.editReply({
        embeds: [buildDashboardEmbed({ initiator, selectedVehicle, embedColor, footer })],
        components: [buildMenuRow(menuId)],
    });

    const dashboardMessage = await interaction.fetchReply().catch(() => null);

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) =>
            i.customId === menuId &&
            i.user.id === initiator.id &&
            (!dashboardMessage || i.message.id === dashboardMessage.id),
        time: 120000,
        max: 1,
    });

    collector.on('collect', async (selectInteraction) => {
        const choice = selectInteraction.values[0];
        await selectInteraction.deferUpdate();

        switch (choice) {
            case 'images':
                if (initiator.id !== '378171973429231616') {
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setAuthor({ name: 'Garage Settings - Images', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
                                .setDescription('Image uploads are temporarily down for maintenance (~48 hours).')
                                .setColor(embedColor)
                                .setFooter({ text: footer.text, iconURL: footer.icon }),
                        ],
                        components: [],
                    });
                    break;
                }
                await imagesFlow(selectInteraction, {
                    interaction,
                    initiator,
                    guild,
                    embedColor,
                    footer,
                    garageData,
                    selectedVehicle,
                    logChannel,
                });
                break;
            case 'description':
                await descriptionFlow(selectInteraction, {
                    interaction,
                    initiator,
                    guild,
                    embedColor,
                    footer,
                    garageData,
                    selectedVehicle,
                    logChannel,
                });
                break;
            case 'garageIcon':
                await garageIconFlow(selectInteraction, {
                    interaction,
                    initiator,
                    embedColor,
                    footer,
                    logChannel,
                });
                break;
            case 'embedColor':
                await embedColorFlow(selectInteraction, {
                    interaction,
                    initiator,
                    embedColor,
                    footer,
                });
                break;
            case 'sorting':
                await sortingFlow(selectInteraction, {
                    interaction,
                    initiator,
                    embedColor,
                    footer,
                });
                break;
            case 'exit':
            default:
                await interaction.deleteReply().catch(() => {});
                break;
        }
    });

    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            await interaction.deleteReply().catch(() => {});
        }
    });
}

module.exports = { presentSettingsDashboard };
