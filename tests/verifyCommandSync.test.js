const { test } = require('node:test');
const assert = require('node:assert/strict');
const { syncVerifyCommand } = require('../scripts/syncVerifyCommand');

function fixture({ failUpdate = false } = {}) {
    const global = [{ id: 'original', name: 'verify', type: 1, options: [{ name: 'image', type: 11 }] }, { id: 'stats', name: 'stats', type: 1 }];
    const tcc = [{ id: 'duplicate', name: 'verify', type: 1 }, { id: 'other', name: 'help', type: 1 }];
    const calls = [];
    async function request(path, options = {}) {
        calls.push({ path, method: options.method || 'GET' });
        if (options.method === 'PATCH') {
            if (!failUpdate) Object.assign(global[0], options.body);
            return structuredClone(global[0]);
        }
        if (options.method === 'DELETE') {
            const index = tcc.findIndex(command => path.endsWith('/' + command.id));
            assert.equal(tcc[index].id, 'duplicate');
            tcc.splice(index, 1);
            return null;
        }
        return structuredClone(path.includes('/guilds/') ? tcc : global);
    }
    return { global, tcc, calls, request };
}

test('command preview performs no writes', async () => {
    const f = fixture();
    const plan = await syncVerifyCommand(f.request, 'app');
    assert.equal(plan.attachmentOption, 'media');
    assert.deepEqual(plan.tccDuplicateIds, ['duplicate']);
    assert.ok(f.calls.every(call => call.method === 'GET'));
});

test('consolidation retains the global command identity and unrelated commands', async () => {
    const f = fixture();
    const result = await syncVerifyCommand(f.request, 'app', { apply: true });
    assert.equal(result.verified, true);
    assert.equal(f.global[0].id, 'original');
    assert.equal(f.global[0].options.find(option => option.type === 11).name, 'media');
    assert.deepEqual(f.global.map(command => command.id), ['original', 'stats']);
    assert.deepEqual(f.tcc.map(command => command.id), ['other']);
    const writes = f.calls.filter(call => call.method !== 'GET');
    assert.deepEqual(writes, [
        { path: '/applications/app/commands/original', method: 'PATCH' },
        { path: '/applications/app/guilds/438650836512669699/commands/duplicate', method: 'DELETE' },
    ]);
});

test('an unverified global update cannot remove the working TCC command', async () => {
    const f = fixture({ failUpdate: true });
    await assert.rejects(syncVerifyCommand(f.request, 'app', { apply: true }), /not removed/);
    assert.equal(f.tcc.length, 2);
    assert.ok(!f.calls.some(call => call.method === 'DELETE'));
});
