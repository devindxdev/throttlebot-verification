const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

const discordToken = process.env.TOKEN;
const clientId = '851411747641884712';
const profileGuildId = '438650836512669699';

const profileCommand = require('./commands/stats.js');
const rest = new REST({ version: '9' }).setToken(discordToken);

const payload = profileCommand.data.toJSON();

rest.post(Routes.applicationGuildCommands(clientId, profileGuildId), { body: payload })
    .then((command) => console.log('Successfully created /profile for guild. - ', command.name))
    .catch(console.error);
