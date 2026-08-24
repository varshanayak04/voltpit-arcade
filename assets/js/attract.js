/**
 * attract.js — the looping demo on the hero cabinet's CRT.
 *
 * A tiny self-playing snake that never dies (it chases food with a safe
 * greedy step). Pure decoration: no score, no input, and it pauses itself when
 * the hero scrolls out of view so it is not burning frames off-screen.
 */

import { PAL } from "./games/base.js";

export function initAttract(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  const COLS = 20;
  const ROWS = 15;
  let cell = 16;
  let snake = [];
  let dir = { x: 1, y: 0 };
  let food = { x: 10, y: 7 };
  let acc = 0;
  let raf = 0;
  let last = 0;
  let visible = true;
  let hue = 0;

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(160, Math.round(rect.width * dpr));
    canvas.height = Math.max(120, Math.round(rect.height * dpr));
    cell = Math.min(canvas.width / COLS, canvas.height / ROWS);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function reset() {
    snake = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ];
    dir = { x: 1, y: 0 };
    placeFood();
  }

  function placeFood() {
    let f;
    let guard = 0;
    do {
      f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      guard++;
    } while (guard < 200 && snake.some((s) => s.x === f.x && s.y === f.y));
    food = f;
  }

  // greedy but self-avoiding: prefer the axis with the larger gap, and never
  // pick a move that hits the body or reverses
  function think() {
    const head = snake[0];
    const options = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].filter((d) => !(d.x === -dir.x && d.y === -dir.y));

    const scored = options
      .map((d) => {
        const nx = (head.x + d.x + COLS) % COLS;
        const ny = (head.y + d.y + ROWS) % ROWS;
        const hitsBody = snake.slice(0, -1).some((s) => s.x === nx && s.y === ny);
        const dist = Math.abs(nx - food.x) + Math.abs(ny - food.y);
        return { d, dist, hitsBody };
      })
      .filter((o) => !o.hitsBody);

    if (!scored.length) {
      reset();
      return;
    }
    scored.sort((a, b) => a.dist - b.dist);
    // 80% of the time chase the food, otherwise wander so it is not robotic
    dir = (Math.random() < 0.82 ? scored[0] : scored[Math.floor(Math.random() * scored.length)]).d;
  }

  function stepSnake() {
    think();
    const head = {
      x: (snake[0].x + dir.x + COLS) % COLS,
      y: (snake[0].y + dir.y + ROWS) % ROWS,
    };
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      placeFood();
      if (snake.length > 26) snake.length = 20; // keep it lively
    } else {
      snake.pop();
    }
  }

  function draw() {
    const w = canvas.width / (Math.min(2, window.devicePixelRatio || 1));
    const h = canvas.height / (Math.min(2, window.devicePixelRatio || 1));
    ctx.fillStyle = PAL.screen;
    ctx.fillRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = "rgba(215,226,234,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, ROWS * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(COLS * cell, y * cell);
      ctx.stroke();
    }

    // food
    ctx.save();
    ctx.shadowColor = PAL.ember;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PAL.ember;
    ctx.beginPath();
    ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // snake
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const t = 1 - i / snake.length;
      ctx.fillStyle = i === 0 ? "#ffffff" : `rgba(255,47,208,${(0.3 + t * 0.6).toFixed(2)})`;
      const pad = cell * 0.14;
      ctx.fillRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(0.06, (now - last) / 1000);
    last = now;
    acc += dt;
    hue += dt;
    if (acc >= 0.16) {
      acc = 0;
      stepSnake();
    }
    draw();
  }

  fit();
  reset();
  draw();

  if (reduced.matches) {
    // draw a single static frame, no animation
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) last = performance.now();
    },
    { threshold: 0.05 }
  );
  io.observe(canvas);

  window.addEventListener("resize", fit, { passive: true });
  last = performance.now();
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener("resize", fit);
  };
}
