# Near-live visit counter

This Worker keeps the GoatCounter API token off the public site and exposes only
the current pageview total. Successful responses are cached at the edge for one
minute. The footer polls it once a minute while the page is visible and also
refreshes when the tab regains focus.

## One-time setup

1. In GoatCounter, open **Settings → API**, create an API token, and copy it.
2. Authenticate Wrangler with `pnpm exec wrangler login`.
3. Store the token without putting it in source control:

   ```sh
   pnpm exec wrangler secret put GOATCOUNTER_API_TOKEN --config workers/visits/wrangler.jsonc
   ```

4. Deploy the Worker:

   ```sh
   pnpm visits:deploy
   ```

5. Copy the resulting `https://oogabooga-visits.<account>.workers.dev/` URL into
   the bedrock repository's **Settings → Secrets and variables → Actions →
   Variables** as `VISITS_API_URL`.
6. Run the **Deploy to GitHub Pages** workflow, or wait for its next scheduled
   run. Astro reads that repository variable at build time.

For local site development, copy `.env.example` to `.env` and replace its URL.
For local Worker development, create `workers/visits/.dev.vars` containing
`GOATCOUNTER_API_TOKEN=...`; this file is ignored by Git.

## Commands

- `pnpm visits:test` tests response validation, caching, and error handling.
- `pnpm visits:dev` runs the Worker locally.
- `pnpm visits:deploy` deploys it to Cloudflare Workers.
