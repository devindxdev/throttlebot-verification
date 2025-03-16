require('dotenv').config();
const mongoose = require('mongoose');

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
        const mongoURI = process.env.MONGOURI;
        try {
            await mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('MongoDB connection established.');
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
