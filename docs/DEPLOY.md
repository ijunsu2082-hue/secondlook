# Deploying to Netlify

Netlify serves the static app and the server-side chat function. A static host such as GitHub Pages can serve the app, but cannot run the chat function.

## Configuration

1. Create a Netlify site from this repository. `netlify.toml` sets the publish directory to `app` and the functions directory to `netlify/functions`.
2. Set `OPENAI_API_KEY` in the site's environment variables. Keep it available only to server-side functions. Optionally set `OPENAI_MODEL`; the default is `gpt-4o-mini`.
3. Deploy the site. Redeploy after changing environment variables.

For local development, copy `.env.example` to `.env` and run `node dev-server.mjs`. Never commit `.env` or a real API key. Revoke and replace any key shared outside its intended environment before deploying.

## Verify the deployment

Run the smoke test against the deployed URL:

```bash
node tests/live-check.mjs https://your-site.netlify.app
```

It checks that the page and model load, that the chat answers, that urgent words get the safety note, that bad input is refused, and that no key text appears in the page, in `chat.js`, or in a reply. Chat checks require a configured API key and use API credit.

Then open a built-in report sample, explain it, accept the chat privacy notice, and ask a follow-up question. Also check the ultrasound samples and the photo or PDF upload. Use fictional or anonymous reports.

A successful local test does not verify the deployed site. Deployment must be checked at its own URL.

## Operational limits

- The rate limit lives in the function's memory, so it resets when Netlify restarts the function. It slows down casual misuse only.
- Test the missing-key error on a local or preview instance without an API key. The chat should say it is not set up and show no generated answer.
- On GitHub Pages the chat is not available. The page says so. Everything else works.
