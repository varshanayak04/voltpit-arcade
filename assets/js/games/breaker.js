/**
 * CAB.02 — Relay Breaker
 *
 * Breakout. Paddle steers by keys, mouse or drag. Return angle depends on where
 * the ball meets the paddle. Clear a wall to advance; each level speeds the ball
 * and narrows the paddle. Three balls per run.
 */

import { PAL, roundRect, glow, dotGrid, clamp, centerText } from "./base.js";

export const meta = {
  id: "breaker",
  cab: "02",
  name: "Relay Breaker",
  tag: "Paddle · levels",
  desc:
    "A paddle, a ball, and a charged wall. Angle returns off the paddle edges to reach the corners; clearing the wall speeds things up.",
  accent: "#ff6a1f",
  scoreLabel: "SCORE",
  lowerIsBetter: false,
  pad: "lr",
  art: ["cab-02.svg", "cab-16.svg", "cab-08.svg"],
};

export function create(api) {
  const COLS = 9;
  const ROWS = 5;
  const COLORS = [PAL.ion, PAL.ember, PAL.plasma];

  let W = 480;
  let H = 360;
  let paddle = { x: 200, w: 92, h: 12, y: 0, speed: 560 };
  let ball = { x: 0, y: 0, vx: 0, vy: 0, r: 6, stuck: true };
  let bricks = [];
  let level = 1;
  let lives = 3;
  let move = 0; // -1 / 0 / 1 from keys
  let brickW = 0;
  let brickH = 16;
  let gap = 6;
  let top = 46;

  function buildWall() {
    bricks = [];
    brickW = (W - gap) / COLS - gap;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // upper rows are tougher (2 hits) from level 2 on
        const hp = level >= 2 && r < 2 ? 2 : 1;
        bricks.push({
          x: gap + c * (brickW + gap) + gap / 2,
          y: top + r * (brickH + gap),
          w: brickW,
          h: brickH,
          hp,
          color: COLORS[r % COLORS.length],
        });
      }
    }
  }

  function serve() {
    paddle.w = Math.max(58, 100 - (level - 1) * 8);
    paddle.y = H - 30;
    paddle.x = W / 2;
    ball.stuck = true;
    ball.r = 6;
    ball.x = paddle.x;
    ball.y = paddle.y - 14;
    const speed = 250 + (level - 1) * 42;
    const ang = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
    ball.vx = Math.cos(ang) * speed;
    ball.vy = Math.sin(ang) * speed;
  }

  function launch() {
    if (ball.stuck) ball.stuck = false;
  }

  return {
    resize(w, h) {
      W = w;
      H = h;
      brickH = clamp(Math.round(h * 0.045), 12, 18);
      top = Math.round(h * 0.13);
      paddle.y = H - 30;
      if (bricks.length) {
        brickW = (W - gap) / COLS - gap;
        bricks.forEach((b, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          b.x = gap + c * (brickW + gap) + gap / 2;
          b.y = top + r * (brickH + gap);
          b.w = brickW;
          b.h = brickH;
        });
      }
    },

    reset() {
      level = 1;
      lives = 3;
      move = 0;
      buildWall();
      serve();
      api.setScore(0);
    },

    input(action, pressed) {
      if (action === "left") move = pressed ? -1 : move === -1 ? 0 : move;
      else if (action === "right") move = pressed ? 1 : move === 1 ? 0 : move;
      else if (action === "action" && pressed) launch();
    },

    point(phase, x) {
      // drag or move the pointer to steer directly
      if (phase === "move" || phase === "down") {
        paddle.x = clamp(x * W, paddle.w / 2, W - paddle.w / 2);
        if (phase === "down") launch();
      }
    },

    update(dt) {
      // paddle from keys
      if (move !== 0) {
        paddle.x = clamp(paddle.x + move * paddle.speed * dt, paddle.w / 2, W - paddle.w / 2);
      }

      if (ball.stuck) {
        ball.x = paddle.x;
        ball.y = paddle.y - 14;
        return;
      }

      // integrate in a couple of substeps so fast balls do not tunnel bricks
      const steps = 3;
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        ball.x += ball.vx * h;
        ball.y += ball.vy * h;

        if (ball.x < ball.r) {
          ball.x = ball.r;
          ball.vx = Math.abs(ball.vx);
          api.sfx.hit();
        } else if (ball.x > W - ball.r) {
          ball.x = W - ball.r;
          ball.vx = -Math.abs(ball.vx);
          api.sfx.hit();
        }
        if (ball.y < ball.r) {
          ball.y = ball.r;
          ball.vy = Math.abs(ball.vy);
          api.sfx.hit();
        }

        // paddle
        if (
          ball.vy > 0 &&
          ball.y + ball.r >= paddle.y &&
          ball.y - ball.r <= paddle.y + paddle.h &&
          ball.x >= paddle.x - paddle.w / 2 - ball.r &&
          ball.x <= paddle.x + paddle.w / 2 + ball.r
        ) {
          const rel = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
          const speed = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.015);
          const ang = -Math.PI / 2 + rel * (Math.PI / 3);
          ball.vx = Math.cos(ang) * speed;
          ball.vy = Math.sin(ang) * speed;
          ball.y = paddle.y - ball.r - 0.5;
          api.sfx.pip();
        }

        // bricks
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (
            ball.x + ball.r > b.x &&
            ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y &&
            ball.y - ball.r < b.y + b.h
          ) {
            // reflect on the shallower axis of penetration
            const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
            const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
            if (overlapX < overlapY) ball.vx *= -1;
            else ball.vy *= -1;
            b.hp -= 1;
            api.sfx.brick(i);
            if (b.hp <= 0) {
              bricks.splice(i, 1);
              api.addScore(10 * level);
            } else {
              api.addScore(5);
            }
            break;
          }
        }
      }

      // lost the ball
      if (ball.y - ball.r > H) {
        lives -= 1;
        if (lives <= 0) {
          api.sfx.over();
          api.gameOver();
          return;
        }
        api.sfx.bad();
        serve();
        return;
      }

      // cleared the wall
      if (bricks.length === 0) {
        level += 1;
        api.addScore(50);
        api.sfx.win();
        buildWall();
        serve();
      }
    },

    draw(ctx, w, h) {
      dotGrid(ctx, w, h, 24);

      for (const b of bricks) {
        const dim = b.hp > 1 ? 1 : 0.82;
        ctx.globalAlpha = dim;
        glow(ctx, b.color, 8, () => {
          ctx.fillStyle = b.color;
          roundRect(ctx, b.x, b.y, b.w, b.h, 4);
          ctx.fill();
        });
        if (b.hp > 1) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, 2, 1);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // paddle
      glow(ctx, PAL.ion, 14, () => {
        ctx.fillStyle = PAL.ink;
        roundRect(ctx, paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, 6);
        ctx.fill();
      });
      ctx.fillStyle = PAL.ion;
      roundRect(ctx, paddle.x - paddle.w / 2, paddle.y, 8, paddle.h, 4);
      ctx.fill();
      roundRect(ctx, paddle.x + paddle.w / 2 - 8, paddle.y, 8, paddle.h, 4);
      ctx.fill();

      // ball
      glow(ctx, PAL.white, 16, () => {
        ctx.fillStyle = PAL.white;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // HUD row
      centerText(ctx, `LEVEL ${level}`, 10, 16, { size: 12, color: PAL.dim, align: "left" });
      const dots = "●".repeat(Math.max(0, lives));
      centerText(ctx, dots || "—", w - 10, 16, { size: 13, color: PAL.ember, align: "right" });

      if (ball.stuck) {
        centerText(ctx, "TAP / SPACE TO LAUNCH", w / 2, h - 54, { size: 12, color: PAL.dim });
      }
    },
  };
}
