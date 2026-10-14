/* EARTH // LIVE v1.52 — broad viewport-spanning Moon arc adapter. */
(()=>{'use strict';
 const moon=document.getElementById('skyMoon'),dir=document.getElementById('skyDirection');
 if(!moon||!dir)return;
 const apply=()=>{const m=dir.textContent.match(/(\d+(?:\.\d+)?)°/);if(!m)return;const az=Number(m[1]);
   /* Azimuth 90° (east) starts left; 270° (west) finishes right. */
   const x=50-44*Math.sin(az*Math.PI/180);
   moon.style.left=Math.max(6,Math.min(94,x))+'%';
 };
 new MutationObserver(apply).observe(dir,{childList:true,characterData:true,subtree:true});
 window.addEventListener('resize',apply,{passive:true});
})();
