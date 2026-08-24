/**
 * games/base.js — the harness every cabinet runs on.
 *
 * Provides: a DPR-correct canvas, a paused-aware fixed-ish loop, one input
 * abstraction that folds keyboard, mouse, touch swipes and the on-screen pad
 * into four directions plus an action, and a few drawing helpers.
 *
 * A game is a plain object:
 *   { reset(), update(dt), draw(ctx, w, h), input(action, pressed), point(phase, x, y) }
 * and it talks back through the `api` it is handed:
 *   api.setScore(n) · api.gameOver(score) · api.win(score) · api.sfx
 */

import { sfx } from "../audio.js";

/** Games always render on the dark screen, so the palette is fixed. */
export const PAL = {
  screen: "#07060a",
  ink: "#d7e2ea",
  dim: "#646973",
  ion: "#ff2fd0",
  plasma: "#7621b0",
  ember: "#ff6a1f",
  white: "#ffffff",
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));

/* ------------------------------------------------------------- rendering */

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function glow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

export function centerText(ctx, text, x, y, { size = 16, color = PAL.ink, font = "mono", weight = 400, align = "center" } = {}) {
  const family =
    font === "display"
      ? '"Kanit", Impact, sans-serif'
      : font === "body"
        ? '"Chakra Petch", system-ui, sans-serif'
        : '"Share Tech Mono", ui-monospace, monospace';
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Faint dot grid, used as a shared backdrop so the cabinets feel related. */
export function dotGrid(ctx, w, h, step = 24) {
  ctx.save();
  ctx.fillStyle = "rgba(215,226,234,0.055)";
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ input */

const KEYMAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "action",
  Enter: "action",
  KeyU: "undo",
  Digit1: "cell1",
  Digit2: "cell2",
  Digit3: "cell3",
  Digit4: "cell4",
  Digit5: "cell5",
  Digit6: "cell6",
  Digit7: "cell7",
  Digit8: "cell8",
  Digit9: "cell9",
};

export class Harness {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} hooks  { onScore, onOver, onWin }
   */
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks;
    this.game = null;
    this.running = false;
    this.paused = false;
    this.over = false;
    this.raf = 0;
    this.last = 0;
    this.w = 480;
    this.h = 360;
    this.dpr = 1;
    this.score = 0;

    // The arrow methods below close over `this` correctly, but a plain getter
    // does not: inside `get width()`, `this` is the api object, not the
    // harness. Capture the instance so both styles read the same state.
    const harness = this;

    this.api = {
      sfx,
      setScore: (n) => {
        this.score = n;
        this.hooks.onScore?.(n);
      },
      addScore: (n) => {
        this.score += n;
        this.hooks.onScore?.(this.score);
      },
      gameOver: (final = this.score) => {
        if (this.over) return;
        this.over = true;
        this.running = false;
        this.hooks.onOver?.(final);
      },
      win: (final = this.score) => {
        if (this.over) return;
        this.over = true;
        this.running = false;
        this.hooks.onWin?.(final);
      },
      get width() {
        return harness.w;
      },
      get height() {
        return harness.h;
      },
    };

    this._bind();
    this.resize();
  }

  /* ---- sizing ---- */

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(160, Math.round(rect.width || 480));
    const cssH = Math.max(120, Math.round(rect.height || 360));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.w = cssW;
    this.h = cssH;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.game?.resize?.(cssW, cssH);
    this.render();
  }

  /* ---- input plumbing ---- */

  _bind() {
    // Keys that would otherwise scroll the page while a cabinet is running.
    const SCROLLY = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

    this._onKey = (e) => {
      // Never steal keys from the curtain buttons or the initials inputs.
      const t = e.target;
      if (t instanceof Element && t.closest("input, textarea, select, button, [contenteditable]")) return;
      const action = KEYMAP[e.code];
      if (!action) return;
      if (SCROLLY.has(e.code)) e.preventDefault();
      if (e.type === "keydown" && e.repeat && action !== "left" && action !== "right") return;
      this.send(action, e.type === "keydown");
    };

    let sx = 0;
    let sy = 0;
    let swiped = false;
    const norm = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    this._onDown = (e) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      sx = e.clientX;
      sy = e.clientY;
      swiped = false;
      const p = norm(e);
      this.game?.point?.("down", p.x, p.y);
    };

    this._onMove = (e) => {
      const p = norm(e);
      this.game?.point?.("move", p.x, p.y);
      if (swiped || e.pressure === 0) return;
      if (e.buttons === 0 && e.pointerType === "mouse") return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) < 28) return;
      swiped = true;
      const dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      this.send(dir, true);
      this.send(dir, false);
    };

    this._onUp = (e) => {
      const p = norm(e);
      this.game?.point?.("up", p.x, p.y);
      if (!swiped) {
        this.send("action", true);
        this.send("action", false);
      }
    };

    window.addEventListener("keydown", this._onKey);
    window.addEventListener("keyup", this._onKey);
    this.canvas.addEventListener("pointerdown", this._onDown);
    this.canvas.addEventListener("pointermove", this._onMove);
    this.canvas.addEventListener("pointerup", this._onUp);
  }

  send(action, pressed) {
    if (!this.game || this.paused || this.over) return;
    this.game.input?.(action, pressed);
  }

  /* ---- lifecycle ---- */

  load(game) {
    this.stop();
    this.game = game;
    this.over = false;
    this.score = 0;
    this.game.resize?.(this.w, this.h);
    this.game.reset?.();
    this.hooks.onScore?.(0);
    this.render();
  }

  start() {
    if (!this.game || this.running) return;
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    const step = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.game.update?.(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(step);
  }

  render() {
    if (!this.game) return;
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = PAL.screen;
    ctx.fillRect(0, 0, this.w, this.h);
    this.game.draw?.(ctx, this.w, this.h);
  }

  setPaused(v) {
    this.paused = Boolean(v);
    if (!this.paused) this.last = performance.now();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  restart() {
    if (!this.game) return;
    this.over = false;
    this.score = 0;
    this.paused = false;
    this.game.reset?.();
    this.hooks.onScore?.(0);
    this.stop();
    this.start();
  }

  destroy() {
    this.stop();
    window.removeEventListener("keydown", this._onKey);
    window.removeEventListener("keyup", this._onKey);
    this.canvas.removeEventListener("pointerdown", this._onDown);
    this.canvas.removeEventListener("pointermove", this._onMove);
    this.canvas.removeEventListener("pointerup", this._onUp);
    this.game?.destroy?.();
    this.game = null;
  }
}
