const express = require('express');
const garageSchema = require('../../mongodb_schema/garageSchema.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');

const STATUS_PORT = Number(process.env.STATUS_PORT || process.env.PORT) || 3000;
const STATUS_PATH = process.env.STATUS_PATH || '/status';

function sumGuildMembers(client) {
    if (!client?.guilds?.cache) return 0;
    let total = 0;
    client.guilds.cache.forEach((guild) => {
        total += guild.memberCount || 0;
    });
    return total;
}

async function buildStatusPayload(client) {
    const isReady = Boolean(client?.isReady?.());
    const now = new Date();
    const payload = {
        status: isReady ? 'ok' : 'starting',
        updatedAt: now.toISOString(),
        guilds: isReady ? client.guilds.cache.size : 0,
        users: isReady ? sumGuildMembers(client) : 0,
    };

    try {
        payload.verifiedVehicles = await garageSchema.countDocuments();
        payload.totalVerifications = await verificationSchema.countDocuments();
    } catch (err) {
        payload.error = 'stats_unavailable';
    }

    return payload;
}

function startStatusServer(client) {
    const app = express();

    app.get(STATUS_PATH, async (req, res) => {
        const payload = await buildStatusPayload(client);
        if (req.query.badge === '1') {
            const message = payload.status === 'ok'
                ? `${payload.guilds} servers • ${payload.users} users`
                : 'starting';
            return res.json({
                schemaVersion: 1,
                label: 'bot stats',
                message,
                color: payload.status === 'ok' ? 'red' : 'lightgrey',
            });
        }
        res.json(payload);
    });

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    app.listen(STATUS_PORT, () => {
        console.log(`Status endpoint listening on port ${STATUS_PORT}${STATUS_PATH}`);
    });
}

module.exports = { startStatusServer };
