const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
} = require('discord.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');
const { resolveBrandFields } = require('../../vehicleUtils.js');
const { errorEmbed } = require('../../utility.js');
const { searchServer } = require('./searchServer.js');

async function fetchBrands(scopeQuery) {
    const vehicles = await garageSchema.find(scopeQuery).select('vehicle vehicleBrand vehicleModel').lean();
    const counts = new Map();

    for (const v of vehicles) {
        const meta = resolveBrandFields({
            vehicleName: v.vehicle,
            vehicleBrand: v.vehicleBrand,
            vehicleModel: v.vehicleModel,
        });
        if (!meta.brandKey) continue;
        const bucket = counts.get(meta.brandKey) || {
            label: meta.brand || 'Unknown',
            count: 0,
            samples: [],
        };
        if (!bucket.label && meta.brand) bucket.label = meta.brand;
        bucket.count += 1;
        if (bucket.samples.length < 3 && typeof v.vehicle === 'string') {
            const cleaned = v.vehicle.trim();
            if (cleaned && !bucket.samples.includes(cleaned)) {
                bucket.samples.push(cleaned);
            }
        }
        counts.set(meta.brandKey, bucket);
    }

    return Array.from(counts.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildPage(brands, page, perPage) {
    const start = page * perPage;
    const slice = brands.slice(start, start + perPage);
    const options = slice.map((b) =>
        new StringSelectMenuOptionBuilder()
            .setLabel(`${b.label} (${b.count})`)
            .setValue(b.label)
    );
    return { options, hasNext: start + perPage < brands.length, hasPrev: page > 0 };
}

async function browseBrandsFlow({ interaction, initiatorData, guildData, footerData, embedColor, mainInteractionId }) {
    const initiatorAvatar = initiatorData.displayAvatarURL({ dynamic: true });
    const guildId = guildData.id;

    let scope = 'server';
    let brands = await fetchBrands({ guildId });
    const globalBrands = await fetchBrands({});
    if (brands.length === 0 && globalBrands.length > 0) {
        scope = 'global';
        brands = globalBrands;
    }
    if (brands.length === 0) {
        await interaction.editReply({
            embeds: [errorEmbed('No brands found yet.', initiatorAvatar)],
            components: [],
        });
        return;
    }

    const perPage = 10;
    let page = 0;

    const render = async () => {
        const { options, hasNext, hasPrev } = buildPage(brands, page, perPage);
        const select = new StringSelectMenuBuilder()
            .setCustomId(`searchBrandsSelect+${mainInteractionId}`)
            .setPlaceholder('Select a brand to view vehicles')
            .addOptions(options);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`searchBrandsPrev+${mainInteractionId}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasPrev),
            new ButtonBuilder()
                .setCustomId(`searchBrandsNext+${mainInteractionId}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!hasNext),
            new ButtonBuilder()
                .setCustomId(`searchBrandsToggle+${mainInteractionId}`)
                .setLabel(scope === 'server' ? 'View Global' : 'View Server')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(scope === 'server' ? globalBrands.length === 0 : false),
            new ButtonBuilder()
                .setCustomId(`searchBrandsExit+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Danger)
        );

        const start = page * perPage;
        const slice = brands.slice(start, start + perPage);
        const lines = slice.map((b, idx) => {
            const number = start + idx + 1;
            return `\`${number}.\` **${b.label}** — ${b.count} vehicle${b.count === 1 ? '' : 's'}`;
        });
        const pageCount = Math.max(1, Math.ceil(brands.length / perPage));

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Browse Brands (${scope === 'server' ? 'This Server' : 'Global'})`, iconURL: initiatorAvatar })
            .setDescription(
                `${lines.join('\n')}\n\nSelect a brand to view its vehicles.`
            )
            .setColor(embedColor)
            .setFooter({ text: `${footerData.text} • Page ${page + 1}/${pageCount}`, iconURL: footerData.icon });

        await interaction.editReply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(select), buttons],
        });
    };

    await render();

    const message = await interaction.fetchReply().catch(() => null);
    const filter = (i) =>
        i.user.id === initiatorData.id &&
        (!message || i.message?.id === message.id);

    const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 20 * 60 * 1000,
    });

    collector.on('collect', async (i) => {
        if (i.customId === `searchBrandsExit+${mainInteractionId}`) {
            await i.deferUpdate();
            collector.stop('exit');
            return;
        }
        if (i.customId === `searchBrandsPrev+${mainInteractionId}`) {
            page = Math.max(0, page - 1);
            await i.deferUpdate();
            await render();
            return;
        }
        if (i.customId === `searchBrandsNext+${mainInteractionId}`) {
            page += 1;
            await i.deferUpdate();
            await render();
            return;
        }
        if (i.customId === `searchBrandsToggle+${mainInteractionId}`) {
            await i.deferUpdate();
            if (scope === 'server') {
                scope = 'global';
                brands = globalBrands;
            } else {
                scope = 'server';
                brands = await fetchBrands({ guildId });
            }
            page = 0;
            await render();
            return;
        }
        if (i.customId === `searchBrandsSelect+${mainInteractionId}`) {
            const brandLabel = i.values?.[0];
            await i.deferUpdate();
            // Reuse searchServer with brandTerm
            await searchServer(
                interaction,
                initiatorData,
                guildData,
                footerData,
                embedColor,
                '',
                brandLabel
            );
            collector.stop('done');
        }
    });

    collector.on('end', async () => {
        // Leave final state as-is; no cleanup needed
    });
}

module.exports = { browseBrandsFlow };
