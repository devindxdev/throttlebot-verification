const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function startup(profileIndexError) {
    const calls = { warnings: [], errors: [], maintenance: 0 };
    const context = {
        module: { exports: {} },
        process: { env: { MONGOURI: 'mongodb://example.invalid/throttlebot-verification' } },
        console: { log() {}, warn: value => calls.warnings.push(value), error: value => calls.errors.push(value) },
        setInterval() {},
        require(id) {
            if (id === 'dotenv') return { config() {} };
            if (id === 'mongoose') return { connect: async () => {}, connection: { db: {}, getClient: () => ({}) } };
            if (id.endsWith('/connection')) return { databaseName: () => 'throttlebot-verification' };
            if (id.endsWith('/garageMaintenance')) return { migrateGarages: async () => ({ applied: true }) };
            if (id.endsWith('/expiry')) return { startExpiryMaintenance: () => { calls.maintenance++; } };
            if (id.includes('userProfileSchema')) return { createIndexes: async () => { if (profileIndexError) throw profileIndexError; } };
            return { createIndexes: async () => {} };
        },
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../events/ready.js'), 'utf8'), context);
    return { handler: context.module.exports, calls };
}

test('legacy duplicate profiles do not block verification startup or trigger profile cleanup', async () => {
    const { handler, calls } = startup(Object.assign(new Error('duplicate'), { code: 11000 }));
    const client = { databaseReady: false, user: { tag: 'bot' } };
    await handler.execute(client);
    assert.equal(client.databaseReady, true);
    assert.equal(calls.maintenance, 1);
    assert.equal(calls.errors.length, 0);
    assert.match(calls.warnings[0], /separate cleanup/);
});

test('permission failures still keep database-backed commands unavailable', async () => {
    const { handler, calls } = startup(Object.assign(new Error('permission denied'), { code: 13 }));
    const client = { databaseReady: false, user: { tag: 'bot' } };
    await handler.execute(client);
    assert.equal(client.databaseReady, false);
    assert.equal(calls.maintenance, 0);
    assert.equal(calls.errors.length, 1);
});

test('status distinguishes Discord login from completed verification initialization', async () => {
    const context = { module: { exports: {} }, process: { env: {} }, Date,
        require(id) {
            if (id === 'express') return () => ({});
            return { countDocuments: async () => 1 };
        },
    };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../modules/status/statusServer.js'), 'utf8'), context);
    const { buildStatusPayload } = context.module.exports;
    const client = { isReady: () => true, databaseReady: false, guilds: { cache: new Map() } };
    assert.equal((await buildStatusPayload(client)).status, 'starting');
    client.databaseReady = true;
    const ready = await buildStatusPayload(client);
    assert.equal(ready.status, 'ok');
    assert.equal(ready.verificationReady, true);
    assert.equal(ready.verificationPolicyVersion, 1);
});
