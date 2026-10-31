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
