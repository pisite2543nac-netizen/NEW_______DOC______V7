const CACHE_PREFIX="doc-full-nr-";
const CACHE="doc-full-nr-v12-tech-academic-20260910";
const SHELL=[
  "./","./index.html","./exam.html",
  "./styles.css?v=20260910-v10",
  "./mobile.css?v=20260910-v10",
  "./v9-features.css?v=20260910-v10",
  "./subject-bundles.css?v=20260910-v12",
  "./v12-tech.css?v=20260910-v12",
  "./camera-registration.js?v=20260910-v10",
  "./app.js?v=20260910-v10",
  "./mobile.js?v=20260910-v10",
  "./subject-bundles.js?v=20260910-v12",
  "./v9-features.js?v=20260910-v12",
  "./v12-system.js?v=20260910-v12",
  "./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"
];
self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of SHELL){
      const response=await fetch(url,{cache:"no-store"});
      if(!response.ok)throw new Error(`PRE_CACHE_FAILED ${url} ${response.status}`);
      await cache.put(url,response);
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
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  const scopePath=new URL(self.registration.scope).pathname;
  if(!url.pathname.startsWith(scopePath))return;
  const isNavigation=request.mode==="navigate";
  if(isNavigation){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{cache:"no-store"});
        if(response.ok){const cache=await caches.open(CACHE);cache.put(request,response.clone());}
        return response;
      }catch{
        return (await caches.match(request))||(await caches.match("./index.html"))||Response.error();
      }
    })());
    return;
  }
  event.respondWith((async()=>{
    try{
      const response=await fetch(request,{cache:"no-store"});
      if(response.ok&&response.status===200){const cache=await caches.open(CACHE);cache.put(request,response.clone());}
      return response;
    }catch{
      return (await caches.match(request))||Response.error();
    }
  })());
});
