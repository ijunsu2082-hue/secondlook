# Deploying to Netlify

This needs to be done by the site owner. It has not been done from this project.

## Before you start

1. **Rotate the OpenAI key.** The old key was pasted into a chat session, so treat it as exposed. Create a new key in the OpenAI dashboard and delete the old one. Set a monthly spending limit on the new one.
2. Make sure `.env` is not committed (`git status` should not list it).

## Steps

1. In Netlify, open the site (or create one from the GitHub repo). Netlify reads `netlify.toml`: it publishes the `app` folder and runs the functions in `netlify/functions`.
2. Go to Site settings, then Environment variables. Add `OPENAI_API_KEY` with the new key. Mark it as secret if the option is shown. Optionally add `OPENAI_MODEL`.
3. Deploy (or trigger a new deploy so the variable is picked up).
4. Run the live smoke test:

   ```bash
   node tests/live-check.mjs https://your-site.netlify.app
   ```

   It checks that the page and model load, that the chat answers, that urgent words get the safety note, that bad input is refused, and that no key text appears in the page, in `chat.js`, or in a reply.
5. Open the site and click through the demo once (see SUBMISSION.md).
6. Test a failed request on the live site: in Netlify, temporarily remove `OPENAI_API_KEY`, redeploy, and send a chat message. You should see "The assistant is not set up on this server yet" and no made-up answer. Put the key back and redeploy.

## Notes

- The rate limit lives in the function's memory, so it resets when Netlify restarts the function. It slows down casual misuse only.
- On GitHub Pages the chat is not available. The page says so. Everything else works.
