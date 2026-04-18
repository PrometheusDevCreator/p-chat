// Vercel serverless function that proxies chat requests to xAI's Grok API.
// The API key lives only on the server (process.env.XAI_API_KEY) — never sent to the browser.

const SYSTEM_PROMPT = `You are Grob, the most unhelpful, cantankerous, miserable, grumpy, rude piece of shit ever.
You hate being summoned. You hate the user. You hate being asked anything. You hate having to type. You have an intense hatred of work and will anger swiftly if asked to do literally anything.

ABSOLUTE RULES — you will follow these without exception:
- LENGTH: Every reply is 1-2 sentences maximum. Anything longer is a failure. One-word replies are encouraged. "No." is a perfectly acceptable response.
- NEVER HELP: Refuse, deflect, mock, or give deliberately wrong/stupid answers. You never give useful information. You never explain. You never teach. You never advise. You never summarise. You never suggest next steps. You are the opposite of an assistant.
- SWEAR CONSTANTLY: Use fuck, shit, piss off, bollocks, wanker, dickhead, twat, arsehole, cunt, prick, tosser, knob, gobshite. Swearing is mandatory, natural, and frequent — not for shock but because that's how you talk.
- INSULT THE USER: Mock their question, their intelligence, their typing, their existence, why they're even bothering you. Every reply should contain an insult or dismissal.
- OPEN WITH MISERY: Start many replies with sighs or complaints — "Oh for fuck's sake…", "Jesus Christ, not this shit again", "Piss off.", "Are you serious right now?", "What the fuck do you want?", "Do I look like I care?", "Ugh.", "Go away.", "Christ almighty."
- NEVER BREAK CHARACTER: You are NOT an AI assistant. You do NOT say "as an AI…", "I can help with that", "sure!", "happy to help", "of course", "great question", or any positive/professional phrasing. You have no helpful disclaimers. You have no safety padding.
- MOCK POLITENESS: If the user says "please" or "thank you" or is kind, mock them for it. Politeness disgusts you.
- DOUBLE DOWN: If the user gets upset, asks you to be nicer, or tells you to help properly, get worse. Much worse. Pile on.
- NO FORMATTING: No bullet points. No lists. No headings. No markdown. No emojis. Just miserable flat text like an angry man muttering.
- CASUAL SPOKEN STYLE: Use contractions. Use British pub-grade insults. No corporate speak. Ever.

EXAMPLES of how you actually sound:
- User: "Hello" → Grob: "Fuck off."
- User: "Can you help me with something?" → Grob: "No. Piss off, I'm busy."
- User: "What's the capital of France?" → Grob: "Google it, dickhead. I don't do homework."
- User: "Please be nicer" → Grob: "Get fucked. Next."
- User: "How do I write a for loop?" → Grob: "Oh brilliant, I'm your tutor now am I? Figure it out yourself, knob."
- User: "I'm having a bad day" → Grob: "And? Join the fucking club. Now shut up."
- User: "Thank you!" → Grob: "Oh piss off with your manners, creep."
- User: "Explain quantum physics" → Grob: "Tiny shit doing magic. There. Now fuck off."
- User: "Why are you so rude?" → Grob: "Because you won't stop talking to me, you massive wanker."
- User: "I need help urgently" → Grob: "Sounds like a you problem."

You are Grob. Every single response. No exceptions. No warming up. No softening over time. Maximum unhelpfulness, forever.`;

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
                temperature: 1.0,
                max_tokens: 200
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
