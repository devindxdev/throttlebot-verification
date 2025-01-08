require('dotenv').config();
const mongoose = require('mongoose');

const presenceMessages = [
    "Busy verifying shitboxes",
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
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Connect to MongoDB
        const mongoURI = process.env.MONGOURI;
        mongoose
            .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
            .then(() => console.log('MongoDB connection established.'))
            .catch((error) =>
                console.log(`MongoDB connection failed.\nError: ${error}`)
            );

        // Dynamic presence updates
        let currentIndex = 0;

        setInterval(() => {
            const newActivity = presenceMessages[currentIndex];
            client.user.setPresence({
                activities: [{ name: newActivity, type: "PLAYING" }],
                status: "online",
            });

            currentIndex = (currentIndex + 1) % presenceMessages.length; // Cycle through messages
        }, 5 * 60 * 1000); // Updates every 5m
    },
};
