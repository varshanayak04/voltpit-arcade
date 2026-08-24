/**
 * arcade.js — the cabinet you walk up to.
 *
 * Owns the play overlay: which game is loaded, the HUD, pause/restart, the
 * curtain (ready / paused / over / initials), the touch pad, and writing scores
 * back to the store. Emits "voltpit:scores" whenever a board changes so the page
 * can re-render without this module knowing about the DOM outside the overlay.
 */

import { Harness } from "./games/base.js";
import * as snake from "./games/snake.js";
import * as breaker from "./games/breaker.js";
import * as recall from "./games/recall.js";
import * as reflex from "./games/reflex.js";
import * as merge from "./games/merge.js";
import { sfx, resume as resumeAudio, stopMusic, startMusic, isEnabled } from "./audio.js";
import { submitScore, wouldPlace, best, settings, normalizeInitials } from "./store.js";

/** Floor order. The cab number in each meta is the machine's bay on the floor. */
export const GAMES = [snake, breaker, recall, reflex, merge];

export const byId = (id) => GAMES.find((g) => g.meta.id === id);

const el = {};
let harness = null;
let current = null;
let lastFocus = null;
let musicWasOn = false;

const isTouch = () => window.matchMedia("(hover: none), (pointer: coarse)").matches;

function q(id) {
  return document.getElementById(id);
}

/* ---------------------------------------------------------------- curtain */

const curtain = {
  show({ tag, title, body, button, initials = false }) {
    el.curtainTag.textContent = tag;
    el.curtainTitle.textContent = title;
    el.curtainBody.textContent = body;
    el.curtainBtn.textContent = button;
    el.initials.hidden = !initials;
    el.curtain.hidden = false;
    harness?.setPaused(true);
    if (initials) {
      const seed = settings.initials;
      el.initialInputs.forEach((input, i) => {
        input.value = seed[i] || "";
      });
      el.initialInputs[0].focus();
      el.initialInputs[0].select?.();
    } else {
      el.curtainBtn.focus();
    }
  },
  hide() {
    el.curtain.hidden = true;
    el.initials.hidden = true;
  },
};

/* -------------------------------------------------------------------- HUD */

function paintHud() {
  if (!current) return;
  const { meta } = current;
  el.hudTitle.textContent = `Cab.${meta.cab} ${meta.name}`;
  const b = best(meta.id, meta.lowerIsBetter);
  el.hudBest.innerHTML = `BEST <b>${b == null ? "—" : b}</b>`;
  el.hudScore.firstChild.textContent = `${meta.scoreLabel} `;
}

function paintScore(n) {
  el.hudScore.innerHTML = `${current.meta.scoreLabel} <b>${n}</b>`;
}

/* ------------------------------------------------------------- open/close */

export function open(id) {
  const game = byId(id);
  if (!game) return;

  resumeAudio();
  current = game;
  lastFocus = document.activeElement;

  el.overlay.hidden = false;
  // let the browser paint once so the transition runs and the canvas has a size
  requestAnimationFrame(() => el.overlay.classList.add("is-open"));

  musicWasOn = isEnabled();
  stopMusic();

  harness = new Harness(el.canvas, {
    onScore: paintScore,
    onOver: (final) => finish(final, false),
    onWin: (final) => finish(final, true),
  });

  harness.load(game.create(harness.api));
  harness.resize();
  paintHud();
  paintScore(0);

  // touch pad, shaped to what the machine actually needs
  const padMode = game.meta.pad || "none";
  el.pad.classList.toggle("is-on", isTouch() && padMode !== "none");
  el.padDirs.style.display = padMode === "dirs" || padMode === "lr" ? "" : "none";
  el.padAction.style.display = padMode === "action" || padMode === "lr" || padMode === "dirs" ? "" : "none";
  el.padDirs.querySelectorAll("[data-dir]").forEach((b) => {
    const vertical = b.dataset.dir === "up" || b.dataset.dir === "down";
    b.style.visibility = padMode === "lr" && vertical ? "hidden" : "";
  });

  curtain.show({
    tag: game.meta.tag,
    title: "Ready",
    body: hintFor(game.meta),
    button: "Start",
  });

  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("resize", onResize);
}

function hintFor(meta) {
  if (isTouch()) return "Use the pad below the screen.";
  switch (meta.pad) {
    case "dirs":
      return "Arrow keys or W A S D. Esc leaves the machine.";
    case "lr":
      return "Left and right arrows, or move the mouse. Space launches.";
    case "action":
      return "Space or click to fire. Esc leaves the machine.";
    default:
      return "Click the nodes, or use keys 1 to 9. Esc leaves the machine.";
  }
}

export function close() {
  if (!harness) return;
  harness.destroy();
  harness = null;
  current = null;
  el.overlay.classList.remove("is-open");
  document.body.style.overflow = "";
  window.removeEventListener("keydown", onKeydown, true);
  window.removeEventListener("resize", onResize);
  el.pad.classList.remove("is-on");
  window.setTimeout(() => {
    el.overlay.hidden = true;
    curtain.hide();
  }, 300);
  if (musicWasOn) startMusic();
  lastFocus?.focus?.();
}

function onResize() {
  harness?.resize();
}

/* ------------------------------------------------------------ end of run */

function finish(final, isWin) {
  const { meta } = current;
  const placed = wouldPlace(meta.id, final, meta.lowerIsBetter);
  const unit = meta.lowerIsBetter ? " ms" : "";

  if (placed) {
    curtain.show({
      tag: isWin ? "Machine cleared" : "Run over",
      title: `${final}${unit}`,
      body: "That makes the board. Enter your initials.",
      button: "Save score",
      initials: true,
    });
  } else {
    curtain.show({
      tag: isWin ? "Machine cleared" : "Run over",
      title: `${final}${unit}`,
      body: `Best on this machine is ${best(meta.id, meta.lowerIsBetter) ?? "—"}. Go again?`,
      button: "Play again",
    });
  }
  el.curtain.dataset.final = String(final);
  el.curtain.dataset.placed = placed ? "1" : "0";
}

function saveAndRestart() {
  const { meta } = current;
  const final = Number(el.curtain.dataset.final || 0);
  if (el.curtain.dataset.placed === "1") {
    const who = normalizeInitials(el.initialInputs.map((i) => i.value).join(""));
    settings.initials = who;
    submitScore(meta.id, final, who, meta.lowerIsBetter);
    window.dispatchEvent(new CustomEvent("voltpit:scores"));
    sfx.coin();
  }
  el.curtain.dataset.placed = "0";
  restart();
}

function restart() {
  curtain.hide();
  harness.restart();
  harness.setPaused(false);
  paintHud();
  sfx.start();
}

function togglePause() {
  if (!harness || harness.over) return;
  if (el.curtain.hidden) {
    curtain.show({
      tag: "Paused",
      title: "Paused",
      body: "The machine is holding. Nothing is lost.",
      button: "Resume",
    });
    el.curtain.dataset.placed = "0";
  } else {
    curtain.hide();
    harness.setPaused(false);
  }
}

function onKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === "p" || e.key === "P") {
    if (document.activeElement?.tagName !== "INPUT") {
      e.preventDefault();
      togglePause();
    }
    return;
  }
  // keep focus inside the dialog
  if (e.key === "Tab") {
    const focusables = el.overlay.querySelectorAll(
      'button, input, [href], [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.from(focusables).filter((n) => !n.closest("[hidden]"));
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

/* ------------------------------------------------------------------- init */

export function initArcade() {
  el.overlay = q("overlay");
  el.canvas = q("game");
  el.curtain = q("curtain");
  el.curtainTag = q("curtainTag");
  el.curtainTitle = q("curtainTitle");
  el.curtainBody = q("curtainBody");
  el.curtainBtn = q("curtainBtn");
  el.initials = q("initials");
  el.initialInputs = Array.from(el.initials.querySelectorAll("input"));
  el.hudTitle = q("hudTitle");
  el.hudScore = q("hudScore");
  el.hudBest = q("hudBest");
  el.pad = q("pad");
  el.padDirs = el.pad.querySelector(".pad__dirs");
  el.padAction = el.pad.querySelector(".pad__action");

  q("closeBtn").addEventListener("click", close);
  q("pauseBtn").addEventListener("click", togglePause);
  q("restartBtn").addEventListener("click", () => {
    el.curtain.dataset.placed = "0";
    restart();
  });

  el.curtainBtn.addEventListener("click", () => {
    resumeAudio();
    if (el.curtain.dataset.placed === "1") saveAndRestart();
    else if (harness?.over) restart();
    else {
      curtain.hide();
      harness.setPaused(false);
      harness.start();
      sfx.start();
    }
  });

  // initials: auto-advance, and let Enter save
  el.initialInputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 1);
      if (input.value && i < el.initialInputs.length - 1) el.initialInputs[i + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.curtainBtn.click();
      } else if (e.key === "Backspace" && !input.value && i > 0) {
        el.initialInputs[i - 1].focus();
      }
    });
  });

  // touch pad wiring: pointer down/up maps straight to harness actions
  el.pad.querySelectorAll("[data-dir]").forEach((btn) => {
    const dir = btn.dataset.dir === "action" ? "action" : btn.dataset.dir;
    const press = (v) => (e) => {
      e.preventDefault();
      harness?.send(dir, v);
    };
    btn.addEventListener("pointerdown", press(true));
    btn.addEventListener("pointerup", press(false));
    btn.addEventListener("pointercancel", press(false));
    btn.addEventListener("pointerleave", press(false));
  });

  // clicking the dimmed area leaves the machine
  el.overlay.addEventListener("pointerdown", (e) => {
    if (e.target === el.overlay) close();
  });
}
