/* EARTH // LIVE v1.99.9 — independent deck and orb family selector. */
(()=>{'use strict';
 const app=document.getElementById('app'); if(!app)return;
 const validDecks=['glass','sand'],validOrbs=['futuristic','sand'];
 const read=(key,allowed,fallback)=>{try{const v=localStorage.getItem(key);return allowed.includes(v)?v:fallback}catch(_){return fallback}};
 const save=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};
 const setPressed=(selector,attribute,current)=>document.querySelectorAll(selector).forEach(btn=>{const selected=btn.getAttribute(attribute)===current;btn.classList.toggle('is-selected',selected);btn.setAttribute('aria-pressed',String(selected));});
 function applyOrbAssets(family){document.querySelectorAll('#app .bottom-ui img[data-orb-key]').forEach(img=>{const key=family==='sand'?'sandSrc':'glassSrc';const src=img.dataset[key];if(src&&img.getAttribute('src')!==src)img.setAttribute('src',src);});}
 function setDeck(value,persist=true){if(!validDecks.includes(value))value='glass';app.dataset.deckFamily=value;setPressed('[data-deck-choice]','data-deck-choice',value);if(persist)save('earthLiveDeckFamily',value);}
 function setOrb(value,persist=true){if(!validOrbs.includes(value))value='futuristic';app.dataset.orbFamily=value;applyOrbAssets(value);setPressed('[data-orb-choice]','data-orb-choice',value);if(persist)save('earthLiveOrbFamily',value);}
 document.querySelectorAll('[data-deck-choice]').forEach(btn=>btn.addEventListener('click',()=>setDeck(btn.getAttribute('data-deck-choice'))));
 document.querySelectorAll('[data-orb-choice]').forEach(btn=>btn.addEventListener('click',()=>setOrb(btn.getAttribute('data-orb-choice'))));
 setDeck(read('earthLiveDeckFamily',validDecks,'glass'),false);setOrb(read('earthLiveOrbFamily',validOrbs,'futuristic'),false);
})();
