const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EmbedBuilder, GatewayIntentBits, Collection } = require('discord.js');
const database = require('../modules/database.js');
const verificationSchema = require('../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../mongodb_schema/garageSchema.js');
const userProfileSchema = require('../mongodb_schema/userProfileSchema.js');

afterEach(() => mock.restoreAll());

function fixture(status, fetchError) {
    const application = {
        _id: 'application-id', guildId: 'guild-id', userId: 'applicant-id',
        vehicle: 'Honda Civic', vehicleBrand: 'Honda', vehicleModel: 'Civic',
        applicationMessageId: 'message-id', status,
        vehicleImageURL: 'https://example.com/car.png',
    };
    const updates = mock.method(verificationSchema, 'updateOne', async () => ({ modifiedCount: 1 }));
    mock.method(verificationSchema, 'findOne', async () => application);
    const garageLookup = mock.method(garageSchema, 'findOne', async () => ({ vehicleBrand: 'Honda' }));
    const garageSave = mock.method(garageSchema.prototype, 'save', async () => {});
    const profileSave = mock.method(userProfileSchema.prototype, 'save', async () => {});
    mock.method(database, 'obtainGuildProfile', async () => ({ verifiedVehicleRoleId: 'role-id' }));
    mock.method(database, 'obtainUserProfile', async () => ({}));
    const rolesAdd = mock.fn(async () => {});
    const memberFetch = mock.fn(async () => {
        if (fetchError) throw fetchError;
        return { roles: { add: rolesAdd } };
    });
    const editReply = mock.fn(async () => {});
    const followUp = mock.fn(async () => {});
    const interaction = {
        deferred: false, replied: false,
        guild: {
            id: 'guild-id', name: 'Test Server', iconURL: () => 'https://example.com/icon.png',
            members: { fetch: memberFetch }, channels: { fetch: async () => null },
        },
        user: { id: 'moderator-id', tag: 'Moderator', displayAvatarURL: () => 'https://example.com/avatar.png' },
        message: { id: 'message-id', embeds: [new EmbedBuilder().addFields({ name: 'Status', value: 'Pending' })] },
        client: { users: { fetch: async () => ({ send: async () => {} }) } },
        deferUpdate: async () => { interaction.deferred = true; },
        editReply, followUp, reply: followUp,
    };
    const modal = {
        ...interaction,
        fields: { getTextInputValue: () => 'Approved after review' },
        deferUpdate: async () => { modal.deferred = true; },
    };
    interaction.id = 'interaction-id';
    interaction.showModal = async () => { interaction.replied = true; };
    interaction.awaitModalSubmit = async () => modal;
    return { interaction, updates, garageLookup, garageSave, profileSave, memberFetch, rolesAdd, editReply, followUp };
}

for (const [handlerName, status, approvedDecision] of [
    ['handleApproval', 'open', 'approved'],
    ['handleOverrideApprove', 'auto-denied', 'overridden-approved'],
]) {
    async function run(f) {
        const handlerPath = require.resolve(`../modules/eventModules/${handlerName}.js`);
        delete require.cache[handlerPath];
        await require(handlerPath)(f.interaction);
    }

    test(`${handlerName}: departed applicant is closed without approval or garage writes`, async () => {
        const f = fixture(status, Object.assign(new Error('Unknown Member'), { code: 10007 }));
        await run(f);
        assert.deepEqual(f.memberFetch.mock.calls[0].arguments, [{ user: 'applicant-id', force: true }]);
        const [filter, update] = f.updates.mock.calls[0].arguments;
        assert.deepEqual(filter, { _id: 'application-id', guildId: 'guild-id', status });
        assert.equal(update.$set.decision, 'denied | User Left');
        assert.equal(update.$set.status, 'closed');
        assert.equal(f.garageLookup.mock.callCount(), 0);
        assert.equal(f.garageSave.mock.callCount(), 0);
        assert.equal(f.profileSave.mock.callCount(), 0);
        assert.equal(f.rolesAdd.mock.callCount(), 0);
        const reply = f.editReply.mock.calls[0].arguments[0];
        assert.match(reply.embeds[0].toJSON().fields[0].value, /User left/);
        assert.equal(reply.components[0].toJSON().components[0].disabled, true);
    });

    test(`${handlerName}: API failure leaves the application unchanged`, async () => {
        const f = fixture(status, Object.assign(new Error('Missing Access'), { code: 50001 }));
        const log = mock.method(console, 'error', () => {});
        await run(f);
        assert.equal(f.updates.mock.callCount(), 0);
        assert.equal(f.garageLookup.mock.callCount(), 0);
        assert.equal(f.editReply.mock.callCount(), 0);
        assert.equal(f.rolesAdd.mock.callCount(), 0);
        assert.equal(f.followUp.mock.callCount(), 1);
        assert.equal(log.mock.callCount(), 1);
    });

    test(`${handlerName}: current member can still be approved and receive a role`, async () => {
        const f = fixture(status);
        await run(f);
        assert.deepEqual(f.memberFetch.mock.calls[0].arguments, [{ user: 'applicant-id', force: true }]);
        assert.equal(f.memberFetch.mock.callCount(), 1);
        assert.equal(f.updates.mock.calls[0].arguments[1].$set.decision, approvedDecision);
        assert.deepEqual(f.rolesAdd.mock.calls[0].arguments, ['role-id']);
        assert.equal(f.editReply.mock.callCount(), 1);
    });
}

test('startup requests no privileged intents and omits member event handlers', () => {
    let requestedIntents;
    const registered = [];
    class FakeClient {
        constructor(options) { requestedIntents = options.intents; }
        on(name) { registered.push(name); }
        once(name) { registered.push(name); }
        login() {}
    }
    const root = path.resolve(__dirname, '..');
    vm.runInNewContext(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), {
        __dirname: root,
        process: { env: {}, removeAllListeners() {}, on() {} },
        console,
        require(id) {
            if (id === 'discord.js') return { Client: FakeClient, GatewayIntentBits, Collection };
            if (id === 'dotenv') return { config() {} };
            if (id === 'node:path') return path;
            if (id === 'node:fs') return {
                readdirSync(dir) { return dir.endsWith('commands') ? [] : ['guildMemberRemove.js', 'guildMemberUpdate.js', 'commandHandling.js']; },
            };
            if (id === './modules/status/statusServer.js') return { startStatusServer() {} };
            return { name: path.basename(id) === 'commandHandling.js' ? 'interactionCreate' : path.basename(id, '.js'), execute() {} };
        },
    });
    assert.deepEqual(Array.from(requestedIntents), [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]);
    assert.deepEqual(registered, ['interactionCreate']);
});
