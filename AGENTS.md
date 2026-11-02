<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- AI game logic lives in src/lib/orb.server.ts (server-only) exposed via src/lib/orb.functions.ts server functions; keeps the AI key off the browser.
- Café menu, translations and order parsing live in src/lib/mazaj-menu.ts; the POS opens the game via `/?table=N&items=id1,id2&lang=ar|fr|en` (items match by id or FR/EN/AR name) so the offline POS needs no network link to the game.
- AI calls go straight to Google Gemini with the owner's GEMINI_API_KEY (no Lovable gateway) and fall back across the model list in orb.server.ts; owner wants zero Lovable credit use.
- Play access is a timed pass in the QR (`ts` unix seconds + `ttl` minutes), checked in src/lib/session.ts on both the page and the server functions; the POS waiter app (mazaj-cafe-flow, src/components/GameQR.tsx) mints it.
