# Slop Cash live record

One page of live numbers for Slop Cash, built from public files only:

- `slop.cash/data/leaderboard.json` for scored contributors, accepted outcomes,
  rejected attribution markers and receipt coverage.
- `disclosures/*-2026-08-direct-payments.json` in the SlopDotCash/slopdotcash
  repo for the USDC that has reached contributors, signature by signature.
- `projects/*/project.json` for each pool's cap and state.
- `cycles/eliza/2026-07/proposal.json` for the first frozen proposal.

`index.html` paints `data/snapshot.json` instantly, then refetches every source
in the browser and re-renders with a "Live" stamp. `agg.js` is shared between
Node and the browser. `.github/workflows/refresh.yml` rebuilds the snapshot
every six hours; Vercel redeploys from `main`.

## Rules for the copy

No em dashes. Money is described only with the states projected, under review,
approved, scheduled, paid, unclaimed, held or excluded. The August 2026 payments
were sent directly, outside the verified settlement flow, and the page says so
next to the number. Never say every accepted outcome carries a receipt; the
coverage figure is on the page.

## Refreshing by hand

```bash
node scripts/build.mjs && git commit -am "Refresh snapshot" && git push
```
