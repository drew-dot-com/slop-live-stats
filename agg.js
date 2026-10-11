// Shared aggregation for the Slop Cash live record page.
// Runs in Node (scripts/build.mjs) and in the browser (index.html).
// Inputs are public files; the output is aggregate-only, no per-person rows.

// Production is `main` since the 9 Oct 2026 cutover; `develop` is frozen.
export const REPO = 'SlopDotCash/slopdotcash';
export const BRANCH = 'main';
export const SOURCES = {
  leaderboard: 'https://slop.cash/data/leaderboard.json',
  raw: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`,
  api: `https://api.github.com/repos/${REPO}/contents/`,
  // The first frozen proposal, kept as a fixed reference line under Pools.
  proposal: 'cycles/eliza/2026-07/proposal.json',
};
// Months shown as fixed rows in index.html (July from its cycle file, August
// from funding/preparations). Every later cycle directory becomes a row here.
export const HISTORICAL_MONTHS = ['2026-07', '2026-08'];
export const CYCLE_FILES = ['proposal.json', 'allocation.json', 'execution-plan.json', 'transactions.json', 'settlement.json', 'windup.json'];

const usdc = (minor) => Number(BigInt(minor)) / 1e6;

const PROVIDER_ALIASES = { 'openai-codex': 'openai', 'z.ai': 'zai', 'z-ai': 'zai', 'moonshot-ai': 'moonshotai', 'spacexai': 'xai', 'x-ai': 'xai' };
function modelKey(a) {
  const p0 = String(a.provider || '').trim().toLowerCase();
  const provider = PROVIDER_ALIASES[p0] || p0;
  let model = String(a.model || '').trim().toLowerCase();
  for (const pre of [provider + '/', 'openai/', 'anthropic/', 'xai/', 'google/']) if (model.startsWith(pre)) model = model.slice(pre.length);
  return provider + '/' + model;
}

export function aggregateModels(lb) {
  const A = lb.attributions || [];
  const by = {};
  let signed = 0;
  for (const a of A) {
    const k = modelKey(a);
    by[k] = by[k] || { key: k, declarations: 0, signed: 0 };
    by[k].declarations++;
    if (a.run) { by[k].signed++; signed++; }
  }
  const list = Object.values(by).sort((x, y) => y.declarations - x.declarations);
  return { declarations: A.length, signed, distinctModels: list.length, top: list.slice(0, 6) };
}

export function aggregateLeaderboard(lb) {
  const cats = {};
  for (const e of lb.ledger) cats[e.category] = (cats[e.category] || 0) + 1;
  const cov = lb.attributionCoverage || {};
  return {
    generatedAt: lb.generatedAt,
    ruleVersion: lb.ruleVersion,
    window: lb.window,
    repositories: lb.repositories.map((r) => ({ id: r.id, displayName: r.displayName, url: r.githubUrl, projectId: r.projectId })),
    contributors: lb.leaders.length,
    outcomes: lb.ledger.length,
    mergedPullRequests: cats['merged-pull-request'] || 0,
    substantiveReviews: cats['substantive-review'] || 0,
    evaluatedContributions: cats['evaluated-contribution'] || 0,
    invalidMarkers: (lb.invalidAttributionMarkers || []).length,
    modelDeclarations: (lb.attributions || []).length,
    receiptCoverage: cov.eligibleSourceCount ? { valid: cov.validSourceCount, eligible: cov.eligibleSourceCount } : null,
    openPullRequests: lb.source?.counts?.openPullRequests ?? null,
  };
}

export function aggregateDisclosure(d) {
  const by = d.totals.byState || {};
  const paidRows = d.rows.filter((r) => r.state === 'paid-direct' && r.observed);
  const times = paidRows.map((r) => r.observed.blockTime).sort();
  return {
    projectId: d.projectId,
    month: d.contributionMonth,
    status: d.status,
    network: d.network,
    asset: d.asset,
    capUsdc: usdc(d.reconstructedBasis.capMinor),
    allocatedUsdc: usdc(d.totals.allocatedMinor),
    paidUsdc: usdc(d.totals.observedAmountMinor),
    transfers: d.totals.observedTransfers,
    rows: d.totals.rows,
    paidRows: by['paid-direct']?.rows || 0,
    unclaimedRows: by['unclaimed']?.rows || 0,
    unclaimedUsdc: by['unclaimed'] ? usdc(by['unclaimed'].amountMinor) : 0,
    heldRows: by['held-below-minimum']?.rows || 0,
    heldUsdc: by['held-below-minimum'] ? usdc(by['held-below-minimum'].amountMinor) : 0,
    unmatched: d.totals.unmatchedObservedTransfers,
    platformFee: d.totals.platformFeeTransfer,
    firstAt: times[0] || null,
    lastAt: times[times.length - 1] || null,
    exampleSignature: paidRows[0]?.observed?.signature || null,
  };
}

// Proposal-level facts the page needs for a cycle row. The state label is
// computed at render time so "under review" turns into "review closed" on its
// own without waiting for a rebuild.
export function aggregateCycle(projectId, month, files, docs) {
  const pr = docs['proposal.json'];
  const st = docs['settlement.json'];
  const out = {
    projectId, month, files,
    kind: pr.kind,
    status: pr.status,
    generatedAt: pr.generatedAt,
    approvedAt: pr.approvedAt ?? null,
    reviewEndsAt: pr.review?.endsAt || null,
    capUsdc: pr.capMinor ? usdc(pr.capMinor) : null,
    sourceSnapshotSha256: pr.sourceSnapshotSha256,
    contributors: (pr.allocations || []).length,
    actors: (pr.allocations || []).map((a) => a.actor?.id || a.actor?.login).filter(Boolean),
    settlement: null,
  };
  if (st && st.status === 'paid') {
    const paid = (st.recipients || []).filter((r) => BigInt(r.paidMinor || '0') > 0n);
    out.settlement = {
      settledAt: st.settledAt,
      chain: st.chain,
      paidUsdc: paid.reduce((a, r) => a + usdc(r.paidMinor), 0),
      transfers: paid.length,
    };
  }
  return out;
}

// Ledger counts for a frozen source snapshot: whole 35-day window, plus the
// calendar month alone so months can be summed without double counting.
export function aggregateCycleSnapshot(snap, month) {
  const cnt = (cat, inMonth) => snap.ledger.filter((e) => e.category === cat && (!inMonth || String(e.occurredAt).startsWith(month))).length;
  return {
    merged: cnt('merged-pull-request'),
    reviews: cnt('substantive-review'),
    calendarMerged: cnt('merged-pull-request', true),
    calendarReviews: cnt('substantive-review', true),
  };
}

export function aggregateProject(p) {
  const r = p.reward || {};
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    kind: r.kind,
    capDisplay: r.monthlyCapDisplay || null,
    chain: r.chain || null,
    paymentMode: r.paymentMode || null,
    fundingState: r.fundingState || null,
    committedMinor: r.committedMinor ?? null,
    feeBasisPoints: r.feeBasisPoints ?? null,
    authority: p.authority?.state || null,
    repository: p.links?.repository || null,
    prize: p.links?.prize || null,
  };
}

export function aggregateProposal(pr) {
  return {
    projectId: pr.projectId,
    cycleId: pr.cycleId,
    status: pr.status,
    allocations: pr.allocations.length,
    capUsdc: usdc(pr.capMinor),
    suggestedUsdc: usdc(pr.totals.suggestedMinor),
    approvedUsdc: usdc(pr.totals.approvedMinor),
    generatedAt: pr.generatedAt,
    reviewEndsAt: pr.review?.endsAt || null,
    approvedAt: pr.approvedAt,
  };
}

// One row per contribution month. Counts come from the frozen source
// snapshots (deduplicated, since pools of one month share a snapshot); the
// unique contributor count is computed here so no account ids leave the build.
export function aggregateMonths(cycles, snaps) {
  const byMonth = {};
  for (const c of cycles) (byMonth[c.month] ||= []).push(c);
  return Object.keys(byMonth).sort().map((month) => {
    const all = byMonth[month];
    const pools = all.filter((c) => c.kind === 'reward-allocation');
    const counts = { merged: 0, reviews: 0, calendarMerged: 0, calendarReviews: 0 };
    let complete = true;
    for (const key of new Set(all.map((c) => c.sourceSnapshotSha256))) {
      if (!snaps[key]) { complete = false; continue; }
      for (const k of Object.keys(counts)) counts[k] += snaps[key][k];
    }
    return {
      month,
      counts: complete ? counts : null,
      uniqueContributors: new Set(pools.flatMap((c) => c.actors)).size,
      pools: pools.map(({ actors, sourceSnapshotSha256, kind, ...c }) => c),
    };
  });
}

// Lists the repository directories the page reads, so new pools, disclosures
// and monthly cycles appear without a code change. Node only (the scheduled
// build); the browser reuses the list stored in the snapshot.
export async function discover(fetchJson) {
  const ls = (path) => fetchJson(`${SOURCES.api}${path}?ref=${BRANCH}`);
  const dirs = (xs) => xs.filter((x) => x.type === 'dir').map((x) => x.name).sort();
  const projects = dirs(await ls('projects'));
  const disclosures = (await ls('disclosures')).filter((x) => x.type === 'file' && x.name.endsWith('.json')).map((x) => x.name).sort();
  const cycles = [];
  for (const projectId of dirs(await ls('cycles'))) {
    for (const month of dirs(await ls(`cycles/${projectId}`))) {
      if (!/^\d{4}-\d{2}$/.test(month) || HISTORICAL_MONTHS.includes(month)) continue;
      const names = new Set((await ls(`cycles/${projectId}/${month}`)).map((x) => x.name));
      if (!names.has('proposal.json')) continue;
      cycles.push({ projectId, month, files: CYCLE_FILES.filter((f) => names.has(f)) });
    }
  }
  return { projects, disclosures, cycles };
}

// Fetches and aggregates everything the page shows. `sources` comes from
// discover() in the build, or from the last snapshot in the browser.
// `cycleSnapshots` maps sourceSnapshotSha256 to counts already computed (the
// snapshots are frozen and large, so the build reuses earlier counts and the
// browser never downloads them).
export async function loadAll(fetchJson, sources, { cycleSnapshots = {}, fetchCycleSnapshots = false } = {}) {
  const raw = (path) => fetchJson(SOURCES.raw + path);
  const [lb, disclosureDocs, projectDocs, proposalDoc, cycleDocs] = await Promise.all([
    fetchJson(SOURCES.leaderboard),
    Promise.all(sources.disclosures.map((f) => raw('disclosures/' + f))),
    Promise.all(sources.projects.map((p) => raw(`projects/${p}/project.json`))),
    raw(SOURCES.proposal),
    Promise.all(sources.cycles.map(async (c) => {
      const docs = {};
      for (const f of c.files) if (f === 'proposal.json' || f === 'settlement.json') docs[f] = await raw(`cycles/${c.projectId}/${c.month}/${f}`);
      return aggregateCycle(c.projectId, c.month, c.files, docs);
    })),
  ]);
  const disclosures = disclosureDocs.map((d, i) => ({ ...aggregateDisclosure(d), file: sources.disclosures[i] }));
  const order = { active: 0, paused: 1 };
  const projects = projectDocs.map(aggregateProject)
    .sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2) || a.name.localeCompare(b.name));

  const snaps = { ...cycleSnapshots };
  if (fetchCycleSnapshots) {
    for (const c of cycleDocs) {
      const key = c.sourceSnapshotSha256;
      if (!key || snaps[key]) continue;
      snaps[key] = aggregateCycleSnapshot(await raw(`cycles/${c.projectId}/${c.month}/source-snapshot.json`), c.month);
    }
  }
  const usedSnaps = Object.fromEntries(cycleDocs.map((c) => c.sourceSnapshotSha256).filter((k) => snaps[k]).map((k) => [k, snaps[k]]));

  const settled = cycleDocs.filter((c) => c.settlement);
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
  return {
    builtAt: new Date().toISOString(),
    sources,
    leaderboard: aggregateLeaderboard(lb),
    models: aggregateModels(lb),
    money: {
      transfers: sum(disclosures, (d) => d.transfers) + sum(settled, (c) => c.settlement.transfers),
      paidUsdc: sum(disclosures, (d) => d.paidUsdc) + sum(settled, (c) => c.settlement.paidUsdc),
      allocatedUsdc: sum(disclosures, (d) => d.allocatedUsdc),
      unclaimedUsdc: sum(disclosures, (d) => d.unclaimedUsdc),
      platformFeeCollected: disclosures.some((d) => d.platformFee),
      pools: disclosures,
      settlements: settled.map((c) => ({ projectId: c.projectId, month: c.month, capUsdc: c.capUsdc, ...c.settlement })),
    },
    months: aggregateMonths(cycleDocs, usedSnaps),
    cycleSnapshots: usedSnaps,
    projects,
    proposal: aggregateProposal(proposalDoc),
  };
}
