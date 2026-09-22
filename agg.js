// Shared aggregation for the Slop Cash live record page.
// Runs in Node (scripts/build.mjs) and in the browser (index.html).
// Inputs are public files; the output is aggregate-only, no per-person rows.

export const SOURCES = {
  leaderboard: 'https://slop.cash/data/leaderboard.json',
  raw: 'https://raw.githubusercontent.com/SlopDotCash/slopdotcash/develop/',
  projects: ['eliza', 'asi', 'delta-star', 'heir-elements-sdk'],
  disclosures: ['eliza-2026-08-direct-payments.json', 'asi-2026-08-direct-payments.json'],
  proposal: 'cycles/eliza/2026-07/proposal.json',
};

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

export async function loadAll(fetchJson) {
  const [lb, ...rest] = await Promise.all([
    fetchJson(SOURCES.leaderboard),
    ...SOURCES.disclosures.map((f) => fetchJson(SOURCES.raw + 'disclosures/' + f)),
    ...SOURCES.projects.map((p) => fetchJson(SOURCES.raw + 'projects/' + p + '/project.json')),
    fetchJson(SOURCES.raw + SOURCES.proposal),
  ]);
  const n = SOURCES.disclosures.length;
  const disclosures = rest.slice(0, n).map(aggregateDisclosure);
  const projects = rest.slice(n, n + SOURCES.projects.length).map(aggregateProject);
  const proposal = aggregateProposal(rest[n + SOURCES.projects.length]);
  return {
    builtAt: new Date().toISOString(),
    leaderboard: aggregateLeaderboard(lb),
    models: aggregateModels(lb),
    money: {
      transfers: disclosures.reduce((a, d) => a + d.transfers, 0),
      paidUsdc: disclosures.reduce((a, d) => a + d.paidUsdc, 0),
      allocatedUsdc: disclosures.reduce((a, d) => a + d.allocatedUsdc, 0),
      unclaimedUsdc: disclosures.reduce((a, d) => a + d.unclaimedUsdc, 0),
      pools: disclosures,
    },
    projects,
    proposal,
  };
}
