/**
 * CAB.04 — Reflex Gate
 *
 * Five clean rounds, averaged. The gate holds red for a random 1.2-3.5s, then
 * opens to ion-pink; fire as soon as it does. Firing early is a fault: the round
 * is re-run and 50ms is added to your final average.
 *
 * Score is a reaction time in milliseconds, so lower wins. It gets its own board.
 */

import { PAL, roundRect, glow, dotGrid, rand, centerText, clamp } from "./base.js";

export const meta = {
  id: "reflex",
  cab: "04",
  name: "Reflex Gate",
  tag: "Reaction · 5 rounds",
  desc:
    "Hold, then fire the instant the gate opens. Five clean rounds are averaged into one reaction time — the only board here where a lower number wins.",
  accent: "#ff2fd0",
  scoreLabel: "MS",
  lowerIsBetter: true,
  pad: "action",
  art: ["cab-04.svg", "cab-20.svg", "cab-13.svg"],
};

const ROUNDS = 5;
const FAULT_PENALTY = 50;

export function create(api) {
  let W = 480;
  let H = 360;
  let phase = "ready"; // ready | arming | open | scored | faulted | done
  let timer = 0;
  let openedAt = 0;
  let times = [];
  let faults = 0;
  let last = 0;
  let lastFire = 0;
  let ring = 0;

  function average() {
    if (!times.length) return 0;
    const sum = times.reduce((a, b) => a + b, 0);
    return Math.round(sum / times.length + faults * FAULT_PENALTY);
  }

  function arm() {
    phase = "arming";
    timer = rand(1.2, 3.5);
  }

  function fire() {
    // one physical tap can arrive as both a pointer event and an action key
    const now = performance.now();
    if (now - lastFire < 140) return;
    lastFire = now;

    if (phase === "ready") {
      arm();
      return;
    }

    if (phase === "arming") {
      faults += 1;
      phase = "faulted";
      timer = 1.1;
      api.sfx.fault();
      return;
    }

    if (phase === "open") {
      last = Math.round(now - openedAt);
      times.push(last);
      ring = 1;
      api.sfx.good();
      api.setScore(average());
      if (times.length >= ROUNDS) {
        phase = "done";
        timer = 0.8;
      } else {
        phase = "scored";
        timer = 0.9;
      }
      return;
    }

    if (phase === "scored" || phase === "faulted") {
      timer = 0; // let an impatient player skip the interstitial
    }
  }

  return {
    resize(w, h) {
      W = w;
      H = h;
    },

    reset() {
      phase = "ready";
      timer = 0;
      times = [];
      faults = 0;
      last = 0;
      ring = 0;
      api.setScore(0);
    },

    input(action, pressed) {
      if (pressed && action === "action") fire();
    },

    point(p) {
      if (p === "down") fire();
    },

    update(dt) {
      ring = Math.max(0, ring - dt * 2);
      if (phase === "ready") return;
      timer -= dt;
      if (timer > 0) return;

      if (phase === "arming") {
        phase = "open";
        openedAt = performance.now();
        api.sfx.pip();
        return;
      }

      if (phase === "open") {
        // held the gate open too long
        if (performance.now() - openedAt > 3000) {
          faults += 1;
          phase = "faulted";
          timer = 1.1;
          api.sfx.fault();
        }
        return;
      }

      if (phase === "scored" || phase === "faulted") {
        arm();
        return;
      }

      if (phase === "done") {
        api.sfx.win();
        api.gameOver(average());
      }
    },

    draw(ctx, w, h) {
      dotGrid(ctx, w, h, 26);

      const cx = w / 2;
      const cy = h / 2 + 6;
      const r = Math.min(w, h) * 0.24;

      const open = phase === "open";
      const fault = phase === "faulted";
      const color = open ? PAL.ion : fault ? PAL.ember : "#3a2b46";

      // the gate
      glow(ctx, open ? PAL.ion : "transparent", open ? 44 : 0, () => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.strokeStyle = open ? PAL.white : "rgba(215,226,234,0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
      ctx.stroke();

      if (ring > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${(ring * 0.8).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 10 + (1 - ring) * 40, 0, Math.PI * 2);
        ctx.stroke();
      }

      const caption =
        phase === "ready"
          ? "PRESS TO ARM"
          : phase === "arming"
            ? "HOLD"
            : open
              ? "FIRE"
              : fault
                ? "TOO EARLY"
                : phase === "done"
                  ? "GATE CLOSED"
                  : `${last} MS`;

      centerText(ctx, caption, cx, cy, {
        size: Math.max(14, r * 0.34),
        color: open ? PAL.white : fault ? PAL.white : PAL.ink,
        font: "display",
        weight: 900,
      });

      // round pips
      const pipY = h - 26;
      const gap = 22;
      const startX = cx - ((ROUNDS - 1) * gap) / 2;
      for (let i = 0; i < ROUNDS; i++) {
        const done = i < times.length;
        ctx.fillStyle = done ? PAL.ion : "rgba(215,226,234,0.2)";
        ctx.beginPath();
        ctx.arc(startX + i * gap, pipY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      centerText(ctx, `ROUND ${clamp(times.length + 1, 1, ROUNDS)}/${ROUNDS}`, 10, 16, {
        size: 12,
        color: PAL.dim,
        align: "left",
      });
      centerText(ctx, faults ? `FAULTS ${faults}  +${faults * FAULT_PENALTY}MS` : "NO FAULTS", w - 10, 16, {
        size: 12,
        color: faults ? PAL.ember : PAL.dim,
        align: "right",
      });
      if (times.length) {
        centerText(ctx, `AVG ${average()} MS`, cx, pipY - 26, { size: 12, color: PAL.dim });
      }
    },
  };
}
