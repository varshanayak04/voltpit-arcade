/**
 * CAB.05 — Volt 2048
 *
 * Slide-and-merge on a 4x4 grid. Two equal charges fuse into the next power.
 * Reaching 2048 wins the run; you get one undo per run.
 */

import { PAL, roundRect, glow, randInt, centerText, clamp } from "./base.js";

export const meta = {
  id: "merge",
  cab: "05",
  name: "Volt 2048",
  tag: "Puzzle · merge",
  desc:
    "Slide the charge tiles together until two equal cells fuse into the next power. Reach 2048 without filling the grid. One undo per run.",
  accent: "#ff6a1f",
  scoreLabel: "SCORE",
  lowerIsBetter: false,
  pad: "dirs",
  art: ["cab-05.svg", "cab-10.svg", "cab-21.svg"],
};

const N = 4;

const TILE_COLORS = {
  2: "#241a2e",
  4: "#33203f",
  8: "#4a1d6b",
  16: "#7621b0",
  32: "#9b26ae",
  64: "#c4189f",
  128: "#ff2fd0",
  256: "#ff58a6",
  512: "#ff6a1f",
  1024: "#ffa229",
  2048: "#ffffff",
};

export function create(api) {
  let W = 480;
  let H = 360;
  let box = 0;
  let ox = 0;
  let oy = 0;

  let grid = [];
  let score = 0;
  let undoLeft = 1;
  let history = null;
  let pops = [];
  let won = false;
  let message = "";
  let messageFor = 0;

  const idx = (r, c) => r * N + c;

  function layout() {
    const pad = Math.min(W, H) * 0.07;
    const size = Math.min(W, H) - pad * 2;
    box = Math.floor(size / N);
    ox = Math.round((W - box * N) / 2);
    oy = Math.round((H - box * N) / 2) + 8;
  }

  function spawn() {
    const empties = [];
    for (let i = 0; i < N * N; i++) if (!grid[i]) empties.push(i);
    if (!empties.length) return false;
    const at = empties[randInt(0, empties.length - 1)];
    grid[at] = Math.random() < 0.9 ? 2 : 4;
    pops.push({ at, t: 1, kind: "new" });
    return true;
  }

  /** Collapses one line toward index 0. Returns [newLine, gained, mergedFlags]. */
  function collapse(line) {
    const vals = line.filter(Boolean);
    const out = [];
    const merged = [];
    let gained = 0;
    for (let i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        const v = vals[i] * 2;
        out.push(v);
        merged.push(out.length - 1);
        gained += v;
        i++;
      } else {
        out.push(vals[i]);
      }
    }
    while (out.length < N) out.push(0);
    return [out, gained, merged];
  }

  function readLine(dir, k) {
    const line = [];
    for (let i = 0; i < N; i++) {
      if (dir === "left") line.push(grid[idx(k, i)]);
      else if (dir === "right") line.push(grid[idx(k, N - 1 - i)]);
      else if (dir === "up") line.push(grid[idx(i, k)]);
      else line.push(grid[idx(N - 1 - i, k)]);
    }
    return line;
  }

  function writeLine(dir, k, line, merged) {
    for (let i = 0; i < N; i++) {
      let at;
      if (dir === "left") at = idx(k, i);
      else if (dir === "right") at = idx(k, N - 1 - i);
      else if (dir === "up") at = idx(i, k);
      else at = idx(N - 1 - i, k);
      grid[at] = line[i];
      if (merged.includes(i)) pops.push({ at, t: 1, kind: "merge" });
    }
  }

  function canMove() {
    for (let i = 0; i < N * N; i++) {
      if (!grid[i]) return true;
      const r = Math.floor(i / N);
      const c = i % N;
      if (c + 1 < N && grid[i] === grid[idx(r, c + 1)]) return true;
      if (r + 1 < N && grid[i] === grid[idx(r + 1, c)]) return true;
    }
    return false;
  }

  function move(dir) {
    const before = grid.join(",");
    const snapshot = { grid: grid.slice(), score, undoLeft };

    let gained = 0;
    for (let k = 0; k < N; k++) {
      const [line, g, merged] = collapse(readLine(dir, k));
      gained += g;
      writeLine(dir, k, line, merged);
    }

    if (grid.join(",") === before) return;

    history = snapshot;
    if (gained) {
      score += gained;
      api.setScore(score);
      api.sfx.merge(Math.log2(Math.max(2, gained)));
    } else {
      api.sfx.move();
    }

    spawn();

    if (!won && grid.some((v) => v >= 2048)) {
      won = true;
      api.sfx.win();
      api.win(score);
      return;
    }

    if (!canMove()) {
      api.sfx.over();
      api.gameOver(score);
    }
  }

  function undo() {
    if (!history || undoLeft <= 0) {
      message = undoLeft <= 0 ? "NO UNDO LEFT" : "NOTHING TO UNDO";
      messageFor = 1.4;
      api.sfx.bad();
      return;
    }
    grid = history.grid.slice();
    score = history.score;
    undoLeft -= 1;
    history = null;
    api.setScore(score);
    api.sfx.pip();
    message = "UNDONE";
    messageFor = 1.1;
  }

  return {
    resize(w, h) {
      W = w;
      H = h;
      layout();
    },

    reset() {
      grid = new Array(N * N).fill(0);
      score = 0;
      undoLeft = 1;
      history = null;
      pops = [];
      won = false;
      message = "";
      messageFor = 0;
      spawn();
      spawn();
      api.setScore(0);
      layout();
    },

    input(action, pressed) {
      if (!pressed) return;
      if (action === "undo") undo();
      else if (["up", "down", "left", "right"].includes(action)) move(action);
    },

    update(dt) {
      for (const p of pops) p.t -= dt * 3.4;
      pops = pops.filter((p) => p.t > 0);
      if (messageFor > 0) messageFor -= dt;
    },

    draw(ctx, w, h) {
      // board plate
      const plate = box * N;
      ctx.fillStyle = "rgba(215,226,234,0.05)";
      roundRect(ctx, ox - 6, oy - 6, plate + 12, plate + 12, 14);
      ctx.fill();

      for (let i = 0; i < N * N; i++) {
        const r = Math.floor(i / N);
        const c = i % N;
        const inset = box * 0.06;
        const size = box - inset * 2;
        const x = ox + c * box + inset;
        const y = oy + r * box + inset;

        ctx.fillStyle = "rgba(215,226,234,0.045)";
        roundRect(ctx, x, y, size, size, size * 0.16);
        ctx.fill();

        const v = grid[i];
        if (!v) continue;

        const pop = pops.find((p) => p.at === i);
        const grow = pop ? (pop.kind === "merge" ? 1 + pop.t * 0.16 : 0.7 + (1 - pop.t) * 0.3) : 1;
        const sz = size * grow;
        const dx = x + (size - sz) / 2;
        const dy = y + (size - sz) / 2;

        const color = TILE_COLORS[v] || "#ffffff";
        const bright = v >= 128;

        glow(ctx, color, bright ? 18 : 0, () => {
          ctx.fillStyle = color;
          roundRect(ctx, dx, dy, sz, sz, sz * 0.16);
          ctx.fill();
        });

        if (!bright) {
          ctx.strokeStyle = "rgba(215,226,234,0.16)";
          ctx.lineWidth = 1;
          roundRect(ctx, dx, dy, sz, sz, sz * 0.16);
          ctx.stroke();
        }

        const digits = String(v).length;
        centerText(ctx, String(v), dx + sz / 2, dy + sz / 2 + 1, {
          size: sz * (digits > 3 ? 0.3 : digits > 2 ? 0.36 : 0.44),
          color: v === 2048 ? "#0c0c0c" : bright ? "#12040f" : PAL.ink,
          font: "display",
          weight: 900,
        });
      }

      centerText(ctx, `UNDO ${undoLeft}`, 10, 16, {
        size: 12,
        color: undoLeft ? PAL.ember : PAL.dim,
        align: "left",
      });
      const top = Math.max(...grid, 0);
      centerText(ctx, `TOP ${top}`, w - 10, 16, { size: 12, color: PAL.dim, align: "right" });

      if (messageFor > 0) {
        ctx.globalAlpha = clamp(messageFor, 0, 1);
        centerText(ctx, message, w / 2, oy - 14, { size: 12, color: PAL.ion });
        ctx.globalAlpha = 1;
      }
    },
  };
}
