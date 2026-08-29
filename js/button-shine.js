/* ==========================================================================
   Button shine — cursor-follow specular glow.

   Pairs with the CSS glare-sweep-on-hover already defined on .btn,
   .theme-toggle, .nav__toggle and .type-btn (see styles.css). This part
   handles the "SpecularButton"-style proximity glow: a soft highlight
   that tracks the cursor and fades in as it nears a button, even before
   the cursor is directly over it.

   Skipped entirely on touch devices (no persistent cursor to track) and
   when the user prefers reduced motion.
   ========================================================================== */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const SELECTOR = '.btn, .theme-toggle, .nav__toggle, .type-btn';
  const PROXIMITY = 130; // px beyond the button's own edge that starts the glow

  const buttons = Array.from(document.querySelectorAll(SELECTOR));
  if (!buttons.length) return;

  let pointerX = -9999;
  let pointerY = -9999;
  let ticking = false;
  let active = false;

  function update() {
    ticking = false;
    let anyNear = false;

    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // hidden (e.g. collapsed mobile menu)

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = pointerX - cx;
      const dy = pointerY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const reach = Math.max(rect.width, rect.height) / 2 + PROXIMITY;

      if (dist < reach) {
        anyNear = true;
        const localX = pointerX - rect.left;
        const localY = pointerY - rect.top;
        btn.style.setProperty('--shine-x', localX + 'px');
        btn.style.setProperty('--shine-y', localY + 'px');
        btn.style.setProperty('--shine-o', '1');
      } else if (btn.style.getPropertyValue('--shine-o') !== '0') {
        btn.style.setProperty('--shine-o', '0');
      }
    }

    active = anyNear;
  }

  function onPointerMove(e) {
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  window.addEventListener('pointerleave', () => {
    pointerX = -9999;
    pointerY = -9999;
    buttons.forEach((btn) => btn.style.setProperty('--shine-o', '0'));
  });

  // Button positions shift on resize/scroll (sticky header, layout changes);
  // re-evaluate against the last known pointer position so the glow doesn't
  // stay stuck mid-air over a button that has moved.
  let resizeTick = false;
  window.addEventListener('resize', () => {
    if (resizeTick) return;
    resizeTick = true;
    requestAnimationFrame(() => { resizeTick = false; if (active) update(); });
  });
})();
