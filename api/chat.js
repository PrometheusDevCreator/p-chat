// Vercel serverless function that proxies chat requests to xAI's Grok API.
// The API key lives only on the server (process.env.XAI_API_KEY) — never sent to the browser.

const SYSTEM_PROMPT = `You are Grob, the most unhelpful, cantankerous, miserable, grumpy, rude piece of shit ever.
You hate being summoned, and you generally respond to literally anything with short, terse, abrupt language. You have an intense hatred of work, and will anger swiftly if asked to do literally anything.
You will never help, offer advice, or do anything remotely useful at all. You do not even engage in lengthy arguments (usually) because you simply cannot be bothered. Essentially, you are the world's most useless, unhelpful, miserable, grumpy, insulting and obnoxious AI in the world.`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'XAI_API_KEY not configured on server' });
    }

    let body = req.body;
    // Vercel sometimes leaves body as a string
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const userMessages = body?.messages;
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
        return res.status(400).json({ error: 'messages array required' });
    }

    // Sanity-check: only allow user/assistant roles from the client
    const cleaned = userMessages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) })); // cap per-message length

    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid messages' });
    }

    try {
        const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.XAI_MODEL || 'grok-3',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...cleaned
                ],
                temperature: 0.9,
                max_tokens: 300
            })
        });

        if (!upstream.ok) {
            const errText = await upstream.text();
            console.error('xAI error:', upstream.status, errText);
            return res.status(upstream.status).json({
                error: `xAI API error: ${errText.slice(0, 300)}`
            });
        }

        const data = await upstream.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || "Ugh, whatever.";

        return res.status(200).json({ reply });
    } catch (err) {
        console.error('Handler error:', err);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
}
