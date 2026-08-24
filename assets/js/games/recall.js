/**
 * CAB.03 — Matrix Recall
 *
 * A 3x3 node grid flashes a sequence; play it back in order. Each round adds one
 * node and shortens the flash. One mistake ends the run.
 */

import { PAL, roundRect, glow, dotGrid, randInt, centerText, clamp } from "./base.js";

export const meta = {
  id: "recall",
  cab: "03",
  name: "Matrix Recall",
  tag: "Memory · rounds",
  desc:
    "The grid plays a sequence of nodes and you play it back. Every round adds a node and quickens the flash. One miss ends the run.",
  accent: "#7621b0",
  scoreLabel: "ROUND",
  lowerIsBetter: false,
  pad: "none",
  art: ["cab-03.svg", "cab-09.svg", "cab-18.svg"],
};

export function create(api) {
  const N = 3;
  const NODES = N * N;

  let W = 480;
  let H = 360;
  let box = 0;
  let ox = 0;
  let oy = 0;

  let seq = [];
  let input = [];
  let phase = "intro"; // intro | showing | wait | listen | good | bad
  let timer = 0;
  let cursor = 0;
  let litNode = -1;
  let flashOn = 0.42;
  let flashOff = 0.2;
  let round = 0;
  let shake = 0;
  const pulses = new Array(NODES).fill(0);

  function layout() {
    const pad = Math.min(W, H) * 0.08;
    const size = Math.min(W, H) - pad * 2;
    box = Math.floor(size / N);
    ox = Math.round((W - box * N) / 2);
    oy = Math.round((H - box * N) / 2) + 6;
  }

  function nodeAt(px, py) {
    const cx = Math.floor((px - ox) / box);
    const cy = Math.floor((py - oy) / box);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return -1;
    return cy * N + cx;
  }

  function nextRound() {
    round += 1;
    seq.push(randInt(0, NODES - 1));
    input = [];
    cursor = 0;
    phase = "showing";
    timer = 0.45;
    litNode = -1;
    flashOn = clamp(0.42 - round * 0.012, 0.16, 0.42);
    flashOff = clamp(0.2 - round * 0.006, 0.08, 0.2);
    api.setScore(round - 1);
  }

  function press(idx) {
    if (phase !== "listen" || idx < 0 || idx >= NODES) return;
    pulses[idx] = 1;
    if (seq[input.length] === idx) {
      input.push(idx);
      api.sfx.pip();
      if (input.length === seq.length) {
        phase = "good";
        timer = 0.5;
        api.setScore(round);
        api.sfx.good();
      }
    } else {
      phase = "bad";
      timer = 0.9;
      shake = 1;
      api.sfx.bad();
    }
  }

  return {
    resize(w, h) {
      W = w;
      H = h;
      layout();
    },

    reset() {
      seq = [];
      input = [];
      round = 0;
      phase = "intro";
      timer = 0.7;
      litNode = -1;
      shake = 0;
      pulses.fill(0);
      api.setScore(0);
      layout();
    },

    input(action, pressed) {
      if (!pressed) return;
      if (action.startsWith("cell")) press(Number(action.slice(4)) - 1);
    },

    point(p, x, y) {
      if (p !== "down") return;
      press(nodeAt(x * W, y * H));
    },

    update(dt) {
      for (let i = 0; i < NODES; i++) pulses[i] = Math.max(0, pulses[i] - dt * 3.2);
      shake = Math.max(0, shake - dt * 3);
      timer -= dt;
      if (timer > 0) return;

      if (phase === "intro") {
        nextRound();
        return;
      }

      if (phase === "showing") {
        if (litNode >= 0) {
          // gap between flashes
          litNode = -1;
          cursor += 1;
          timer = flashOff;
          if (cursor >= seq.length) {
            phase = "listen";
            timer = 0;
          }
          return;
        }
        litNode = seq[cursor];
        pulses[litNode] = 1;
        api.sfx.move();
        timer = flashOn;
        return;
      }

      if (phase === "good") {
        nextRound();
        return;
      }

      if (phase === "bad") {
        api.sfx.over();
        api.gameOver(round - 1);
      }
    },

    draw(ctx, w, h) {
      dotGrid(ctx, w, h, 26);
      ctx.save();
      if (shake > 0) ctx.translate(Math.sin(shake * 40) * shake * 5, 0);

      for (let i = 0; i < NODES; i++) {
        const cx = ox + (i % N) * box;
        const cy = oy + Math.floor(i / N) * box;
        const inset = box * 0.09;
        const size = box - inset * 2;
        const isLit = litNode === i || pulses[i] > 0.01;
        const strength = litNode === i ? 1 : pulses[i];
        const color = phase === "bad" ? PAL.ember : i % 3 === 0 ? PAL.ion : i % 3 === 1 ? PAL.plasma : PAL.ember;

        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(215,226,234,0.05)";
        roundRect(ctx, cx + inset, cy + inset, size, size, size * 0.22);
        ctx.fill();

        ctx.strokeStyle = "rgba(215,226,234,0.18)";
        ctx.lineWidth = 1.5;
        roundRect(ctx, cx + inset, cy + inset, size, size, size * 0.22);
        ctx.stroke();

        if (isLit) {
          glow(ctx, color, 26 * strength, () => {
            ctx.globalAlpha = clamp(0.25 + strength * 0.75, 0, 1);
            ctx.fillStyle = color;
            roundRect(ctx, cx + inset, cy + inset, size, size, size * 0.22);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
        }

        // node index, so keyboard players can see the 1-9 mapping
        centerText(ctx, String(i + 1), cx + inset + 10, cy + inset + 12, {
          size: Math.max(9, box * 0.13),
          color: "rgba(215,226,234,0.3)",
          align: "left",
        });
      }
      ctx.restore();

      const label =
        phase === "showing"
          ? "WATCH"
          : phase === "listen"
            ? `REPEAT  ${input.length}/${seq.length}`
            : phase === "good"
              ? "CLEAN"
              : phase === "bad"
                ? "FAULT"
                : "READY";
      centerText(ctx, label, w / 2, oy - Math.max(14, box * 0.16), {
        size: Math.max(11, Math.min(W, H) * 0.038),
        color: phase === "bad" ? PAL.ember : phase === "listen" ? PAL.ion : PAL.dim,
      });
      centerText(ctx, `ROUND ${Math.max(1, round)}`, 10, 16, { size: 12, color: PAL.dim, align: "left" });
    },
  };
}
