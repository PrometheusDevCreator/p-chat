# P-CHAT

A deliberately unhelpful chatbot ("Agent Grob") with Prometheus Dark styling.
Single-page web app + one Vercel serverless function that talks to xAI's Grok API.

## Files

- `index.html` — the entire frontend (UI, chat logic, persistence via localStorage)
- `api/chat.js` — Vercel serverless function. Holds your xAI API key. Adds the Grob system prompt and forwards messages to Grok.
- `package.json` — minimal, just declares Node 18+ and ES modules.

The API key never touches the browser — it stays as a server-side environment variable on Vercel.

---

## Deploy in 4 steps

### 1. Get an xAI API key

You said you already have a Grok account. Go to <https://console.x.ai>, create an API key, copy it. It looks like `xai-...`.

### 2. Push this folder to a Git repo

The fastest way:

```bash
cd p-chat
git init
git add .
git commit -m "P-CHAT initial"
gh repo create p-chat --private --source=. --push
```

(Or create the repo manually on GitHub and push.)

### 3. Import into Vercel

- Go to <https://vercel.com/new>
- Pick the `p-chat` repo
- **Framework preset: Other** (Vercel will auto-detect the static `index.html` and the `api/` folder — no build step needed)
- Before clicking Deploy, expand **Environment Variables** and add:
  - **Name:** `XAI_API_KEY`
  - **Value:** your `xai-...` key
- (Optional) `XAI_MODEL` — defaults to `grok-3`. Change to `grok-4`, `grok-beta`, etc. if you prefer.
- Click **Deploy**.

### 4. Share the URL

Once deployed you'll get something like `https://p-chat-xxxxx.vercel.app`. Send that to your partner. Done.

---

## Local testing (optional)

```bash
npm i -g vercel
vercel dev
# add XAI_API_KEY when prompted, or in a .env.local file
```

Then open http://localhost:3000.

---

## Notes & tweaks

- **Conversation history** is kept in the browser via `localStorage` (key: `p-chat-history-v1`) so refreshes don't wipe it. Each user (you / your partner) has their own separate history because it's per-browser.
- **Last 20 messages** are sent as context on each request — enough memory for a flowing chat without burning tokens.
- **Token cap** per response is 300 — Grob is supposed to be terse, and this keeps your bill tiny.
- **Cost:** Grok-3 input ~$3/M tokens, output ~$15/M tokens (check current pricing). A typical comedy chat session will cost cents.
- **Want to limit who can use it?** Add a hardcoded password check in `api/chat.js`, or restrict by setting `XAI_API_KEY` to a key with a low monthly spend cap on the xAI dashboard.
- **Want streaming responses?** Currently non-streaming for simplicity. The replies are short so it feels fast enough.

---

## Customising

- **Change the persona:** edit `SYSTEM_PROMPT` at the top of `api/chat.js`, redeploy.
- **Change colours/fonts:** edit the `:root` CSS variables in `index.html`.
- **Change the model:** set the `XAI_MODEL` env var on Vercel.
