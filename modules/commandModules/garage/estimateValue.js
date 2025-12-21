const OpenAI = require('openai');

async function estimateVehicleValue({ vehicleName, imageUrl, imageContentType }) {
    if (!vehicleName) {
        throw new Error('Vehicle name is required for value estimation.');
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error('Missing OPENAI_API_KEY in environment.');
    }

    const client = new OpenAI({ apiKey });
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;

    let imagePayload = null;
    if (imageUrl) {
        try {
            const res = await fetchFn(imageUrl);
            const contentType = res.headers.get('content-type') || imageContentType || '';
            const normalized = contentType.toLowerCase();
            const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
            if (allowed.includes(normalized)) {
                const imageBuffer = await res.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                imagePayload = {
                    type: 'image_url',
                    image_url: {
                        url: `data:${normalized};base64,${base64Image}`,
                    },
                };
            }
        } catch (error) {
            console.warn('Vehicle value image fetch failed, falling back to name-only:', error.message);
        }
    }

    const prompt = `
You estimate market value for vehicles. Respond ONLY with JSON and no extra text.
Use the vehicle name and image (if provided) to estimate value.
Return JSON with:
{
  "estimatedValueUSD": <number>,  // numeric USD estimate
  "confidence": 0-100             // confidence in the estimate
}
Vehicle name: "${vehicleName}"
`;

    const messages = [
        {
            role: 'system',
            content: 'You are a precise vehicle pricing assistant. Respond ONLY with valid JSON.',
        },
        {
            role: 'user',
            content: imagePayload ? [{ type: 'text', text: prompt }, imagePayload] : prompt,
        },
    ];

    const result = await client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
    });

    const content = result?.choices?.[0]?.message?.content || '';
    const cleaned = stripCodeFences(content);
    const parsed = JSON.parse(cleaned);

    const estimatedValueUSD = Number(parsed?.estimatedValueUSD);
    const confidence = Number(parsed?.confidence);

    if (!Number.isFinite(estimatedValueUSD)) {
        throw new Error('AI response missing estimatedValueUSD.');
    }

    return {
        estimatedValueUSD,
        confidence: Number.isFinite(confidence) ? confidence : null,
    };
}

function stripCodeFences(text = '') {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/^```[\w-]*\s*/i, '').replace(/```$/i, '').trim();
    }
    return trimmed;
}

module.exports = { estimateVehicleValue };
