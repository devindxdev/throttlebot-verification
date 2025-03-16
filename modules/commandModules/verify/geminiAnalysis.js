const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch'); // Ensure this is installed and used properly

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile) => {
    try {
        // Validate required inputs
        if (!vehicleAttachment || !vehicleAttachment.url) {
            throw new Error("Invalid vehicle attachment provided.");
        }
        if (!vehicleName) {
            throw new Error("Vehicle name is required.");
        }

        // Initialize Google Generative AI SDK
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' });

        // Download image data and convert it to base64
        const imageBuffer = await fetch(vehicleAttachment.url).then((res) => res.arrayBuffer());
        const base64Image = Buffer.from(imageBuffer).toString("base64");

        // Prepare the prompt
        const prompt = `
            Analyze the following image and provide a JSON response.
            Ensure the image includes:
            - A handwritten note with:
                - Username: "${interaction.user.tag}"
                - Server Name: "${interaction.guild.id}"
            - The user's vehicle and keys in the picture.
            Verify the following:
            - The handwritten note matches the requirements.
            - The provided vehicle name ("${vehicleName}") matches the vehicle in the image.

            Respond in JSON format with the keys:
            {
                "requirementsMet": <true/false>,
                "issues": [<list of issues>],
                "vehicleMatch": <true/false>,
                "feedback": <detailed feedback>,
                "confidence": <confidence percentage>
            }
        `;

        // Send the image and prompt for analysis
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Image,
                    mimeType: vehicleAttachment.contentType || "image/jpeg",
                },
            },
            prompt,
        ]);

        // Parse the AI's JSON response
        const analysisResult = JSON.parse(result.response.text());
        console.log("Analysis Result:", analysisResult);

        // Return the analysis result
        return {
            success: true,
            analysis: analysisResult,
        };
    } catch (error) {
        console.error("Error processing vehicle verification:", error);

        // Return the error for further handling
        return {
            success: false,
            error: error.message || "An unexpected error occurred.",
        };
    }
};
