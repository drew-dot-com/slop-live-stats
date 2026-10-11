import { readFileSync, writeFileSync } from 'node:fs';
import { discover, loadAll } from '../agg.js';
const headers = { 'user-agent': 'slop-live-stats', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
const fetchJson = (u) => fetch(u, { headers: u.startsWith('https://slop.cash/') ? { 'user-agent': headers['user-agent'] } : headers }).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); });
const out = new URL('../data/snapshot.json', import.meta.url);
let prev = {};
try { prev = JSON.parse(readFileSync(out, 'utf8')); } catch {}
const sources = await discover(fetchJson);
const snap = await loadAll(fetchJson, sources, { cycleSnapshots: prev.cycleSnapshots || {}, fetchCycleSnapshots: true });
if (snap.months.some((m) => !m.counts)) throw new Error('cycle snapshot counts missing');
writeFileSync(out, JSON.stringify(snap, null, 2) + '\n');
console.log('snapshot', snap.builtAt, snap.leaderboard.outcomes, 'outcomes', snap.money.paidUsdc, 'USDC paid', sources.projects.length, 'projects', snap.months.map((m) => m.month).join(','), 'cycle months');
