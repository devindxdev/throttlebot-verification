const Verification = require('../../mongodb_schema/verificationApplicationSchema');
const { normalizeDate } = require('../commandModules/stats/statsMetrics');
const MAX_PENDING_MS = 30 * 24 * 60 * 60 * 1000;

function isExpired(application, now = new Date()) {
    const submitted = normalizeDate(application.submittedOn) || normalizeDate(application.createdAt);
    return application.status === 'open' && submitted && now - submitted > MAX_PENDING_MS;
}

// $convert tolerates legacy dates, millisecond numbers/strings and malformed values.
function dateExpression(field) {
    return { $convert: {
        input: { $cond: [
            { $regexMatch: { input: { $convert: { input: field, to: 'string', onError: '', onNull: '' } }, regex: /^\d+$/ } },
            { $convert: { input: field, to: 'long', onError: null, onNull: null } },
            field,
        ] },
        to: 'date', onError: null, onNull: null,
    } };
}

function expiredFilter(now = new Date()) {
    const submitted = { $ifNull: [dateExpression('$submittedOn'), dateExpression('$createdAt')] };
    return { status: 'open', $expr: { $and: [
        { $ne: [submitted, null] },
        { $lt: [submitted, new Date(now - MAX_PENDING_MS)] },
    ] } };
}

async function closeExpiredApplications(now = new Date()) {
    return Verification.updateMany(expiredFilter(now), { $set: {
        status: 'closed', decision: 'expired', decidedBy: 'system-expiry', decidedOn: now,
        closureReason: 'Application automatically closed after 30 days without a decision.',
    } });
}

async function updateExpiredMessages(client) {
    if (!client?.guilds?.fetch) return;
    const Guild = require('../../mongodb_schema/guildProfileSchema');
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const applications = await Verification.find({
        status: 'closed', decision: 'expired', expiryMessageUpdated: { $ne: true },
        applicationMessageId: { $ne: null },
    }).limit(100).lean();
    for (const application of applications) {
        try {
            const profile = await Guild.findOne({ guildId: application.guildId }).lean();
            if (!profile?.verificationChannelId) continue;
            const guild = await client.guilds.fetch(application.guildId);
            const channel = await guild.channels.fetch(profile.verificationChannelId);
            const message = await channel.messages.fetch(application.applicationMessageId);
            const embed = message.embeds[0] ? EmbedBuilder.from(message.embeds[0]) : new EmbedBuilder();
            const fields = embed.data.fields || [];
            const status = fields.find(field => field.name.toLowerCase().includes('status'));
            if (status) status.value = 'Expired — no decision within 30 days';
            else embed.addFields({ name: 'Status', value: 'Expired — no decision within 30 days' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId('expiredApplication').setLabel('Expired').setStyle(ButtonStyle.Secondary).setDisabled(true));
            await message.edit({ embeds: [embed], components: [row] });
            await Verification.updateOne({ _id: application._id, decision: 'expired' }, { $set: { expiryMessageUpdated: true } });
        } catch (error) {
            // Deleted messages/channels or departed guilds cannot be updated later.
            if ([10003, 10004, 10008].includes(error.code)) {
                await Verification.updateOne({ _id: application._id, decision: 'expired' }, { $set: { expiryMessageUpdated: true } });
            } else console.warn('Expired review message update will retry:', error.name);
        }
    }
}

function startExpiryMaintenance(client) {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            const result = await closeExpiredApplications();
            await updateExpiredMessages(client);
            if (result.modifiedCount) console.log(`Closed ${result.modifiedCount} expired verification applications.`);
        } catch (error) {
            console.error('Verification expiry maintenance failed:', error.name);
        } finally { running = false; }
    };
    void run();
    const timer = setInterval(run, 60 * 60 * 1000);
    timer.unref();
    return timer;
}

module.exports = { MAX_PENDING_MS, isExpired, dateExpression, expiredFilter, closeExpiredApplications, updateExpiredMessages, startExpiryMaintenance };
