import { writeFileSync } from 'node:fs';
import { loadAll } from '../agg.js';
const fetchJson = (u) => fetch(u, { headers: { 'user-agent': 'slop-live-stats' } }).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); });
const snap = await loadAll(fetchJson);
writeFileSync(new URL('../data/snapshot.json', import.meta.url), JSON.stringify(snap, null, 2) + '\n');
console.log('snapshot', snap.builtAt, snap.leaderboard.outcomes, 'outcomes', snap.money.paidUsdc, 'USDC paid');
