/**
 * audio.js — all sound is synthesised with the Web Audio API.
 *
 * No audio files ship with the site, which keeps the offline bundle tiny and
 * means every blip is generated on the fly. There is a bank of one-shot SFX and
 * a small looping arpeggio "attract" track. Everything routes through one gain
 * node so a single mute cuts all of it.
 *
 * Browsers block audio until a user gesture, so nothing starts until the first
 * click/keypress resumes the context (wired up in main.js).
 */

import { settings } from "./store.js";

let ctx = null;
let master = null;
let musicGain = null;
let enabled = settings.sound;
let musicTimer = null;
let musicOn = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.9 : 0;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.0;
  musicGain.connect(master);
  return ctx;
}

export function resume() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume();
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(v) {
  enabled = Boolean(v);
  settings.sound = enabled;
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(enabled ? 0.9 : 0, ctx.currentTime + 0.08);
  }
  if (!enabled) stopMusic();
  return enabled;
}

/* ------------------------------------------------------------ primitives */

function tone({ freq = 440, dur = 0.12, type = "square", gain = 0.2, slideTo = null, delay = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.16, gain = 0.18, hp = 800 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filt = c.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

/* -------------------------------------------------------------- SFX bank */

export const sfx = {
  move: () => tone({ freq: 320, dur: 0.05, type: "square", gain: 0.08 }),
  pip: () => tone({ freq: 660, dur: 0.06, type: "triangle", gain: 0.12 }),
  eat: () => {
    tone({ freq: 520, dur: 0.09, type: "square", gain: 0.16, slideTo: 880 });
    tone({ freq: 880, dur: 0.08, type: "square", gain: 0.1, delay: 0.05 });
  },
  hit: () => tone({ freq: 240, dur: 0.08, type: "square", gain: 0.16, slideTo: 160 }),
  brick: (i = 0) => tone({ freq: 400 + (i % 6) * 60, dur: 0.06, type: "square", gain: 0.14 }),
  merge: (n = 1) => tone({ freq: 240 + n * 44, dur: 0.12, type: "sawtooth", gain: 0.13, slideTo: 300 + n * 60 }),
  coin: () => {
    tone({ freq: 988, dur: 0.08, type: "square", gain: 0.16 });
    tone({ freq: 1319, dur: 0.14, type: "square", gain: 0.16, delay: 0.08 });
  },
  start: () => {
    [440, 554, 659, 880].forEach((f, i) =>
      tone({ freq: f, dur: 0.12, type: "square", gain: 0.14, delay: i * 0.07 })
    );
  },
  good: () => {
    tone({ freq: 660, dur: 0.1, type: "triangle", gain: 0.16, slideTo: 990 });
  },
  bad: () => {
    tone({ freq: 200, dur: 0.22, type: "sawtooth", gain: 0.18, slideTo: 90 });
    noise({ dur: 0.14, gain: 0.1, hp: 500 });
  },
  over: () => {
    [523, 415, 349, 262].forEach((f, i) =>
      tone({ freq: f, dur: 0.18, type: "square", gain: 0.16, delay: i * 0.14 })
    );
  },
  win: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone({ freq: f, dur: 0.14, type: "triangle", gain: 0.16, delay: i * 0.09 })
    );
  },
  fault: () => noise({ dur: 0.2, gain: 0.16, hp: 300 }),
};

/* --------------------------------------------------------------- music */

// A moody two-bar arpeggio in A minor. Plays quietly under the attract screen.
const PATTERN = [
  220, 261.63, 329.63, 261.63, 293.66, 349.23, 293.66, 220,
  196, 246.94, 293.66, 246.94, 174.61, 220, 261.63, 293.66,
];
let step = 0;

export function startMusic() {
  const c = ensure();
  if (!c || !enabled || musicOn) return;
  musicOn = true;
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 1.2);
  const tick = () => {
    if (!musicOn || !enabled) return;
    const f = PATTERN[step % PATTERN.length];
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.36);
    // a soft bass note every four steps
    if (step % 4 === 0) {
      const b = c.createOscillator();
      const bg = c.createGain();
      b.type = "sine";
      b.frequency.value = f / 2;
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      b.connect(bg);
      bg.connect(musicGain);
      b.start(t0);
      b.stop(t0 + 0.62);
    }
    step++;
    musicTimer = window.setTimeout(tick, 210);
  };
  tick();
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  }
}

export function toggleMusic(on) {
  if (on) startMusic();
  else stopMusic();
}
