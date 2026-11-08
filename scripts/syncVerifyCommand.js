require('dotenv').config();
const { buildVerifyCommand } = require('../modules/verification/verifyCommand');
const TCC_GUILD_ID = '438650836512669699';
const isVerify = command => command.name === 'verify' && command.type === 1;

async function syncVerifyCommand(request, applicationId, { apply = false } = {}) {
    const globalPath = `/applications/${applicationId}/commands`;
    const tccPath = `/applications/${applicationId}/guilds/${TCC_GUILD_ID}/commands`;
    const [globalCommands, tccCommands] = await Promise.all([request(globalPath), request(tccPath)]);
    const globalVerify = globalCommands.filter(isVerify);
    if (globalVerify.length !== 1) throw new Error('Expected exactly one existing global /verify command.');
    const duplicates = tccCommands.filter(isVerify);
    const { type, ...command } = buildVerifyCommand().toJSON();
    const summary = { mode: apply ? 'apply' : 'preview', globalCommandId: globalVerify[0].id,
        attachmentOption: 'media', tccDuplicateIds: duplicates.map(item => item.id) };
    if (!apply) return summary;

    // Update the existing global command before removing only its TCC duplicate.
    // Other commands and other guild registrations are never overwritten.
    const updated = await request(`${globalPath}/${globalVerify[0].id}`, { method: 'PATCH', body: command });
    if (updated.id !== globalVerify[0].id || updated.options?.find(option => option.type === 11)?.name !== 'media') {
        throw new Error('Global command update could not be verified; TCC command was not removed.');
    }
    for (const duplicate of duplicates) await request(`${tccPath}/${duplicate.id}`, { method: 'DELETE' });
    const [afterGlobal, afterTcc] = await Promise.all([request(globalPath), request(tccPath)]);
    const remaining = afterGlobal.filter(isVerify);
    if (remaining.length !== 1 || afterTcc.some(isVerify) || remaining[0].options?.find(option => option.type === 11)?.name !== 'media') {
        throw new Error('Command consolidation verification failed.');
    }
    return { ...summary, verified: true, globalVerifyCount: 1, tccVerifyCount: 0 };
}

async function main() {
    const apply = process.argv.includes('--apply');
    if (apply) {
        const status = await fetch('https://throttlebot-verify.herokuapp.com/status?rollout=' + Date.now(), { signal: AbortSignal.timeout(20000) });
        const payload = await status.json();
        if (!payload.verificationReady || payload.verificationPolicyVersion < 2) throw new Error('Deploy media-compatible bot code before changing the live command.');
    }
    const token = (process.env.BOT_TOKEN || process.env.TOKEN || '').trim().replace(/^Bot\s+/i, '');
    if (!token) throw new Error('Bot token is missing.');
    async function request(path, options = {}) {
        const response = await fetch('https://discord.com/api/v10' + path, {
            ...options, body: options.body ? JSON.stringify(options.body) : undefined,
            headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw Object.assign(new Error('Discord command request failed.'), { status: response.status });
        return response.status === 204 ? null : response.json();
    }
    const application = await request('/oauth2/applications/@me');
    console.log(JSON.stringify(await syncVerifyCommand(request, application.id, { apply }), null, 2));
}
if (require.main === module) main().catch(error => {
    console.error(JSON.stringify({ failed: true, errorType: error.name, status: error.status || null }));
    process.exitCode = 1;
});
module.exports = { main, syncVerifyCommand };
