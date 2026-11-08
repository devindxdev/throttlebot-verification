require('dotenv').config();
const mongoose = require('mongoose');
const { databaseName } = require('../modules/verification/connection');
const { migrateGarages } = require('../modules/verification/garageMaintenance');
const { startExpiryMaintenance } = require('../modules/verification/expiry');

const presenceMessages = [
    "Busy verifying rides",
    "Cruising through servers",
    "Making sure rides are legit",
    "Scanning VINs and plates",
    "Handling your garage like a pro",
    "Streamlining vehicle verifications",
    "/help for guidance on commands",
    "Keeping Discord garages in check",
    "Ensuring smooth rides everywhere",
];

module.exports = {
    name: 'ready',
    once: true,
    /**
     * Executes when the bot is ready.
     * @param {import('discord.js').Client} client - The Discord client instance.
     */
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Connect to MongoDB
        const mongoURI = process.env.MONGO_WRITE_URI || process.env.MONGOURI;
        try {
            await mongoose.connect(mongoURI, {
                dbName: databaseName(mongoURI),
                autoIndex: false,
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('MongoDB connection established.');
            await migrateGarages(mongoose.connection.db, mongoose.connection.getClient(), { apply: true });
            await require('../mongodb_schema/userProfileSchema').createIndexes().catch(error => {
                // A legacy duplicate profile must not disable all verification commands.
                // Leave profiles intact; repairing their preferences needs separate review.
                if (error.code !== 11000) throw error;
                console.warn('User uniqueness index deferred: legacy duplicate profiles require separate cleanup.');
            });
            await require('../mongodb_schema/verificationApplicationSchema').createIndexes();
            await require('../mongodb_schema/guildProfileSchema').createIndexes();
            startExpiryMaintenance(client);
            client.databaseReady = true;
        } catch (error) {
            console.error(`MongoDB connection failed.\nError: ${error.message}`);
            return; // Exit early if database connection fails
        }

        // Dynamic presence updates
        let currentIndex = 0;

        setInterval(() => {
            const newActivity = presenceMessages[currentIndex];
            client.user.setPresence({
                activities: [{ name: newActivity, type: 0 }], // Type 0 = Playing
                status: 'online',
            });

            currentIndex = (currentIndex + 1) % presenceMessages.length; // Cycle through messages
        }, 5 * 60 * 1000); // Updates every 5 minutes
    },
};
