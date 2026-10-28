const KEY = 'rainyday.v1';

const DEFAULTS = {
  version: 1,
  // story: chapters unlocked, hearts per chapter, records per chapter
  // ({ time: fastest finish in seconds, closes: most CLOSE! }, finished runs
  // only), and whether the ending has been seen (it unlocks Walk Together).
  story: { unlocked: 1, stars: [], records: [], done: false },
  settings: { together: true, mode: 'arcade', color: 'mint', style: 'classic', difficulty: 'normal', initials: 'AAA', sound: true, music: true, rain: true, fx: true, shake: true, flash: true, dayNight: true },
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

// Settings' "RESET STORY": back to chapter 1, no hearts or records, the ending
// unseen (so Walk Together locks again). Arcade scores and settings stay.
export function resetStory(data) {
  data.story = structuredClone(DEFAULTS.story);
  saveData(data);
}

// Settings' "RESET ALL DATA": everything back to defaults. The objects are
// refilled in place, because the game and the audio hold on to them.
export function resetAll(data) {
  const fresh = structuredClone(DEFAULTS);
  for (const k of Object.keys(data.settings)) delete data.settings[k];
  Object.assign(data.settings, fresh.settings);
  data.story = fresh.story;
  data.highScores = fresh.highScores;
  saveData(data);
}

export function bestScore(data, mode, difficulty) {
  const list = data.highScores[mode]?.[difficulty];
  return list && list.length ? list[0].score : 0;
}

const TABLE_SIZE = 10;

// 1-based place this score would take in the table, or 0 if it doesn't make it.
export function scoreRank(data, mode, difficulty, score) {
  if (score <= 0) return 0;
  const list = data.highScores[mode]?.[difficulty] ?? [];
  const i = list.findIndex((e) => score > e.score);
  if (i >= 0) return i + 1;
  return list.length < TABLE_SIZE ? list.length + 1 : 0;
}

// `extra` holds run stats kept with the entry (e.g. { closes }).
export function submitScore(data, mode, difficulty, score, name = '', extra = {}) {
  const table = (data.highScores[mode] ??= {});
  const list = (table[difficulty] ??= []);
  list.push({ score, name, ...extra, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, TABLE_SIZE);
  saveData(data);
}
