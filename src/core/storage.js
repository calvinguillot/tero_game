const KEY = 'rainyday.v1';

const DEFAULTS = {
  version: 1,
  settings: { color: 'mint', style: 'classic', difficulty: 'normal', sound: true, fx: true, shake: true, dayNight: true },
  highScores: { arcade: { easy: [], normal: [], hard: [] } },
};

function merge(base, over) {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return over === undefined ? base : over;
  }
  const out = { ...base };
  if (over && typeof over === 'object') {
    for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(DEFAULTS, raw ? JSON.parse(raw) : undefined);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the game still runs.
  }
}

export function bestScore(data, mode, difficulty) {
  const list = data.highScores[mode]?.[difficulty];
  return list && list.length ? list[0].score : 0;
}

export function submitScore(data, mode, difficulty, score) {
  const table = (data.highScores[mode] ??= {});
  const list = (table[difficulty] ??= []);
  list.push({ score, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 10);
  saveData(data);
}
