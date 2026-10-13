(() => {
  const version = '1.12';
  document.documentElement.dataset.appVersion = version;
  const title = document.querySelector('title');
  if (title) title.textContent = `EARTH // LIVE — v${version}`;
  const label = document.getElementById('appVersion');
  if (label) label.textContent = `v${version}`;
})();
