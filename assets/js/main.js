/**
 * main.js — orchestrator.
 *
 * Wires the shell together: renders the marquee tiles, the floor cards and the
 * score boards from the games manifest; sets up motion, audio, theme and the
 * arcade overlay; registers the service worker. Kept declarative — each concern
 * lives in its own module and this file only connects them.
 */

import {
  initReveals,
  initScrollEffects,
  initNavHighlight,
  initMagnet,
  initMagneticButtons,
  initCursor,
  prefersReduced,
} from "./motion.js";
import { initAttract } from "./attract.js";
import { GAMES, initArcade, open } from "./arcade.js";
import { sfx, resume as resumeAudio, setEnabled, isEnabled, startMusic, stopMusic } from "./audio.js";
import { scores, best, wipeScores, settings, isPersistent } from "./store.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------------------------------------------------------- build marquee */

function buildMarquee() {
  const row1 = $("#row1");
  const row2 = $("#row2");
  if (!row1 || !row2) return;

  const panels = Array.from({ length: 21 }, (_, i) => `assets/art/cab-${String(i + 1).padStart(2, "0")}.svg`);
  const first = panels.slice(0, 11);
  const second = panels.slice(11);

  const tile = (src) => {
    const d = document.createElement("div");
    d.className = "marquee__tile";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 420;
    img.height = 270;
    d.appendChild(img);
    return d;
  };

  // tripled so the scroll-driven translate never reveals an edge
  for (let rep = 0; rep < 3; rep++) {
    first.forEach((s) => row1.appendChild(tile(s)));
    second.forEach((s) => row2.appendChild(tile(s)));
  }
}

/* ------------------------------------------------------------ build floor */

function buildFloor() {
  const stack = $("#stack");
  if (!stack) return;

  GAMES.forEach((game, i) => {
    const m = game.meta;
    const item = document.createElement("div");
    item.className = "floor__item";

    const bestVal = best(m.id, m.lowerIsBetter);
    const bestText =
      bestVal == null ? "No score yet" : `${bestVal}${m.lowerIsBetter ? " ms" : ""}`;

    const [a, b, c] = m.art;

    item.innerHTML = `
      <article class="cab-card" style="--card-accent:${m.accent}" data-reveal>
        <div class="cab-card__meta">
          <span class="cab-card__num">${m.cab}</span>
          <p class="cab-card__tag"><span><b>CAB.${m.cab}</b></span><span>${m.tag}</span></p>
          <h3 class="cab-card__name">${m.name}</h3>
          <p class="cab-card__desc">${m.desc}</p>
          <div class="cab-card__actions">
            <button class="btn btn--plasma" data-play="${m.id}" data-magnetic>Play now</button>
            <span class="cab-card__best">BEST <b>${bestText}</b></span>
          </div>
        </div>
        <div class="cab-card__art" aria-hidden="true">
          <div class="cab-card__col">
            <img class="is-a" src="assets/art/${a}" alt="" loading="lazy" decoding="async" />
            <img class="is-b" src="assets/art/${b}" alt="" loading="lazy" decoding="async" />
          </div>
          <img class="is-c" src="assets/art/${c}" alt="" loading="lazy" decoding="async" />
        </div>
      </article>`;
    stack.appendChild(item);
  });

  $$("[data-play]").forEach((btn) => {
    btn.addEventListener("click", () => {
      resumeAudio();
      sfx.coin();
      open(btn.dataset.play);
    });
  });
}

/* ----------------------------------------------------------- build boards */

function buildBoards() {
  const wrap = $("#boards");
  if (!wrap) return;
  wrap.innerHTML = "";

  GAMES.forEach((game) => {
    const m = game.meta;
    const rows = scores(m.id);
    const board = document.createElement("div");
    board.className = "board";
    board.dataset.reveal = "";

    const list = rows.length
      ? rows
          .map((r, i) => {
            const val = `${r.score}${m.lowerIsBetter ? "ms" : ""}`;
            return `<li class="board__row ${i === 0 ? "is-top" : ""}">
              <span class="board__rank">${i + 1}</span>
              <span>${escapeHtml(r.who)}</span>
              <span>${val}</span>
            </li>`;
          })
          .join("")
      : `<li class="board__empty">Empty — be the first to set a score.</li>`;

    board.innerHTML = `
      <div class="board__head">
        <span class="board__name">${m.name}</span>
        <span class="board__cab">CAB.${m.cab}${m.lowerIsBetter ? " · MS" : ""}</span>
      </div>
      <ol class="board__list">${list}</ol>`;

    board.addEventListener("click", () => {
      resumeAudio();
      sfx.pip();
      open(m.id);
    });
    board.style.cursor = "pointer";
    wrap.appendChild(board);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ------------------------------------------------------------------ theme */

function initTheme() {
  const root = document.documentElement;
  const btn = $("#shiftToggle");
  const system = window.matchMedia("(prefers-color-scheme: light)");

  const apply = (shift) => {
    root.dataset.shift = shift;
    const isDay = shift === "day";
    btn.setAttribute("aria-pressed", String(isDay));
    btn.title = isDay ? "House lights: on" : "House lights: off";
    const theme = isDay ? "#dcdae2" : "#0C0C0C";
    $('meta[name="theme-color"]')?.setAttribute("content", theme);
  };

  // saved choice wins; otherwise follow the system, default to night
  const saved = settings.shift;
  apply(saved || (system.matches ? "day" : "night"));

  btn.addEventListener("click", () => {
    const next = root.dataset.shift === "day" ? "night" : "day";
    settings.shift = next;
    apply(next);
    sfx.pip();
  });

  system.addEventListener?.("change", (e) => {
    if (!settings.shift) apply(e.matches ? "day" : "night");
  });
}

/* ------------------------------------------------------------------ sound */

function initSound() {
  const btn = $("#soundToggle");
  const paint = () => {
    const on = isEnabled();
    btn.setAttribute("aria-pressed", String(!on)); // pressed = muted
    btn.title = on ? "Sound: on" : "Sound: muted";
  };
  paint();

  btn.addEventListener("click", () => {
    resumeAudio();
    const on = setEnabled(!isEnabled());
    paint();
    if (on) {
      sfx.pip();
      if (heroInView) startMusic();
    } else {
      stopMusic();
    }
  });

  // the very first gesture anywhere unlocks the audio context
  const unlock = () => {
    resumeAudio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

/* ------------------------------------------------- ambient music in hero */

let heroInView = false;

function initAmbientMusic() {
  const hero = $(".hero");
  if (!hero || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      heroInView = entries[0].isIntersecting;
      if (heroInView && isEnabled()) startMusic();
      else stopMusic();
    },
    { threshold: 0.35 }
  );
  io.observe(hero);
}

/* -------------------------------------------------------------- coin slot */

function initCoinSlot() {
  const coin = $("#coinBtn");
  const marquee = $(".cabinet__marquee");
  const crtLabel = $(".crt__label span");
  if (!coin) return;

  const names = GAMES.map((g) => g.meta.name.toUpperCase());
  let idx = 0;

  coin.addEventListener("click", () => {
    resumeAudio();
    sfx.coin();
    idx = (idx + 1) % names.length;
    if (marquee) {
      marquee.textContent = names[idx];
      marquee.animate(
        [{ filter: "brightness(2)" }, { filter: "brightness(1)" }],
        { duration: 420, easing: "ease-out" }
      );
    }
    if (crtLabel) crtLabel.textContent = `DEMO · ${names[idx]}`;
  });

  // double as a shortcut: hold to jump to the floor
  coin.addEventListener("dblclick", () => {
    $("#floor")?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth" });
  });
}

/* --------------------------------------------------------------- controls */

function initControls() {
  $("#wipeScores")?.addEventListener("click", () => {
    if (window.confirm("Wipe every high score on this device? This cannot be undone.")) {
      wipeScores();
      buildBoards();
      initReveals();
      sfx.bad();
    }
  });

  // persistence notice, only if storage is actually blocked
  if (!isPersistent()) {
    const note = $(".scores__note");
    if (note) note.textContent = "Storage is blocked here — scores last for this visit only.";
  }
}

/* ------------------------------------------------------- service worker */

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // file:// has no SW; only register over http(s)
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* offline support is a bonus; ignore failures */
    });
  });
}

/* ------------------------------------------------------------------- boot */

function boot() {
  buildMarquee();
  buildFloor();
  buildBoards();

  initReveals();
  initNavHighlight();
  initTheme();
  initSound();
  initAmbientMusic();
  initCoinSlot();
  initControls();
  initArcade();

  if (!prefersReduced()) {
    initCursor();
    initMagneticButtons();
    const cab = $("#cabinet");
    if (cab) initMagnet(cab, { padding: 120, strength: 4 });
  }

  initAttract($("#attract"));

  initScrollEffects({
    marquee: $("#marquee"),
    stack: $("#stack"),
    chars: $("#hallCopy"),
    progress: $(".rail__progress"),
  });

  // re-run reveals now that floor/boards exist
  initReveals();

  // deep link: #play=snake opens a machine straight away
  const m = location.hash.match(/play=(\w+)/);
  if (m) open(m[1]);

  initServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// keep the boards fresh after a score is saved
window.addEventListener("voltpit:scores", () => {
  buildBoards();
  initReveals();
  // repaint the "best" line on each floor card
  GAMES.forEach((g) => {
    const btn = document.querySelector(`[data-play="${g.meta.id}"]`);
    const line = btn?.closest(".cab-card__actions")?.querySelector(".cab-card__best b");
    if (line) {
      const v = best(g.meta.id, g.meta.lowerIsBetter);
      line.textContent = v == null ? "No score yet" : `${v}${g.meta.lowerIsBetter ? " ms" : ""}`;
    }
  });
});
