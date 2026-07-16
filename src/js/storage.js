// localStorage-backed progress & statistics: games played, wins, and per
// size+difficulty personal bests. Cheat-assisted wins are counted separately
// and never become a personal best.

const KEY = 'tango.stats';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore quota */ }
}

export const bestKey = (n, difficulty) => `${n}-${difficulty}`;

export function getStats() {
  const s = read();
  return {
    games: s.games || 0,
    wins: s.wins || 0,
    cheatedWins: s.cheatedWins || 0,
    bests: s.bests || {},
  };
}

export function recordGameStarted() {
  const s = read();
  s.games = (s.games || 0) + 1;
  write(s);
}

/**
 * Record a win. Returns { best } — true if this set a new personal best.
 * @param {{n:number, difficulty:string, timeMs:number, moves:number, cheated:boolean}} w
 */
export function recordWin({ n, difficulty, timeMs, moves, cheated }) {
  const s = read();
  s.wins = (s.wins || 0) + 1;
  if (cheated) {
    s.cheatedWins = (s.cheatedWins || 0) + 1;
    write(s);
    return { best: false };
  }
  s.bests = s.bests || {};
  const k = bestKey(n, difficulty);
  const prev = s.bests[k];
  let best = false;
  if (!prev || timeMs < prev.timeMs) { s.bests[k] = { timeMs, moves }; best = true; }
  write(s);
  return { best };
}
