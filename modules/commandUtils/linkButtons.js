const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Builds a single ActionRow of link buttons from an array of { label, url }.
 */
function buildLinkRow(links = []) {
    const row = new ActionRowBuilder();
    links.forEach((link) => {
        if (!link?.label || !link?.url) return;
        row.addComponents(new ButtonBuilder().setLabel(link.label).setStyle(ButtonStyle.Link).setURL(link.url));
    });
    return row;
}

module.exports = { buildLinkRow };
