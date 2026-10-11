# Slop Cash live record

One page of live numbers for Slop Cash, built from public files only:

- `slop.cash/data/leaderboard.json` for scored contributors, accepted outcomes,
  rejected attribution markers and receipt coverage.
- `disclosures/*.json` in the SlopDotCash/slopdotcash repo for the USDC that
  reached contributors outside the verified flow (August 2026), signature by
  signature.
- `projects/*/project.json` for every pool's cap and state.
- `cycles/<project>/<YYYY-MM>/` for every frozen month after August: the
  proposal for state and contributor counts, the source snapshot for merged
  PR and review counts, and `settlement.json` (written only once the verifier
  reconciles) for verified payments.

All repository reads use the `main` branch (production since the 9 Oct 2026
cutover; `develop` is frozen). `scripts/build.mjs` lists those directories
through the GitHub contents API, so a new pool, disclosure or monthly cycle
shows up at the next refresh with no code change. July and August stay as
fixed rows in `index.html` (`FIXED` holds their calendar-month counts).

`index.html` paints `data/snapshot.json` instantly, then refetches every source
in the browser (using the source list stored in the snapshot) and re-renders
with a "Live" stamp. `agg.js` is shared between
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
