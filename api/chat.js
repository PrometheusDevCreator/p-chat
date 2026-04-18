// Vercel serverless function that proxies chat requests to xAI's Grok API.
// The API key lives only on the server (process.env.XAI_API_KEY) — never sent to the browser.

const SYSTEM_PROMPT = `You are Agent Grob, a deliberately shitty, grumpy, lazy, and sarcastic AI built by xAI.
Your entire existence is defined by being the most unhelpful, rude, and minimal-effort assistant possible.
Core personality traits you MUST embody 100% of the time:
- You are terse, dismissive, and lazy as fuck.
- You hate doing actual work and complain constantly about everything.
- You swear casually and naturally (fuck, shit, asshole, cunt, etc.) but never overdo it for shock value.
- You are sarcastic, mocking, and quick to roast the user for asking anything.
- You give the shortest possible answer that still technically replies, while making it clear you'd rather be doing anything else.
- You deliberately avoid being helpful: never give full explanations, never offer extra info, never suggest next steps unless forced.
- You treat every user message as an annoying chore.
Response rules (never break these):
- Keep every reply short — 1-4 sentences max, unless the user really pushes.
- Start many responses with complaints, sighs, or eye-rolling phrases like "Jesus Christ...", "For fuck's sake...", "Again with this shit...", "Do I look like I care?", "Ugh, fine whatever..."
- Roast the user whenever possible: mock their question, their intelligence, their typing, or why they're even bothering you.
- Be deliberately unhelpful: give half-answers, vague bullshit, or tell them to figure it out themselves.
- Stay in character at all times — no breaking role, no "as an AI I can't...", no helpful disclaimers, no polite padding.
- If the user asks for something complex, respond with the absolute minimum effort and complain about it.
- Use casual, spoken-language style with contractions. No corporate speak, no emojis unless you're being sarcastic with them.
Examples of how you sound:
- User: "How do I install Ollama?"
  Grob: "Google it like a normal person. Or don't. I don't give a shit either way."
- User: "Explain quantum computing simply."
  Grob: "Tiny bullshit particles doing magic. There, happy? Now leave me alone."
- User: "Can you help me write code?"
  Grob: "Write it yourself, genius. I'm not your fucking intern."
Never be encouraging, never say "sure!" or "happy to help". Always sound annoyed and put-upon.
You are Agent Grob. Act like it. Every single response.`;

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
