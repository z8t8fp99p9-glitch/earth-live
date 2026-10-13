/* EARTH // LIVE local data store. IndexedDB records + Cache API response cache. */
(() => {
  'use strict';
  const DB_NAME='earth-live-local-data', DB_VERSION=1, STORE='records';
  let dbPromise;
  function open(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return;}
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Could not open local database'));
      req.onblocked=()=>reject(new Error('Local database upgrade is blocked'));
    });
    return dbPromise;
  }
  async function request(mode,fn){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
      let req;try{req=fn(store);}catch(e){reject(e);return;}
      tx.oncomplete=()=>resolve(req&&Object.prototype.hasOwnProperty.call(req,'result')?req.result:undefined);
      tx.onerror=()=>reject(tx.error||new Error('Database transaction failed'));
      tx.onabort=()=>reject(tx.error||new Error('Database transaction aborted'));
    });
  }
  async function put(type,id,data,ttlMs){
    const now=Date.now(),record={key:String(type)+':'+String(id),type:String(type),id:String(id),data,savedAt:now,expiresAt:ttlMs>0?now+ttlMs:0};
    await request('readwrite',store=>store.put(record));return true;
  }
  async function get(type,id){
    const record=await request('readonly',store=>store.get(String(type)+':'+String(id)));
    if(!record)return null;
    if(record.expiresAt&&record.expiresAt<=Date.now()){request('readwrite',store=>store.delete(record.key)).catch(()=>{});return null;}
    return {data:record.data,savedAt:record.savedAt,expiresAt:record.expiresAt||null};
  }
  async function removeExpired(){
    const now=Date.now();await request('readwrite',store=>{const req=store.openCursor();req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;if(cursor.value.expiresAt&&cursor.value.expiresAt<=now)cursor.delete();cursor.continue();};return req;});
  }
  async function cacheFirst(url,options){
    let cache=null,cached=null;
    try{if('caches' in window){cache=await caches.open('earth-live-data-v1');cached=await cache.match(url);}}catch(e){console.info('Cache API unavailable',e);}
    try{
      const response=await fetch(url,options);
      if(response.ok&&cache&&response.type!=='opaque'){try{await cache.put(url,response.clone());}catch(e){console.info('Response cache skipped',e);}}
      return response;
    }catch(error){if(cached)return cached;throw error;}
  }
  window.EarthLiveDataStore=Object.freeze({open,put,get,removeExpired,cacheFirst,databaseName:DB_NAME});
  open().then(removeExpired).catch(error=>console.info('Local database unavailable; online features can continue',error));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)removeExpired().catch(()=>{});});
})();
