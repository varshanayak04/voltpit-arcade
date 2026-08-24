/**
 * motion.js — every scroll and pointer effect on the page.
 *
 * Two rules hold throughout:
 *  1. Progressive enhancement. Markup ships visible; the reveal class is added
 *     by JS, so if this file never runs the page is still readable.
 *  2. One rAF loop. All scroll-linked work (marquee, card stack, char reveal,
 *     progress bar) is measured in a single pass to avoid layout thrash.
 */

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

export function prefersReduced() {
  return reduced.matches;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------- reveal on enter */

export function initReveals() {
  const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!nodes.length) return;

  for (const el of nodes) {
    const rx = el.dataset.rx ? `${el.dataset.rx}px` : "0px";
    const ry = el.dataset.ry ? `${el.dataset.ry}px` : "30px";
    el.style.setProperty("--rx", rx);
    el.style.setProperty("--ry", ry);
    if (el.dataset.delay) el.style.setProperty("--delay", `${el.dataset.delay}s`);
    el.classList.add("reveal");
  }

  if (prefersReduced() || !("IntersectionObserver" in window)) {
    nodes.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -50px 0px", threshold: 0 }
  );

  nodes.forEach((el) => io.observe(el));
}

/* -------------------------------------------------------------- magnetic */

/**
 * Pulls an element toward the cursor once the cursor is within `padding` of its
 * bounds. Movement is divided by `strength`, so a higher strength is subtler.
 */
export function initMagnet(el, { padding = 150, strength = 3 } = {}) {
  if (!el || prefersReduced()) return () => {};
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};

  let pulled = false;

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const withinX = Math.abs(e.clientX - cx) < r.width / 2 + padding;
    const withinY = Math.abs(e.clientY - cy) < r.height / 2 + padding;

    if (withinX && withinY) {
      if (!pulled) {
        pulled = true;
        el.classList.add("is-pulled");
      }
      const dx = (e.clientX - cx) / strength;
      const dy = (e.clientY - cy) / strength;
      el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
    } else if (pulled) {
      pulled = false;
      el.classList.remove("is-pulled");
      el.style.transform = "translate3d(0, 0, 0)";
    }
  };

  window.addEventListener("mousemove", onMove, { passive: true });
  return () => window.removeEventListener("mousemove", onMove);
}

/** Lighter version for buttons: same idea, much smaller travel. */
export function initMagneticButtons(selector = "[data-magnetic]") {
  if (prefersReduced()) return;
  const els = document.querySelectorAll(selector);
  for (const el of els) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / 6;
      const dy = (e.clientY - (r.top + r.height / 2)) / 6;
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  }
}

/* ------------------------------------------------------- character reveal */

/**
 * Splits text into spans once, then lights them up left to right as the block
 * crosses the viewport. Screen readers still read the original sentence because
 * the spans are inline and contain the same characters.
 */
export function splitChars(el) {
  if (!el || el.dataset.split === "done") return [];
  const text = el.textContent.replace(/\s+/g, " ").trim();
  el.textContent = "";
  const spans = [];
  for (const ch of text) {
    const s = document.createElement("span");
    s.textContent = ch;
    if (ch === " ") s.classList.add("is-lit");
    el.appendChild(s);
    spans.push(s);
  }
  el.dataset.split = "done";
  return spans;
}

/* ------------------------------------------------------------ scroll loop */

export function initScrollEffects({ marquee, stack, chars, progress } = {}) {
  const rowNodes = marquee ? Array.from(marquee.querySelectorAll(".marquee__row")) : [];
  const stackItems = stack ? Array.from(stack.querySelectorAll(".floor__item")) : [];
  const charSpans = chars && !prefersReduced() ? splitChars(chars) : [];
  if (chars && prefersReduced()) splitChars(chars).forEach((s) => s.classList.add("is-lit"));

  let ticking = false;
  let lastLit = -1;

  const railH = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--rail-h");
    const n = parseFloat(v);
    return Number.isFinite(n) ? n * 16 : 68;
  };

  function frame() {
    ticking = false;
    const scrollY = window.scrollY || window.pageYOffset;
    const vh = window.innerHeight;

    /* scroll progress bar */
    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      progress.style.setProperty("--progress", max > 0 ? clamp01(scrollY / max).toFixed(4) : "0");
    }

    /* marquee: rows slide in opposite directions, driven by scroll position */
    if (rowNodes.length && !prefersReduced()) {
      const top = marquee.offsetTop;
      const offset = (scrollY - top + vh) * 0.3;
      const x = offset - 200;
      rowNodes[0].style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      if (rowNodes[1]) rowNodes[1].style.transform = `translate3d(${(-x).toFixed(1)}px, 0, 0)`;
    }

    /* sticky card stack: each card shrinks a little for every later card that
       has slid over it, so the first cabinet ends up furthest back */
    if (stackItems.length && !prefersReduced()) {
      const stickyTop = railH() + 24;
      const arrivals = stackItems.map((item) => {
        const rect = item.getBoundingClientRect();
        const itemTop = rect.top + scrollY;
        return clamp01((scrollY - (itemTop - stickyTop)) / Math.max(1, rect.height));
      });
      for (let i = 0; i < stackItems.length; i++) {
        let s = 0;
        for (let j = i + 1; j < arrivals.length; j++) s += arrivals[j];
        const card = stackItems[i].firstElementChild;
        if (!card) continue;
        card.style.setProperty("--sc", (1 - 0.03 * s).toFixed(4));
        card.style.filter = s > 0.01 ? `brightness(${lerp(1, 0.62, clamp01(s / 2)).toFixed(3)})` : "";
      }
    }

    /* character reveal across the About paragraph */
    if (charSpans.length) {
      const r = chars.getBoundingClientRect();
      // matches "start 0.8 -> end 0.2": begins when the top passes 80% of the
      // viewport, completes when the bottom passes 20%
      const startAt = vh * 0.8;
      const endAt = vh * 0.2;
      const total = r.height + (startAt - endAt);
      const travelled = startAt - r.top;
      const p = clamp01(travelled / Math.max(1, total));
      const lit = Math.round(p * charSpans.length);
      if (lit !== lastLit) {
        if (lit > lastLit) {
          for (let i = Math.max(0, lastLit); i < lit; i++) charSpans[i].classList.add("is-lit");
        } else {
          for (let i = lit; i < charSpans.length; i++) {
            if (charSpans[i].textContent !== " ") charSpans[i].classList.remove("is-lit");
          }
        }
        lastLit = lit;
      }
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  requestAnimationFrame(frame);
  return onScroll;
}

/* -------------------------------------------------------- current section */

export function initNavHighlight() {
  const links = Array.from(document.querySelectorAll(".rail__link"));
  const map = new Map();
  for (const link of links) {
    const id = link.getAttribute("href")?.slice(1);
    const section = id && document.getElementById(id);
    if (section) map.set(section, link);
  }
  if (!map.size || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const link = map.get(entry.target);
        if (!link) continue;
        if (entry.isIntersecting) {
          links.forEach((l) => l.removeAttribute("aria-current"));
          link.setAttribute("aria-current", "true");
        }
      }
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );

  map.forEach((_, section) => io.observe(section));
}

/* --------------------------------------------------------- custom cursor */

export function initCursor() {
  const ring = document.getElementById("cursorRing");
  const dot = document.getElementById("cursorDot");
  if (!ring || !dot) return;
  if (prefersReduced()) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const root = document.documentElement;
  root.classList.add("cursor-on");

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let rx = tx;
  let ry = ty;

  window.addEventListener(
    "pointermove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
      dot.style.transform = `translate(${tx}px, ${ty}px)`;
      const hot = e.target instanceof Element && e.target.closest("a, button, [data-magnetic], input");
      root.classList.toggle("is-hot", Boolean(hot));
    },
    { passive: true }
  );

  window.addEventListener("pointerdown", () => root.classList.add("is-down"));
  window.addEventListener("pointerup", () => root.classList.remove("is-down"));
  document.addEventListener("pointerleave", () => {
    ring.style.opacity = "0";
    dot.style.opacity = "0";
  });
  document.addEventListener("pointerenter", () => {
    ring.style.opacity = "";
    dot.style.opacity = "";
  });

  (function follow() {
    rx = lerp(rx, tx, 0.18);
    ry = lerp(ry, ty, 0.18);
    ring.style.transform = `translate(${rx.toFixed(2)}px, ${ry.toFixed(2)}px)`;
    requestAnimationFrame(follow);
  })();
}
