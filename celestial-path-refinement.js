/* EARTH // LIVE v1.53  - natural broad arc alignment. Astronomical altitude remains controlled by the celestial calculators. */
(()=>{'use strict';
 const moon=document.getElementById('skyMoon'),dir=document.getElementById('skyDirection');
 if(!moon||!dir)return;
 const apply=()=>{
   const m=dir.textContent.match(/(\d+(?:\.\d+)?)°/);if(!m)return;
   const az=Number(m[1]);
   // Map the visible southern-sky sweep from east (90°) through south (180°) to west (270°).
   // Outside that sweep, smoothly ease toward the nearest edge instead of jumping across the screen.
   let progress=(az-90)/180;
   if(progress<0)progress=0;
   if(progress>1)progress=1;
   const x=6+88*progress;
   const altMatch=dir.textContent.match(/·\s*(\d+(?:\.\d+)?)° altitude/);
   const altitude=altMatch?Number(altMatch[1]):0;
   moon.style.left=x+'%';
   moon.style.bottom=(34+Math.max(0,Math.min(65,altitude))*.75)+'%';
 };
 new MutationObserver(apply).observe(dir,{childList:true,characterData:true,subtree:true});
 window.addEventListener('resize',apply,{passive:true});
 apply();
})();
