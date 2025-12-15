const { EmbedBuilder, ButtonStyle, ButtonBuilder, ActionRowBuilder } = require('discord.js')
const {
    supportServerInvite
} = require('../modules/constants.js');


// Removes all non-integer characters from a string
function removeNonIntegers(string) {
    return string.replace(/\D/g, '');
}

// Capitalizes the first letter of a string
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function errorEmbed(
    errMsg, 
    useravatar = null, 
    example = null,
    footerIcon = null,
    footerText = null,
    includeSupportButton = false,
){
    const embedColor = '#ff6961';
    // Create the embed
    const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setAuthor({
        name: 'There was an error',
        iconURL: useravatar,
    })
    .setDescription(errMsg);

    if (example) {
        embed.addFields({ name: 'Example', value: example });
    }

    if (footerText && footerIcon) {
        embed.setFooter({ text: footerText, iconURL: footerIcon });
    }

    // Create optional Support Server button
    const components = [];
    if (includeSupportButton) {
        const supportButton = new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL(supportServerInvite);

        components.push(new ActionRowBuilder().addComponents(supportButton));
    }
    
    embed.components = components;
    return embed;
}

// Creates a tips embed
function tipsEmbed(tipMsg, embedColor = '#FFFCFF') {
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({
            name: 'Throttle Tips',
            iconURL: 'https://www.pngmart.com/files/6/Light-Bulb-PNG-File.png',
        })
        .setDescription(tipMsg);
    return embed;
}


function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
}

// Creates a Patreon advertisement embed
function patreonAdvertEmbed(avatar, title, description, footerIcon, footerText) {
    const embed = new EmbedBuilder()
        .setAuthor({
            name: title,
            iconURL: avatar,
        })
        .setDescription(
            `${description}\n\n"Your support contributes to the bot's development and helps maintain its free availability for everyone!".`
        )
        .setImage(patreonBanner)
        .setColor(patreonRedColor)
        .setFooter({
            text: footerText,
            iconURL: footerIcon,
        });

    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Patreon')
            .setStyle(ButtonStyle.Link)
            .setURL(patreonLink)
    );

    return { embed, buttonsRow };

}

module.exports = { 
    removeNonIntegers,
    errorEmbed,
    isValidHttpUrl,
    patreonAdvertEmbed,
    tipsEmbed,
    capitalizeFirstLetter
};
