const CACHE_PREFIX="doc-full-nr-";
const CACHE="doc-full-nr-v15-1-subject-rooms-20260911";
const SHELL=[
  "./","./index.html","./exam.html",
  "./styles.css?v=20260911-v15-1-rooms","./mobile.css?v=20260911-v15-1-rooms","./v15-tech.css?v=20260911-v15-1-rooms",
  "./camera-registration.js?v=20260911-v15-1-rooms","./app.js?v=20260911-v15-1-rooms","./mobile.js?v=20260911-v15-1-rooms","./v15-platform.js?v=20260911-v15-1-rooms","./v15-exam.js?v=20260911-v15-1-rooms",
  "./manifest.webmanifest?v=20260911-v15-1-rooms",
  "./icons/icon-48.png","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png"
];
self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of SHELL){
      try{const response=await fetch(url,{cache:"no-store"});if(response.ok&&response.status===200)await cache.put(url,response.clone())}catch{}
    }
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  const scopePath=new URL(self.registration.scope).pathname;if(!url.pathname.startsWith(scopePath))return;
  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{const response=await fetch(request,{cache:"no-store"});if(response.ok){const cache=await caches.open(CACHE);cache.put(request,response.clone())}return response}
      catch{return (await caches.match(request))||(await caches.match("./index.html"))||Response.error()}
    })());return;
  }
  event.respondWith((async()=>{
    try{const response=await fetch(request,{cache:"no-store"});if(response.ok&&response.status===200){const cache=await caches.open(CACHE);cache.put(request,response.clone())}return response}
    catch{return (await caches.match(request))||Response.error()}
  })());
});
