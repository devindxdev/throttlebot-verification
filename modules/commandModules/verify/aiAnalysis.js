const OpenAI = require('openai');

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile) => {
    try {
        // Validate required inputs
        if (!vehicleAttachment || !vehicleAttachment.url) {
            throw new Error("Invalid vehicle attachment provided.");
        }
        if (!vehicleName) {
            throw new Error("Vehicle name is required.");
        }

        // Resolve fetch (prefer native, fall back to node-fetch for older runtimes)
        const fetchFn = globalThis.fetch || (await import('node-fetch')).default;

        // Initialize OpenAI client (prefer OPENAI_API_KEY but fall back to API_KEY for compatibility)
        const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            throw new Error('Missing OPENAI_API_KEY in environment.');
        }
        const client = new OpenAI({ apiKey });

        // Download image data and convert it to base64
        const imageBuffer = await fetchFn(vehicleAttachment.url).then((res) => res.arrayBuffer());
        const base64Image = Buffer.from(imageBuffer).toString("base64");

        // Prepare the prompt
        const prompt = `
You are validating a vehicle verification photo for AI verification. Respond ONLY with a single JSON object and no extra text.
Required in the image:
- Handwritten note with Username: "${interaction.user.tag}"
- Handwritten note with Server: "${interaction.guild.name}"
- Vehicle and keys visible.

Return JSON with these keys:
{
  "requirementsMet": true/false,        // true only if ALL required items are present
  "vehicleMatch": true/false,           // whether "${vehicleName}" matches the vehicle shown
  "issues": ["..."],                    // list of problems (empty if none)
  "feedback": "...",                    // concise guidance
  "confidence": 0-100,                  // overall confidence score
  "estimatedValueUSD": <number>,        // estimated market value in USD (numeric)
  "estimatedValueConfidence": 0-100     // confidence in the value estimate
}
`;

        // Call OpenAI Vision (gpt-4o chosen for strong image reasoning)
        const result = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a strict vehicle verification assistant. Respond ONLY with valid JSON.',
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${vehicleAttachment.contentType || 'image/jpeg'};base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
        });

        // Parse the AI's JSON response (tolerate code fences)
        const content = result?.choices?.[0]?.message?.content || '';
        const cleaned = stripCodeFences(content);
        const analysisResult = JSON.parse(cleaned);
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

// Removes Markdown code fences (e.g., ```json ... ```) and trims whitespace.
function stripCodeFences(text = '') {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
        // Remove the opening fence with optional language and the closing fence
        return trimmed.replace(/^```[\w-]*\s*/i, '').replace(/```$/i, '').trim();
    }
    return trimmed;
}
