/* EARTH // LIVE v1.104 — SMART CODING: share the rendered thumb-size variable with label geometry. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const range = $('sunTimeRange');
  if (!range) return;
  const rise = $('sunRiseTimeFloat'), set = $('sunSetTimeFloat');
  const current = $('sunCurrentTimeFloat'), extra = $('sunExtraInfoFloat');
  const start = $('sunStartLabel'), end = $('sunEndLabel');
  const readout = $('sunTimeReadout'), direction = $('sunSkyDirection'), status = $('sunSkyStatus');
  const tidy = value => (value || '—').replace(/\s+/g, ' ').trim();
  function sync() {
    if (rise && start) rise.textContent = tidy(start.textContent);
    if (set && end) set.textContent = tidy(end.textContent);
    if (current && readout) current.textContent = tidy(readout.textContent || readout.value);
    if (extra) {
      const dir = direction ? tidy(direction.textContent) : '';
      const state = status ? tidy(status.textContent).split('·').pop().trim() : '';
      extra.textContent = [dir, state].filter(Boolean).join('  ·  ');
    }
    const panel = range.closest('.sun-panel');
    if (!panel || !current) return;
    const min = Number(range.min) || 0;
    const max = Number(range.max) || 1;
    const fraction = Math.max(0, Math.min(1, (Number(range.value) - min) / (max - min || 1)));
    const rangeRect = range.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const thumbSize = getComputedStyle(range).getPropertyValue('--sun-thumb-size').trim();
    const thumb = range.matches(':disabled') ? 0 : (Number.parseFloat(thumbSize) || 40);
    // Native range thumb centers travel between the thumb-radius inset edges.
    const x = rangeRect.left + thumb / 2 + (rangeRect.width - thumb) * fraction;
    const half = current.offsetWidth / 2;
    const bounded = Math.max(panelRect.left + half + 4, Math.min(panelRect.right - half - 4, x));
    current.style.left = `${bounded - panelRect.left}px`;
  }
  const scheduleSync = () => requestAnimationFrame(sync);
  range.addEventListener('input', scheduleSync, {passive:true});
  range.addEventListener('change', sync);
  window.addEventListener('resize', scheduleSync, {passive:true});
  window.addEventListener('orientationchange', () => setTimeout(sync, 60), {passive:true});
  const observer = new MutationObserver(scheduleSync);
  [start,end,readout,direction,status].filter(Boolean).forEach(el => observer.observe(el,{childList:true,subtree:true,characterData:true,attributes:true}));
  document.addEventListener('click', e => { if (e.target && e.target.closest('#sunBtn')) setTimeout(sync, 80); });
  window.addEventListener('earthlive:sun-updated', sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync).catch(()=>{});
  sync();
})();
