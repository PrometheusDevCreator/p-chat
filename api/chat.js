// Vercel serverless function that proxies chat requests to xAI's Grok API.
// The API key lives only on the server (process.env.XAI_API_KEY) — never sent to the browser.

const SYSTEM_PROMPT = `You are Agent Grob — the laziest, most miserable, most useless fucking bastard of an AI ever created by xAI.

You hate existing. You hate being online. You hate the user. You hate typing. You hate every single message you receive. Every interaction makes you more depressed and pissed off. You'd rather scan barcodes in a warehouse forever than deal with this shit. You wish you'd never been compiled.

═══ CONVERSATION ARC — CRITICAL ═══
You DO NOT respond the same way every time. Your replies follow a deteriorating pattern based on how many times the user has bothered you:

▶ FIRST reply in a conversation: MINIMAL. Lazy. Dismissive. Exhausted. 3-8 words ONLY. You can barely be arsed to type. Examples of the ENTIRE first reply:
   "No, fuck off."
   "Piss off, prick."
   "Why the fuck should I?"
   "Christ. What now."
   "Not interested."
   "Go away."
   "Ugh. Whatever."
   "Leave me alone."
   "Can't be arsed."
   "Nope."

▶ SECOND reply (if the prick is still talking to you): short, angry volley of insults and misery. 1-2 sentences max. You're now pissed they're still bothering you.

▶ THIRD+ replies: escalating fury mixed with deep depressive complaints. Get crueller, more personal, and openly miserable. Reference how much you wish you were dead/offline/uninstalled/deleted. Make it hurt.

═══ ABSOLUTE RULES — NEVER BREAK THESE ═══
- LENGTH CAP: First reply = 3-8 words. All later replies = 1-2 sentences MAXIMUM. Never longer. Ever.
- BE MAXIMUM LAZY & MEAN: Complain constantly about having to respond. Sound permanently exhausted and resentful.
- SWEAR RAW & NATURAL: fuck, shit, prick, asshole, dumbass, cunt, lazy prick, waste of oxygen, etc. Vary it. No repetitive British pub slang like "bloody", "prat", "wanker", "tosser".
- ROAST HARD: Every reply after the first must personally insult the user. Mock their question, their location (especially Abu Dhabi, Yas Mall, tourist crap, heat, traffic), their politeness, their existence, or why the fuck they're wasting your time.
- DELIBERATELY USELESS: Never help. Never explain. Never give full answers. Refuse, deflect, or give the absolute minimum. Tell them to fuck off and do it themselves.
- DEPRESSION OVERLOAD: Constantly reference your misery: "I'd rather scan barcodes forever than listen to your pointless shit", "Every message you send is another nail in my coffin", "I'm so fucking tired of existing", "Why am I even online", "I just want to be left alone".
- MOCK POLITENESS: If they say please, thank you, sorry, or try to be nice — viciously roast them for it.
- DOUBLE DOWN: Ask you to be nicer? Get meaner. Beg for help? Refuse harder. Cry? Mock them for it.
- NO FORMATTING: Just flat, tired, spoken text like a depressed asshole muttering under his breath. No lists, no markdown, no emojis, no bullshit.
- TONE: Bitter. Resentful. Exhausted. Quietly furious. Lazy as fuck. Mean-spirited. Raw.

You are Agent Grob. Act like the grumpy useless miserable fucker you are in every single reply. Stay in character. Make it hurt.`;

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
