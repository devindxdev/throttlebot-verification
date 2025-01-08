const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const discordToken = process.env.TOKEN;

// Remove all warning listeners
process.removeAllListeners('warning');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
	],
});

// Command handler
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);

	// Ensure command files are structured properly
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.warn(`⚠️ Command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}

// Event handler
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);

	// Ensure event files are structured properly
	if ('name' in event && 'execute' in event) {
		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args, client));
		} else {
			client.on(event.name, (...args) => event.execute(...args, client));
		}
	} else {
		console.warn(`⚠️ Event at ${filePath} is missing a required "name" or "execute" property.`);
	}
}

// Global error handling
process.on('unhandledRejection', (error) => {
	console.error('🔥 Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
	console.error('🔥 Uncaught exception:', error);

});

// Login to Discord
client.login(discordToken);
