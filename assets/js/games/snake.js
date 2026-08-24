/**
 * CAB.01 — Neon Snake
 *
 * Grid snake with wrapping walls, so the only way to lose is your own tail.
 * Every fifth pellet is a surge pellet worth double and it decays if ignored.
 */

import { PAL, roundRect, glow, dotGrid, randInt, centerText } from "./base.js";

export const meta = {
  id: "snake",
  cab: "01",
  name: "Neon Snake",
  tag: "Grid · endless",
  desc:
    "Steer the current through a wrapping grid. Eat cells to grow, keep off your own tail, and take the surge pellets before they fade.",
  accent: "#ff2fd0",
  scoreLabel: "SCORE",
  lowerIsBetter: false,
  pad: "dirs",
  art: ["cab-01.svg", "cab-12.svg", "cab-06.svg"],
};

export function create(api) {
  const COLS = 22;
  const ROWS = 17;

  let cell = 16;
  let ox = 0;
  let oy = 0;
  let snake = [];
  let dir = { x: 1, y: 0 };
  let queued = [];
  let food = { x: 0, y: 0, surge: false, life: 1 };
  let stepEvery = 0.13;
  let acc = 0;
  let eaten = 0;
  let flash = 0;

  function place() {
    let spot;
    let guard = 0;
    do {
      spot = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
      guard++;
    } while (guard < 400 && snake.some((s) => s.x === spot.x && s.y === spot.y));
    eaten += 1;
    food = { x: spot.x, y: spot.y, surge: eaten % 5 === 0, life: 1 };
  }

  return {
    resize(w, h) {
      cell = Math.floor(Math.min((w - 16) / COLS, (h - 16) / ROWS));
      ox = Math.round((w - cell * COLS) / 2);
      oy = Math.round((h - cell * ROWS) / 2);
    },

    reset() {
      const cy = Math.floor(ROWS / 2);
      snake = [
        { x: 5, y: cy },
        { x: 4, y: cy },
        { x: 3, y: cy },
      ];
      dir = { x: 1, y: 0 };
      queued = [];
      stepEvery = 0.13;
      acc = 0;
      eaten = 0;
      flash = 0;
      place();
      api.setScore(0);
    },

    input(action, pressed) {
      if (!pressed) return;
      const map = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      const next = map[action];
      if (!next) return;
      // queue turns so a fast double-tap round a corner is not swallowed
      const ref = queued.length ? queued[queued.length - 1] : dir;
      if (ref.x === -next.x && ref.y === -next.y) return;
      if (ref.x === next.x && ref.y === next.y) return;
      if (queued.length < 2) queued.push(next);
    },

    update(dt) {
      acc += dt;
      flash = Math.max(0, flash - dt * 4);
      if (food.surge) {
        food.life -= dt * 0.16;
        if (food.life <= 0) place();
      }
      if (acc < stepEvery) return;
      acc -= stepEvery;

      if (queued.length) dir = queued.shift();

      const head = {
        x: (snake[0].x + dir.x + COLS) % COLS,
        y: (snake[0].y + dir.y + ROWS) % ROWS,
      };

      // the tail tip moves away this tick, so it is not a collision
      const body = snake.slice(0, -1);
      if (body.some((s) => s.x === head.x && s.y === head.y)) {
        api.sfx.over();
        api.gameOver();
        return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        const gain = food.surge ? 20 : 10;
        api.addScore(gain);
        api.sfx.eat();
        flash = 1;
        stepEvery = Math.max(0.055, stepEvery - 0.0035);
        place();
      } else {
        snake.pop();
      }
    },

    draw(ctx, w, h) {
      dotGrid(ctx, w, h, cell);

      // playfield frame
      ctx.save();
      ctx.strokeStyle = "rgba(215,226,234,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - 0.5, oy - 0.5, cell * COLS + 1, cell * ROWS + 1);
      ctx.restore();

      // food
      const fx = ox + food.x * cell + cell / 2;
      const fy = oy + food.y * cell + cell / 2;
      const r = cell * (food.surge ? 0.42 : 0.3) * (food.surge ? 0.7 + food.life * 0.3 : 1);
      glow(ctx, food.surge ? PAL.ember : PAL.ion, 18, () => {
        ctx.fillStyle = food.surge ? PAL.ember : PAL.ion;
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // snake, brightest at the head
      for (let i = snake.length - 1; i >= 0; i--) {
        const s = snake[i];
        const t = 1 - i / Math.max(1, snake.length);
        const pad = cell * 0.14;
        const x = ox + s.x * cell + pad;
        const y = oy + s.y * cell + pad;
        const size = cell - pad * 2;
        // Canvas has no color-mix(), so the body fade is plain rgba.
        const a = 0.32 + t * 0.6;
        ctx.fillStyle = i === 0 ? PAL.white : `rgba(255,47,208,${a.toFixed(3)})`;
        roundRect(ctx, x, y, size, size, size * 0.3);
        ctx.fill();
      }

      // head bloom on eat
      if (flash > 0) {
        const head = snake[0];
        glow(ctx, PAL.white, 26 * flash, () => {
          ctx.fillStyle = `rgba(255,255,255,${(flash * 0.5).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(ox + head.x * cell + cell / 2, oy + head.y * cell + cell / 2, cell * 0.6, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      centerText(ctx, `LEN ${snake.length}`, ox + 2, oy - 10, {
        size: Math.max(9, cell * 0.6),
        color: PAL.dim,
        align: "left",
      });
      if (food.surge) {
        centerText(ctx, "SURGE", ox + cell * COLS - 2, oy - 10, {
          size: Math.max(9, cell * 0.6),
          color: PAL.ember,
          align: "right",
        });
      }
    },
  };
}
