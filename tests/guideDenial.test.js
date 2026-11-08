const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder } = require('discord.js');
const Verification = require('../mongodb_schema/verificationApplicationSchema');
const database = require('../modules/database');
const decisions = require('../modules/verification/decisions');
const { buildGuideRejectionMessage } = require('../modules/verification/guideRejection');

const logo = 'https://example.com/tcc-logo.png';
const application = { _id: 'application', guildId: '438650836512669699', userId: 'applicant',
    applicationMessageId: 'review-message', vehicle: 'Honda Civic', status: 'open' };
const profile = { guildId: application.guildId, videoVerificationRequired: true,
    guideChannelId: '630811744213925916', verificationChannelId: 'review', customFooterIcon: logo };
afterEach(() => mock.restoreAll());

test('rejection DM includes the video guide and uses the server logo only in the footer', () => {
    const payload = buildGuideRejectionMessage({ application, guildProfile: profile, guildName: 'The Car Community', footerIcon: logo });
    assert.equal(payload.embeds.length, 1);
    const embed = payload.embeds[0].toJSON();
    assert.equal(embed.title, 'Verification Rejected');
    assert.match(embed.description, /has been \*\*rejected\*\*/);
    assert.match(embed.description, /regardless of vehicle value/);
    const text = embed.fields.map(field => field.value).join('\n');
    assert.match(text, /The Car Community/);
    assert.match(text, /Discord username/);
    assert.match(text, /starting the vehicle with your keys/);
    assert.match(text, /`media` upload field/);
    assert.doesNotMatch(text, /handwritten note/);
    assert.equal(embed.author, undefined);
    assert.equal(embed.thumbnail, undefined);
    assert.equal(embed.image, undefined);
    assert.equal(embed.footer.icon_url, logo);
    assert.equal(JSON.stringify(embed).split(logo).length - 1, 1);
    const button = payload.components[0].toJSON().components[0];
    assert.equal(button.label, 'View Guide & Video Example');
    assert.equal(button.url, 'https://discord.com/channels/438650836512669699/630811744213925916/982331631236956260');
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('other servers receive a copy of their own photo-accepting guide', () => {
    const payload = buildGuideRejectionMessage({ application: { ...application, guildId: 'other' },
        guildProfile: { guildId: 'other', guideChannelId: 'guide', videoVerificationRequired: false }, guildName: 'Other Server', footerIcon: logo });
    const embed = payload.embeds[0].toJSON();
    assert.ok(embed.fields.some(field => field.value.includes('Take a picture')));
    assert.doesNotMatch(embed.fields.map(field => field.value).join(' '), /starting the vehicle/);
    assert.equal(payload.components[0].toJSON().components[0].url, 'https://discord.com/channels/other/guide');
});

function fixture({ dmError, cardError, decisionError } = {}) {
    const order = [];
    mock.method(database, 'obtainGuildProfile', async () => profile);
    mock.method(Verification, 'findOne', async () => ({ ...application }));
    const decision = mock.method(decisions, 'commitDecision', async () => {
        order.push('decision'); if (decisionError) throw decisionError;
    });
    const send = mock.fn(async () => { order.push('dm'); if (dmError) throw dmError; });
    const interaction = {
        deferred: false, replied: false,
        user: { id: 'moderator', tag: 'Moderator', displayAvatarURL: () => logo },
        guild: { id: application.guildId, name: 'The Car Community', iconURL: () => logo },
        message: { id: application.applicationMessageId, embeds: [new EmbedBuilder().addFields({ name: 'Status', value: 'Pending' })] },
        client: { users: { fetch: async () => ({ send }) } },
        deferUpdate: async () => { interaction.deferred = true; },
        editReply: mock.fn(async () => { if (cardError) throw cardError; }),
        followUp: mock.fn(async () => {}),
    };
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
    const id = require.resolve('../modules/eventModules/handleGuideDenial');
    delete require.cache[id];
    return { run: () => require(id)(interaction), interaction, decision, send, order };
}

test('Read The Guide records a rejection before sending the full guide and reports delivery accurately', async () => {
    const f = fixture();
    await f.run();
    assert.deepEqual(f.order, ['decision', 'dm']);
    const changes = f.decision.mock.calls[0].arguments[1];
    assert.equal(changes.status, 'closed');
    assert.equal(changes.decision, 'denied-read-guide');
    assert.match(changes.denialReason, /did not meet/);
    assert.equal(f.send.mock.calls[0].arguments[0].embeds[0].toJSON().title, 'Verification Rejected');
    const staffCard = f.interaction.editReply.mock.calls[0].arguments[0];
    assert.equal(staffCard.components[0].toJSON().components[0].label, 'Rejected - Read Guide');
    const confirmation = f.interaction.followUp.mock.calls[0].arguments[0].content;
    assert.match(confirmation, /rejected/);
    assert.match(confirmation, /copy of the guide was sent/);
});

test('closed DMs do not produce a false Guide Sent confirmation', async () => {
    const f = fixture({ dmError: Object.assign(new Error('Cannot DM'), { code: 50007 }) });
    await f.run();
    assert.equal(f.decision.mock.callCount(), 1);
    assert.equal(f.interaction.followUp.mock.callCount(), 1);
    const confirmation = f.interaction.followUp.mock.calls[0].arguments[0].content;
    assert.match(confirmation, /rejected/);
    assert.match(confirmation, /could not be delivered/);
    assert.doesNotMatch(confirmation, /guide was sent/);
});

test('a failed staff-card edit does not prevent the applicant receiving the rejection guide', async () => {
    const f = fixture({ cardError: new Error('Discord edit failed') });
    await f.run();
    assert.equal(f.send.mock.callCount(), 1);
    assert.match(f.interaction.followUp.mock.calls[0].arguments[0].content, /review message could not be updated/);
});

test('a competing decision prevents any rejection DM being sent', async () => {
    const f = fixture({ decisionError: new Error('Already processed') });
    await f.run();
    assert.equal(f.send.mock.callCount(), 0);
    assert.equal(f.interaction.editReply.mock.callCount(), 0);
});
