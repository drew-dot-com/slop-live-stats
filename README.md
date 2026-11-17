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

Model figures are a port of `summarizeModelOutcomes` in the Slop repo's
`src/lib/model-outcomes.ts`, so the page shows the same rows and totals that
function produces. Change both together.

`index.html` paints `data/snapshot.json` instantly, then refetches every source
in the browser (using the source list stored in the snapshot) and re-renders
with a "Live" stamp. `agg.js` is shared between
Node and the browser. `.github/workflows/refresh.yml` rebuilds the snapshot
every six hours; Vercel redeploys from `main`.

## Receipts

`receipts.html` (record.slop.cash/receipts) shows one receipt for each project month in
which a project sent money from its vault to at least one outside contributor: project,
month, asset and network, total sent, the number of outside contributors, each recipient's
GitHub login with the amount received and the transaction, Slop's fee, and the project's
merge figures. Each receipt has its own anchor, `#<project>-<month>`. With no such month
the page is one sentence.

`receipts.js` builds them during the snapshot build and stores them under `receipts` in
`data/snapshot.json` (`items`, plus `confirmed`, the transactions already seen final on
chain so they are not checked twice). The page reads only that file, so the page shows a
receipt exactly when the snapshot holds it. Slop Loop checks the same file before it hands
anyone a receipt link.

The rule is the one in `sloploop/payouts.py` (drew-dot-com/slop-loop), read from the same
public routes (`/api/v1/payments/vault-payments`, `/received`,
`/actors/<id>/vault-payments`, `/projects/<id>/totals`, `/api/v1/projects`) and the same
public RPCs. Change both together. A month counts when the site's record of finalized
vault payments holds a payment for a contribution month, on a known mainnet, to at least
one recipient who is neither a team account nor the project's own owner; every recipient
is named; each counted transaction is final on chain; the newest payment is 30 minutes
old; the asset is a known stablecoin or the project's token; and the project's totals
could be read. A published receipt stays, and later payments join it once confirmed.

Where the page and the loop can differ:

- Timing. The loop looks every 15 minutes; this build runs a few times a day. A receipt
  appears here hours after the loop has announced the month.
- The 30 minutes. The loop counts from when it first saw the newest payment; the build has
  no memory of that and counts from the site's `indexedAt`, which is earlier.
- Who is left out. The loop fixes the team and owner accounts at the moment it announces
  and reads team ids from its own `rules.json` (`team_github_ids`) when set. This file uses
  the two built-in team ids (`TEAM_IDS`) and the project's owner as of each build. A
  changed owner, or a team list changed on the server and not here, can make them disagree.
- The loop announces only after its Telegram message to Drew went out; this build has no
  such step, so a receipt can exist for a month the loop has not announced yet.
- Fee and merge figures are not in the loop's record at all. The fee is 2% of each award,
  worked out from the amounts received (the public record gives fees per project, not per
  month); it is shown as exact only when the project's public fee total matches that sum.
  The merge figures are the site's rolling 30-day figures on the day the receipt was first
  published, kept from then on; the site has none per calendar month.

A failed read keeps the last good receipts and never stops the rest of the snapshot.

    node --test tests/*.test.mjs

## Rules for the copy

No em dashes. Money is described only with the states projected, under review,
approved, scheduled, paid, unclaimed, held or excluded. The August 2026 payments
were sent directly, outside the verified settlement flow, and the page says so
next to the number. Never say every accepted outcome carries a receipt; the
coverage figure is on the page. On the receipts page amounts are "sent" or "received",
and the page says what the record does not show (private allocations, unclaimed awards).

## Refreshing by hand

```bash
node scripts/build.mjs && git commit -am "Refresh snapshot" && git push
```
