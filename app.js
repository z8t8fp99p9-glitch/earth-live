(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = $('globe'), loading = $('loading'), detail = $('detail');
  const detailTitle = $('detailTitle'), detailText = $('detailText'), detailLink = $('detailLink');
  const count = $('eventCount'), updated = $('updated');
  let quakeRings = [];
  const quakeBtn = $('quakeBtn'), citiesBtn = $('citiesBtn'), orbitBtn = $('orbitBtn'), refreshBtn = $('refresh');
  if (!window.Globe) {
    loading.textContent = 'THE GLOBE LIBRARY COULD NOT LOAD. CHECK YOUR CONNECTION AND RELOAD.';
    $('eventCount').textContent = 'OFFLINE';
    updated.textContent = 'Map engine unavailable';
    return;
  }
  const cities = [
    {name:'New Delhi',lat:28.6139,lng:77.2090,description:'India · capital region'},
    {name:'Mumbai',lat:19.076,lng:72.8777,description:'India · major city'},
    {name:'Tokyo',lat:35.6762,lng:139.6503,description:'Japan · major city'},
    {name:'London',lat:51.5072,lng:-0.1276,description:'United Kingdom · major city'},
    {name:'New York',lat:40.7128,lng:-74.006,description:'United States · major city'},
    {name:'São Paulo',lat:-23.5505,lng:-46.6333,description:'Brazil · major city'},
    {name:'Cairo',lat:30.0444,lng:31.2357,description:'Egypt · major city'},
    {name:'Sydney',lat:-33.8688,lng:151.2093,description:'Australia · major city'},
    {name:'Singapore',lat:1.3521,lng:103.8198,description:'Singapore · major city'},
    {name:'Dubai',lat:25.2048,lng:55.2708,description:'United Arab Emirates · major city'}
  ];
  let quakes = [], showQuakes = true, showCities = false, orbital = true, refreshTimer;

  // Progressive loading: start with a lighter Earth, then enhance it with our detailed relief.
  const starterEarthTexture = 'https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg';
  const world = Globe()(el)
    .globeImageUrl(starterEarthTexture)
    .backgroundImageUrl('https://unpkg.com/three-globe@2.41.12/example/img/night-sky.png')
    .showAtmosphere(true).atmosphereColor('#4aa6ff').atmosphereAltitude(0.18)
    .pointsData([]).pointLat('lat').pointLng('lng').pointAltitude('alt')
    .pointRadius('radius').pointColor('color')
    .pointLabel(d => d.label || d.name || 'Location')
    .ringsData([]).ringLat('lat').ringLng('lng').ringColor(d => [d.ringColor, d.ringColorFade])
    .ringMaxRadius('ringSize').ringPropagationSpeed(d => d.ringSpeed).ringRepeatPeriod(d => d.ringPeriod)
    .onPointClick(d => {
      detail.style.display = 'block';
      detailTitle.textContent = d.title || d.name || 'LOCATION';
      detailText.textContent = d.description || d.label || 'Map location';
      if (detailLink) {
        if (d.url) { detailLink.href = d.url; detailLink.style.display = 'inline-block'; }
        else { detailLink.removeAttribute('href'); detailLink.style.display = 'none'; }
      }
    });

  const resize = () => world.width(el.clientWidth).height(el.clientHeight);
  window.addEventListener('resize', resize, {passive:true}); resize();
  world.pointOfView({lat:20,lng:15,altitude:2.4},0);
  const controls = world.controls();
  controls.autoRotate = true; controls.autoRotateSpeed = 0.28;
  controls.enableDamping = true; controls.dampingFactor = 0.08;

  let reliefEnhancementStarted = false;
  world.onGlobeReady(() => {
    // Hide the initializing overlay as soon as the starter globe is ready.
    loading.style.display = 'none';

    // Give the first globe a chance to paint before downloading the large local textures.
    if (!reliefEnhancementStarted) {
      reliefEnhancementStarted = true;
      window.setTimeout(() => {
        world.globeImageUrl('./earth-relief-skin.jpg');
        // Add the large bump map later so it does not delay the first visible Earth.
        window.setTimeout(() => world.bumpImageUrl('./earth-relief-bump.jpg'), 1800);
      }, 700);
    }

    // Aligned experimental bump map derived from the exact same skin pixels.
    // This strengthens apparent relief but does not physically displace the mesh.
    try {
      const material = world.globeMaterial();
      if (material) {
        material.bumpScale = 0.42;
        material.shininess = 5;
        if (material.specular && material.specular.set) material.specular.set('#536b80');
        material.needsUpdate = true;
      }
    } catch (err) { console.warn('Optional terrain shading unavailable.', err); }
  });

  function renderPoints() {
    let points = [];
    if (showQuakes) points = points.concat(quakes);
    if (showCities) points = points.concat(cities.map(c => ({
      ...c, alt:0.004, radius:0.16, color:'#6be7ff', label:c.name, title:c.name
    })));
    world.pointsData(points);
    world.ringsData(showQuakes ? quakeRings : []);
    count.textContent = (showQuakes ? quakes.length : 0) + ' QUAKES';
    quakeBtn.setAttribute('aria-pressed', String(showQuakes));
    citiesBtn.setAttribute('aria-pressed', String(showCities));
    orbitBtn.setAttribute('aria-pressed', String(orbital));
  }

  async function loadQuakes() {
    refreshBtn.disabled = true; updated.textContent = 'Refreshing USGS public feed…';
    try {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {cache:'no-store'});
      if (!res.ok) throw new Error('USGS response ' + res.status);
      const data = await res.json();
      quakes = (data.features || []).filter(f => f.geometry && f.geometry.coordinates).map(f => {
        const p = f.properties || {}, c = f.geometry.coordinates, mag = Number(p.mag) || 0, place = p.place || 'Location unavailable';
        const eventDate = p.time ? new Date(p.time) : null;
        const time = eventDate ? eventDate.toLocaleString(undefined, {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZoneName:'short'}) : 'Time unavailable';
        const depth = Number.isFinite(c[2]) ? c[2].toFixed(1) + ' km' : 'Unavailable';
        return {
          lat:c[1], lng:c[0], alt:Math.min(0.12,0.012+Math.max(0,mag)*0.012),
          radius:Math.max(0.12,Math.min(0.7,Math.max(0.5,mag)*0.13)),
          color:mag>=5?'#ff5d73':mag>=3?'#ffb15e':'#6be7ff',
          title:'EARTHQUAKE · M' + mag.toFixed(1),
          label:'M' + mag.toFixed(1) + ' · ' + place,
          description:'Magnitude: ' + mag.toFixed(1) + '\nLocation: ' + place + '\nDepth: ' + depth + '\nLocal event time: ' + time,
          url:p.url || null,
          magnitude:mag, eventTime:Number(p.time)||0,
          ringColor:mag>=5?'rgba(255,77,104,0.88)':mag>=3?'rgba(255,145,77,0.78)':'rgba(107,231,255,0.58)',
          ringColorFade:mag>=5?'rgba(255,77,104,0.03)':mag>=3?'rgba(255,145,77,0.02)':'rgba(107,231,255,0.01)',
          ringSize:Math.max(0.7,Math.min(5.5,0.65+Math.max(0,mag)*0.68)),
          ringSpeed:mag>=5?2.2:mag>=3?1.5:0.9,
          ringPeriod:mag>=5?950:mag>=3?1350:1900
        };
      });
      // Keep the strongest/recent events visually represented without overwhelming the globe.
      quakeRings = quakes.filter(q => q.magnitude >= 2.5)
        .sort((a,b) => b.magnitude-a.magnitude || b.eventTime-a.eventTime).slice(0,180);
      updated.textContent = 'USGS refreshed ' + new Date().toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', hour12:true, timeZoneName:'short'});
      renderPoints();
    } catch (err) {
      updated.textContent = 'Live feed unavailable. Try refresh when online.';
      count.textContent = 'FEED OFFLINE';
    } finally { refreshBtn.disabled = false; }
  }

  function setActive(btn, on) { btn.classList.toggle('active', on); }
  quakeBtn.addEventListener('click', () => { showQuakes = !showQuakes; setActive(quakeBtn,showQuakes); renderPoints(); });
  citiesBtn.addEventListener('click', () => { showCities = !showCities; setActive(citiesBtn,showCities); renderPoints(); });
  orbitBtn.addEventListener('click', () => {
    orbital = !orbital; controls.autoRotate = orbital; setActive(orbitBtn,orbital);
    world.pointOfView(orbital ? {lat:0,lng:0,altitude:3.2} : {lat:20,lng:15,altitude:2.4},900);
    renderPoints();
  });
  refreshBtn.addEventListener('click', loadQuakes);
  loadQuakes();
  refreshTimer = setInterval(loadQuakes, 5 * 60 * 1000);
  window.addEventListener('pagehide', () => clearInterval(refreshTimer), {once:true});
})();
