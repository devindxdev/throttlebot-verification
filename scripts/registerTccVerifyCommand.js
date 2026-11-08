require('dotenv').config();
const { buildVerifyCommand } = require('../modules/verification/verifyCommand');
const TCC_GUILD_ID = '438650836512669699';

async function main() {
    const command = buildVerifyCommand({ videoOnly: true }).toJSON();
    if (!process.argv.includes('--apply')) {
        console.log(JSON.stringify({ mode: 'preview', guildId: TCC_GUILD_ID, command }, null, 2));
        return;
    }
    const token = (process.env.BOT_TOKEN || process.env.TOKEN || '').trim().replace(/^Bot\s+/i, '');
    if (!token) throw new Error('Bot token is missing.');
    const headers = { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' };
    const identity = await fetch('https://discord.com/api/v10/oauth2/applications/@me', { headers, signal: AbortSignal.timeout(20000) });
    if (!identity.ok) throw Object.assign(new Error('Could not read bot application.'), { status: identity.status });
    const application = await identity.json();
    // POST upserts only /verify; it does not replace other commands in this guild.
    const response = await fetch(`https://discord.com/api/v10/applications/${application.id}/guilds/${TCC_GUILD_ID}/commands`, {
        method: 'POST', headers, body: JSON.stringify(command), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Object.assign(new Error('Could not register TCC /verify command.'), { status: response.status });
    const registered = await response.json();
    console.log(JSON.stringify({ registered: true, guildId: TCC_GUILD_ID, commandId: registered.id, attachmentOption: registered.options.find(option => option.type === 11)?.name }, null, 2));
}
if (require.main === module) main().catch(error => {
    console.error(JSON.stringify({ failed: true, errorType: error.name, status: error.status || null }));
    process.exitCode = 1;
});
module.exports = { main };
