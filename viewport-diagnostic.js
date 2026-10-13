/* Temporary EARTH // LIVE viewport diagnostic. Remove after screenshots are collected. */
(() => {
  'use strict';
  const panel = document.createElement('div');
  panel.id = 'viewportDiagnostic';
  panel.setAttribute('role', 'status');
  panel.style.cssText = [
    'position:fixed','z-index:99999','top:calc(env(safe-area-inset-top,0px) + 72px)',
    'right:8px','width:min(270px,calc(100vw - 16px))','max-height:48vh','overflow:auto',
    'padding:10px 11px','border:1px solid rgba(120,207,255,.65)','border-radius:10px',
    'background:rgba(3,8,15,.90)','color:#f5f9ff','font:11px/1.42 ui-monospace,SFMono-Regular,Menlo,monospace',
    'white-space:pre-wrap','overflow-wrap:anywhere','box-shadow:0 6px 22px rgba(0,0,0,.4)',
    'pointer-events:auto','-webkit-user-select:text','user-select:text'
  ].join(';');
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label','Close viewport diagnostics');
  close.style.cssText = 'float:right;margin:-3px -3px 4px 8px;border:0;border-radius:5px;background:#24445b;color:white;font-size:18px;width:27px;height:25px;';
  close.addEventListener('click', () => panel.remove());
  const text = document.createElement('div');
  panel.append(close, text);
  function rect(el) {
    if (!el) return 'not found';
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width)}×${Math.round(r.height)} @ ${Math.round(r.top)},${Math.round(r.left)}`;
  }
  function safeArea(side) {
    const p = document.createElement('div');
    p.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side},0px)`;
    document.body.appendChild(p);
    const v = parseFloat(getComputedStyle(p).getPropertyValue(`padding-${side}`)) || 0;
    p.remove();
    return Math.round(v);
  }
  function update() {
    if (!panel.isConnected) return;
    const vv = window.visualViewport;
    const app = document.getElementById('app');
    const globe = document.getElementById('globe');
    const canvas = document.querySelector('#globe canvas');
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
    const appHeight = app ? Math.round(app.getBoundingClientRect().height) : 0;
    text.textContent =
      `VIEWPORT TEST • ${document.documentElement.dataset.appVersion || 'version ?'}\n` +
      `MODE: ${standalone ? 'HOME SCREEN APP' : 'SAFARI / BROWSER'}\n` +
      `screen: ${screen.width}×${screen.height}\n` +
      `inner: ${innerWidth}×${innerHeight}\n` +
      `visual: ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} y=${Math.round(vv.offsetTop)}` : 'unavailable'}\n` +
      `document: ${document.documentElement.clientWidth}×${document.documentElement.clientHeight}\n` +
      `safe top/bottom: ${safeArea('top')}/${safeArea('bottom')}\n` +
      `#app: ${rect(app)}\n` +
      `#globe: ${rect(globe)}\n` +
      `canvas: ${rect(canvas)}\n` +
      `app height vs screen: ${appHeight} / ${screen.height}\n` +
      `standalone flag: ${String(window.navigator.standalone)}\n` +
      `time: ${new Date().toLocaleTimeString()}\n\n` +
      `Please screenshot this panel in Safari and in the Home Screen app.`;
  }
  function attach() {
    if (!document.body.contains(panel)) document.body.appendChild(panel);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, {once:true});
  else attach();
  ['resize','orientationchange','pageshow','focus'].forEach(evt => window.addEventListener(evt, update, {passive:true}));
  document.addEventListener('visibilitychange', update);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', update, {passive:true});
    window.visualViewport.addEventListener('scroll', update, {passive:true});
  }
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(update);
    const app = document.getElementById('app');
    if (app) ro.observe(app);
  }
})();
