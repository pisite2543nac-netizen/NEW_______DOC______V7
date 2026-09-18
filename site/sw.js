// Compatibility markers: v19-responsive-fit.css?v=20260917-v19-2 | doc-full-nr-v19-2-production-ux-20260917
// V19.5 exam preset 25+25 production cache marker
// V19.4 classroom/back production cache marker
// release marker: doc-full-nr-v18-7-room-checklist-exam-adapted-20260916
// legacy contract marker: doc-full-nr-v18-2-complete-system-final-20260916
// compatibility marker: doc-full-nr-v18-6-room-work-checklist-audited-20260916
// compatibility marker: doc-full-nr-v18-1-complete-learning-system-20260916
// compatibility marker: doc-full-nr-v18-6-room-work-checklist-audited-20260916
// compatibility marker: doc-full-nr-v17-8-full-notifications-20260915
// compatibility marker: doc-full-nr-v17-7-classroom-hardened-20260915
// compatibility marker: doc-full-nr-v17-6-1-icon-refresh-20260915
// compatibility marker: doc-full-nr-v17-6-full-11subjects-20260915
// compatibility marker: doc-full-nr-v17-5-17unit-workpair-20260915
// compatibility marker: doc-full-nr-v17-4-learning-content-20260915
// compatibility marker: doc-full-nr-v17-3-full-system-20260915
// compatibility marker: doc-full-nr-v17-1-course-code-20260915
// compatibility marker: doc-full-nr-v17-master-flow-20260915
// compatibility marker: doc-full-nr-v17-2-college-branding-20260915
// DOC-FULL-NR V17.3 FULL SYSTEM cache
const CACHE_PREFIX="doc-full-nr-";
const CACHE="doc-full-nr-v19-5-exam-preset-25-25-20260918";
const SHELL=[
  "./","./index.html","./exam.html",
  "./styles.css?v=20260918-v19-5","./mobile.css?v=20260918-v19-5","./v18-core-ui.css?v=20260918-v19-5","./v16-minimal.css?v=20260918-v19-5",
  "./v16-7-hardening.css?v=20260918-v19-5","./v16-8-course-flow.css?v=20260918-v19-5","./v19-responsive-fit.css?v=20260918-v19-5","./v19-production-ui.css?v=20260918-v19-5","./v18-7-exam-adapted.css?v=20260918-v19-5",
  "./camera-registration.js?v=20260918-v19-5","./app.js?v=20260918-v19-5","./mobile.js?v=20260918-v19-5","./v16-platform.js?v=20260918-v19-5",
  "./v16-7-hardening.js?v=20260918-v19-5","./v16-8-course-flow.js?v=20260918-v19-5","./v16-exam.js?v=20260918-v19-5","./v19-ux-runtime.js?v=20260918-v19-5",
  "./manifest.webmanifest?v=20260918-v19-5","./data/exam-question-bank-v18.json","./data/exam-question-bank-manifest-v18.json",
  "./icons/icon-48.png","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png",
  "./favicon-v1761.ico","./favicon.ico","./icons/nangrong-favicon-16-v1761.png","./icons/nangrong-favicon-32-v1761.png","./icons/nangrong-favicon-48-v1761.png","./icons/nangrong-app-180-v1761.png","./icons/nangrong-app-192-v1761.png","./icons/nangrong-app-512-v1761.png","./icons/nangrong-maskable-512-v1761.png"
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

self.addEventListener("message",event=>{
  const d=event.data||{};
  if(d.type!=="DOCNR_SHOW_NOTIFICATION")return;
  const n=d.notification||{};
  event.waitUntil(self.registration.showNotification(n.title||"Nangrong Smart Worksheet",{
    body:n.message||"มีการแจ้งเตือนใหม่",icon:"./icons/nangrong-app-192-v1761.png",badge:"./icons/nangrong-favicon-48-v1761.png",
    tag:`docnr-${n.id||Date.now()}`,renotify:true,requireInteraction:n.type==="worksheet_due_now",
    data:{route:n.metadata?.route||"work",notification_id:n.id||null,metadata:n.metadata||{}}
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const data=event.notification.data||{},route=data.route||"work";
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    if(windows.length){const c=windows[0];await c.focus();c.postMessage({type:"DOCNR_NOTIFICATION_CLICK",route,metadata:data.metadata||{}});return}
    return self.clients.openWindow(`./?notifyRoute=${encodeURIComponent(route)}`);
  })());
});
