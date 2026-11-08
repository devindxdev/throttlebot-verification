const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachmentKind, assertEvidenceAllowed } = require('../modules/verification/evidencePolicy');
const database = require('../modules/database');
const expiry = require('../modules/verification/expiry');
const Verification = require('../mongodb_schema/verificationApplicationSchema');
const Guild = require('../mongodb_schema/guildProfileSchema');
const { configureTccVideoVerification, TCC_GUILD_ID } = require('../scripts/configureTccVideoVerification');

const picture = { contentType: 'image/jpeg', name: 'proof.jpg', url: 'https://example.com/proof.jpg', size: 1024 };
const video = { contentType: 'video/mp4', name: 'proof.mp4', url: 'https://example.com/proof.mp4', size: 1024 };
const profile = { guildId: TCC_GUILD_ID, verificationChannelId: 'review', guideChannelId: 'guide', loggingChannelId: null, videoVerificationRequired: true };
const avatar = 'https://example.com/avatar.png';
const reload = path => { const id = require.resolve(path); delete require.cache[id]; return require(id); };
let restoreAiModule;
afterEach(() => {
    mock.restoreAll();
    if (restoreAiModule) restoreAiModule();
    restoreAiModule = null;
});

function interactionFixture() {
    return {
        user: { id: 'applicant', tag: 'Applicant', displayAvatarURL: () => avatar },
        guild: { id: TCC_GUILD_ID, name: 'The Car Community', iconURL: () => avatar },
        editReply: mock.fn(async () => {}),
    };
}

function validationFixture() {
    mock.method(database, 'obtainUserProfile', async () => ({}));
    mock.method(database, 'obtainAllUserVehicles', async () => []);
    mock.method(database, 'obtainAllOpenUserApplications', async () => []);
    const closeExpired = mock.method(expiry, 'closeExpiredApplications', async () => ({ modifiedCount: 0 }));
    const validate = reload('../modules/commandModules/verify/validateInput');
    return { validate, closeExpired, interaction: interactionFixture() };
}

function submissionFixture(currentProfile) {
    const lookup = mock.method(database, 'obtainGuildProfile', async () => currentProfile);
    mock.method(database, 'getEstimatedETA', async () => '1 hour');
    const aiId = require.resolve('../modules/commandModules/verify/aiAnalysis');
    const previous = require.cache[aiId];
    const ai = mock.fn(async () => { throw new Error('Video must not reach image AI'); });
    require.cache[aiId] = { id: aiId, filename: aiId, loaded: true, exports: ai };
    restoreAiModule = () => { if (previous) require.cache[aiId] = previous; else delete require.cache[aiId]; };
    const submit = reload('../modules/commandModules/verify/submitApplication');
    const save = mock.method(Verification.prototype, 'save', async function () { return this; });
    const send = mock.fn(async () => ({ id: 'review-message', delete: async () => {} }));
    const interaction = interactionFixture();
    interaction.guild.channels = { fetch: mock.fn(async () => ({ send })) };
    return { submit, lookup, ai, save, send, interaction };
}

test('video requirement defaults off and checks video MIME types rather than filenames or substrings', () => {
    assert.equal(new Guild({ guildId: 'other' }).videoVerificationRequired, false);
    assert.equal(attachmentKind({ contentType: 'VIDEO/QUICKTIME; codecs=hevc' }), 'video');
    for (const attachment of [picture, { ...picture, name: 'fake.mp4' }, { contentType: 'image/video' }, { contentType: 'application/x-video' }, {}]) {
        assert.throws(() => assertEvidenceAllowed(profile, attachment), { code: 'VIDEO_REQUIRED' });
    }
    assert.doesNotThrow(() => assertEvidenceAllowed(profile, video));
    assert.doesNotThrow(() => assertEvidenceAllowed({ videoVerificationRequired: false }, picture));
});

test('TCC photo rejection links to the guide before any cleanup or application submission', async () => {
    const f = validationFixture();
    assert.equal(await f.validate(f.interaction, picture, 'Honda Civic', 'applicant', profile), false);
    assert.equal(f.closeExpired.mock.callCount(), 0);
    const error = f.interaction.editReply.mock.calls[0].arguments[0].embeds[0].toJSON();
    assert.match(error.description, /requires video verification/);
    assert.match(error.description, /<#guide>/);
});

test('TCC video passes validation and other servers retain photo verification', async () => {
    const f = validationFixture();
    assert.equal(await f.validate(f.interaction, video, 'Honda Civic', 'applicant', profile), true);
    assert.equal(await f.validate(f.interaction, picture, 'Honda Civic', 'applicant', { ...profile, guildId: 'other', videoVerificationRequired: false }), true);
});

test('policy change during confirmation rejects an older photo before posting or saving', async () => {
    const f = submissionFixture(profile);
    await assert.rejects(f.submit(f.interaction, 'Honda Civic', picture, { ...profile, videoVerificationRequired: false }), { code: 'VIDEO_REQUIRED' });
    assert.deepEqual(f.lookup.mock.calls[0].arguments, [TCC_GUILD_ID]);
    assert.equal(f.send.mock.callCount(), 0);
    assert.equal(f.save.mock.callCount(), 0);
    assert.equal(f.ai.mock.callCount(), 0);
});

test('TCC videos go to staff as playable attachments even when image AI is enabled', async () => {
    const f = submissionFixture({ ...profile, geminiAnalysisEnabled: true });
    await f.submit(f.interaction, 'Honda Civic', video, profile);
    assert.equal(f.ai.mock.callCount(), 0);
    assert.equal(f.save.mock.callCount(), 1);
    assert.equal(f.save.mock.calls[0].this.status, 'open');
    assert.equal(f.save.mock.calls[0].this.aiAnalysis, null);
    const payload = f.send.mock.calls[0].arguments[0];
    assert.deepEqual(payload.files, [{ attachment: video.url, name: video.name }]);
    assert.match(payload.content, /Vehicle Verification Video/);
    const confirmation = f.interaction.editReply.mock.calls[0].arguments[0].embeds[0].toJSON();
    assert.equal(confirmation.thumbnail, undefined);
    assert.match(confirmation.description, /reviewed by the server staff/);
});

test('photo submissions remain functional in a server without the video policy', async () => {
    const f = submissionFixture({ ...profile, guildId: 'other', videoVerificationRequired: false, geminiAnalysisEnabled: false });
    f.interaction.guild.id = 'other';
    await f.submit(f.interaction, 'Honda Civic', picture, profile);
    assert.equal(f.send.mock.calls[0].arguments[0].files, undefined);
    const confirmation = f.interaction.editReply.mock.calls[0].arguments[0].embeds[0].toJSON();
    assert.equal(confirmation.thumbnail.url, picture.url);
});

test('video confirmation shows the evidence link and uses a submission label instead of AI screening', async () => {
    const confirm = require('../modules/commandModules/verify/handleConfirmation');
    const interaction = interactionFixture();
    const collector = new EventEmitter();
    collector.stop = () => {};
    interaction.channel = { createMessageComponentCollector: () => collector };
    const pending = confirm(interaction, 'Honda Civic', video, profile, avatar);
    await new Promise(resolve => setImmediate(resolve));
    const first = interaction.editReply.mock.calls[0].arguments[0].embeds[0].toJSON();
    assert.equal(first.image, undefined);
    assert.ok(first.fields.some(field => field.value.includes(video.url)));
    assert.ok(first.fields.some(field => field.name === 'Video verification' && field.value.includes('<#guide>')));
    collector.emit('collect', { customId: 'confirmVerification', deferUpdate: async () => {} });
    assert.equal(await pending, true);
    const running = interaction.editReply.mock.calls[1].arguments[0].components[0].toJSON();
    assert.equal(running.components[0].label, 'Submitting Video');
});

test('TCC configuration preview makes no writes; apply targets only that existing profile', async () => {
    const stored = { _id: 'tcc-profile', guildId: TCC_GUILD_ID, geminiAnalysisEnabled: true };
    const write = mock.fn(async () => ({ matchedCount: 1, modifiedCount: 1 }));
    const collection = {
        find: mock.fn(() => ({ limit: () => ({ toArray: async () => [stored] }) })),
        updateOne: write,
    };
    const db = { collection: name => { assert.equal(name, 'guilds'); return collection; } };
    const preview = await configureTccVideoVerification(db);
    assert.equal(preview.guildId, TCC_GUILD_ID);
    assert.deepEqual(preview.proposedUpdate, { $set: { videoVerificationRequired: true } });
    assert.equal(write.mock.callCount(), 0);
    const applied = await configureTccVideoVerification(db, { apply: true });
    assert.equal(applied.modifiedCount, 1);
    const [filter, update] = write.mock.calls[0].arguments;
    assert.equal(filter.guildId, TCC_GUILD_ID);
    assert.equal(filter._id, stored._id);
    assert.deepEqual(filter.videoVerificationRequired, { $exists: false });
    assert.deepEqual(Object.keys(update.$set).sort(), ['updatedAt', 'videoVerificationRequired']);
});

test('missing or duplicate TCC profiles stop configuration without writing', async () => {
    for (const profiles of [[], [{}, {}]]) {
        const write = mock.fn();
        const db = { collection: () => ({ find: () => ({ limit: () => ({ toArray: async () => profiles }) }), updateOne: write }) };
        await assert.rejects(configureTccVideoVerification(db, { apply: true }), /exactly one/);
        assert.equal(write.mock.callCount(), 0);
    }
});


test('video guide requires video for all values and removes the photo example', () => {
    const { buildVideoGuide, buildVerificationGuide } = require('../modules/verification/guideEmbed');
    const guide = buildVideoGuide('The Car Community').toJSON();
    assert.match(guide.description, /regardless of vehicle value/);
    assert.equal(guide.image, undefined);
    const text = guide.fields.map(field => field.value).join('\n');
    assert.doesNotMatch(text, /handwritten note/);
    assert.match(text, /out loud/);
    assert.match(text, /starting the vehicle with your keys/);
    assert.match(text, /The Car Community/);
    assert.match(text, /`media` upload field/);
    assert.match(text, /original, unedited video/);
    assert.deepEqual(buildVerificationGuide({ videoVerificationRequired: true }, 'The Car Community').toJSON(), guide);
    const tcc = buildVerificationGuide({ guildId: TCC_GUILD_ID, videoVerificationRequired: true }, 'The Car Community').toJSON();
    assert.match(tcc.fields.map(field => field.value).join('\n'), /`media` upload field/);
    assert.ok(buildVerificationGuide({ videoVerificationRequired: false }, 'Other Server').toJSON().image);
    assert.ok(JSON.stringify(guide).length < 6000);
});

test('video checklist gives the exact spoken identity and a clear not-submitted path', async () => {
    const checklist = require('../modules/commandModules/verify/handlePreApproval');
    const interaction = interactionFixture();
    interaction.user.username = 'actual.username';
    const collector = new EventEmitter();
    collector.stop = () => {};
    interaction.channel = { createMessageComponentCollector: () => collector };
    const pending = checklist(interaction, profile, avatar, video);
    await new Promise(resolve => setImmediate(resolve));
    const payload = interaction.editReply.mock.calls[0].arguments[0];
    const embed = payload.embeds[0].toJSON();
    assert.match(embed.author.name, /Video Verification/);
    const checklistText = embed.fields.map(field => field.value).join('\n');
    assert.match(checklistText, /The Car Community/);
    assert.match(checklistText, /actual.username/);
    assert.match(checklistText, /starting the vehicle with your keys/);
    assert.doesNotMatch(checklistText, /handwritten|AI-generated images/);
    assert.equal(payload.components[0].toJSON().components[0].label, 'My Video Is Ready');
    collector.emit('collect', { customId: 'preApprovalNo', deferUpdate: async () => {} });
    assert.equal(await pending, false);
    const result = interaction.editReply.mock.calls[1].arguments[0].embeds[0].toJSON();
    assert.match(result.author.name, /Not Submitted/);
    assert.match(result.description, /has not been submitted/);
    assert.doesNotMatch(result.author.name, /Denied/);
});

test('video confirmations show a staff upload state and awaiting-review receipt', async () => {
    const confirm = require('../modules/commandModules/verify/handleConfirmation');
    const interaction = interactionFixture();
    const collector = new EventEmitter();
    collector.stop = () => {};
    interaction.channel = { createMessageComponentCollector: () => collector };
    const pending = confirm(interaction, 'Honda Civic', video, profile, avatar);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(interaction.editReply.mock.calls[0].arguments[0].components[0].toJSON().components[0].label, 'Submit Video');
    collector.emit('collect', { customId: 'confirmVerification', deferUpdate: async () => {} });
    assert.equal(await pending, true);
    const uploading = interaction.editReply.mock.calls[1].arguments[0].embeds[0].toJSON();
    assert.equal(uploading.author.name, 'Submitting Video Verification');
    assert.match(uploading.description, /uploaded for staff review/);
    assert.doesNotMatch(uploading.description, /\bAI\b|pre.screen/i);

    const f = submissionFixture({ ...profile, geminiAnalysisEnabled: true });
    await f.submit(f.interaction, 'Honda Civic', video, profile);
    const receipt = f.interaction.editReply.mock.calls[0].arguments[0].embeds[0].toJSON();
    assert.equal(receipt.author.name, 'Video Verification Submitted');
    assert.ok(receipt.fields.some(field => field.name === 'Review Status' && field.value === 'Awaiting staff review'));
    assert.match(f.send.mock.calls[0].arguments[0].embeds[0].toJSON().description, /spoken server name and Discord username/);
});

test('video cancellation and checklist/confirmation timeouts clearly say nothing was submitted', async () => {
    for (const [moduleName, end, args] of [
        ['handlePreApproval', 'time', [profile, avatar, video]],
        ['handleConfirmation', 'time', ['Honda Civic', video, profile, avatar]],
        ['handleConfirmation', 'cancel', ['Honda Civic', video, profile, avatar]],
    ]) {
        const interaction = interactionFixture();
        const collector = new EventEmitter();
        collector.stop = () => {};
        interaction.channel = { createMessageComponentCollector: () => collector };
        const handler = require(`../modules/commandModules/verify/${moduleName}`);
        const pending = handler(interaction, ...args);
        await new Promise(resolve => setImmediate(resolve));
        if (end === 'time') collector.emit('end', [], 'time');
        else collector.emit('collect', { customId: 'cancelVerification', deferUpdate: async () => {} });
        assert.equal(await pending, false);
        const last = interaction.editReply.mock.calls.at(-1).arguments[0];
        assert.match(last.embeds[0].toJSON().description, /not (?:been )?submitted/);
        if (end === 'time' && moduleName === 'handleConfirmation') {
            assert.ok(last.components[0].toJSON().components.every(button => button.disabled));
        } else assert.deepEqual(last.components, []);
    }
});

test('video upload failures give actionable compression guidance and preserve policy errors', () => {
    const { submissionErrorMessage } = require('../modules/verification/evidencePolicy');
    const large = submissionErrorMessage({ code: 40005 }, { video: true });
    assert.match(large, /video is too large/);
    assert.match(large, /Shorten or compress/);
    assert.match(large, /voice audible/);
    assert.doesNotMatch(large, /boosted server|image|photo/);
    assert.match(submissionErrorMessage(new Error('network'), { video: true }), /video verification/);
    assert.equal(submissionErrorMessage({ code: 'VIDEO_REQUIRED', message: 'Video required here' }), 'Video required here');
});

test('one shared verify command uses a neutral media attachment field', () => {
    const { buildVerifyCommand } = require('../modules/verification/verifyCommand');
    const command = buildVerifyCommand().toJSON();
    assert.equal(command.options.find(option => option.type === 11).name, 'media');
    assert.match(command.options.find(option => option.type === 11).description, /if your server allows it/);
});

test('verify handler accepts media and both legacy upload options during rollout', async () => {
    const paths = ['validateInput', 'handlePreApproval', 'handleConfirmation', 'submitApplication'];
    const previous = new Map();
    const handlers = new Map();
    mock.method(database, 'obtainGuildProfile', async () => profile);
    try {
        for (const name of paths) {
            const id = require.resolve(`../modules/commandModules/verify/${name}`);
            previous.set(id, require.cache[id]);
            const handler = mock.fn(async () => true);
            handlers.set(name, handler);
            require.cache[id] = { id, filename: id, loaded: true, exports: handler };
        }
        const command = reload('../commands/verify');
        for (const option of ['media', 'video', 'image']) {
            const interaction = interactionFixture();
            interaction.deferReply = async () => { interaction.deferred = true; };
            interaction.options = { getString: () => 'Honda Civic', getAttachment: name => name === option ? video : null };
            await command.execute(interaction);
            assert.equal(handlers.get('submitApplication').mock.calls.at(-1).arguments[2], video);
            assert.equal(handlers.get('handlePreApproval').mock.calls.at(-1).arguments[3], video);
        }
        assert.equal(handlers.get('submitApplication').mock.callCount(), 3);
        handlers.get('submitApplication').mock.mockImplementation(async () => { throw Object.assign(new Error('too large'), { code: 40005 }); });
        mock.method(console, 'error', () => {});
        const failed = interactionFixture();
        failed.deferReply = async () => { failed.deferred = true; };
        failed.options = { getString: () => 'Honda Civic', getAttachment: name => name === 'video' ? video : null };
        await command.execute(failed);
        const error = failed.editReply.mock.calls[0].arguments[0];
        assert.match(error.embeds[0].toJSON().description, /video is too large/);
        assert.deepEqual(error.components, []);
    } finally {
        for (const [id, module] of previous) {
            if (module) require.cache[id] = module;
            else delete require.cache[id];
        }
        delete require.cache[require.resolve('../commands/verify')];
    }
});
