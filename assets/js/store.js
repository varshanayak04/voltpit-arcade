/**
 * store.js — small persistence layer.
 *
 * Wraps localStorage in a try/catch and falls back to an in-memory map, so the
 * page still works in private windows, in sandboxed frames, and anywhere
 * storage is blocked. Nothing here throws.
 */

const KEY = "voltpit.v1";

const memory = new Map();

let backing = null;

function probe() {
  if (backing !== null) return backing;
  try {
    const k = "__voltpit_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    backing = window.localStorage;
  } catch {
    backing = false;
  }
  return backing;
}

function readRaw() {
  const store = probe();
  try {
    const raw = store ? store.getItem(KEY) : memory.get(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeRaw(obj) {
  const store = probe();
  const raw = JSON.stringify(obj);
  try {
    if (store) store.setItem(KEY, raw);
    else memory.set(KEY, raw);
  } catch {
    memory.set(KEY, raw);
  }
}

let state = readRaw();

export function get(path, fallback) {
  return path in state ? state[path] : fallback;
}

export function set(path, value) {
  state[path] = value;
  writeRaw(state);
}

/** True when scores really will survive a reload. */
export function isPersistent() {
  return Boolean(probe());
}

/* ---------------------------------------------------------------- scores */

const MAX_ROWS = 5;

/**
 * @param {string} id       cabinet id
 * @returns {Array<{who:string, score:number, at:number}>} best first
 */
export function scores(id) {
  const all = get("scores", {});
  return Array.isArray(all[id]) ? all[id] : [];
}

/**
 * Records a score if it makes the top five.
 * `lowerIsBetter` is for Reflex Gate, where the score is a reaction time.
 * @returns {number} 1-based placement, or 0 if it did not make the board
 */
export function submitScore(id, score, who, lowerIsBetter = false) {
  if (!Number.isFinite(score)) return 0;
  const all = get("scores", {});
  const rows = Array.isArray(all[id]) ? all[id].slice() : [];
  rows.push({ who: normalizeInitials(who), score, at: Date.now() });
  rows.sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score));
  const trimmed = rows.slice(0, MAX_ROWS);
  all[id] = trimmed;
  set("scores", all);
  const place = trimmed.findIndex((r) => r.score === score && r.who === normalizeInitials(who));
  return place === -1 ? 0 : place + 1;
}

export function best(id, lowerIsBetter = false) {
  const rows = scores(id);
  if (!rows.length) return null;
  return lowerIsBetter
    ? rows.reduce((a, b) => (b.score < a.score ? b : a)).score
    : rows.reduce((a, b) => (b.score > a.score ? b : a)).score;
}

/** Would this score reach the board? Used to decide whether to ask for initials. */
export function wouldPlace(id, score, lowerIsBetter = false) {
  if (!Number.isFinite(score) || score <= 0) return false;
  const rows = scores(id);
  if (rows.length < MAX_ROWS) return true;
  const worst = lowerIsBetter
    ? Math.max(...rows.map((r) => r.score))
    : Math.min(...rows.map((r) => r.score));
  return lowerIsBetter ? score < worst : score > worst;
}

export function wipeScores() {
  set("scores", {});
}

export function normalizeInitials(who) {
  const s = String(who || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
  return s || "AAA";
}

/* -------------------------------------------------------------- settings */

export const settings = {
  get sound() {
    return get("sound", true);
  },
  set sound(v) {
    set("sound", Boolean(v));
  },
  get shift() {
    return get("shift", null);
  },
  set shift(v) {
    set("shift", v);
  },
  get initials() {
    return get("initials", "AAA");
  },
  set initials(v) {
    set("initials", normalizeInitials(v));
  },
};
