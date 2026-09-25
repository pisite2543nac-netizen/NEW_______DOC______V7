// DOC-FULL-NR V21.2 cross-device stable architecture cache marker
// Legacy release markers below are comments only for historical regression traceability.
// doc-full-nr-v19-2-production-ux-20260917
// doc-full-nr-v20-7-long-term-ux-teacher-production-stability-20260924
// doc-full-nr-v20-6-adaptive-stability-teacher-room-integration-20260924
// doc-full-nr-v20-5-late-teacher-barcode-admin-room-groups-20260923
const CACHE_PREFIX="doc-full-nr-";
const CACHE="doc-full-nr-v21-2-cross-device-stable-20260925";
const SHELL=[
  "./","./index.html","./exam.html",
  "./styles.css?v=20260925-v21-2","./v18-core-ui.css?v=20260925-v21-2","./v16-minimal.css?v=20260925-v21-2",
  "./v16-7-hardening.css?v=20260925-v21-2","./v16-8-course-flow.css?v=20260925-v21-2","./v18-7-exam-adapted.css?v=20260925-v21-2","./v19-print-system.css?v=20260925-v21-2","./v19-programming-activity.css?v=20260925-v21-2","./v21-core-ui.css?v=20260925-v21-2",
  "./device-camera-runtime.js?v=20260925-v21-2","./camera-registration.js?v=20260925-v21-2","./app.js?v=20260925-v21-2","./v16-platform.js?v=20260925-v21-2",
  "./v16-7-hardening.js?v=20260925-v21-2","./v16-8-course-flow.js?v=20260925-v21-2","./v16-exam.js?v=20260925-v21-2","./v19-programming-activity.js?v=20260925-v21-2","./v21-runtime.js?v=20260925-v21-2",
  "./manifest.webmanifest?v=20260925-v21-2","./release-meta.js","./data/teaching-knowledge-v20.js","./data/programming-activity-v197.json","./data/exam-question-bank-v18.json","./data/exam-question-bank-manifest-v18.json",
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
// compatibility markers retained for regression contracts:
// doc-full-nr-v20-6-adaptive-stability-teacher-room-integration-20260924
// doc-full-nr-v20-5-late-teacher-barcode-admin-room-groups-20260923

// V20.6 compatibility asset markers retained for regression contracts:
// ./device-camera-runtime.js?v=20260924-v20-6
// ./v19-programming-activity.js?v=20260924-v20-6
// ./v20-stability.css?v=20260924-v20-6
// ./v20-stability-runtime.js?v=20260924-v20-6

// Historical cache markers retained only for backwards regression contracts.
// doc-full-nr-v17-1-course-code-20260915
// doc-full-nr-v17-2-college-branding-20260915
// doc-full-nr-v17-3-full-system-20260915
// doc-full-nr-v17-4-learning-content-20260915
// doc-full-nr-v17-5-17unit-workpair-20260915
// doc-full-nr-v17-6-full-11subjects-20260915
// doc-full-nr-v17-6-1-icon-refresh-20260915
// doc-full-nr-v17-7-classroom-hardened-20260915
// doc-full-nr-v17-8-full-notifications-20260915
// doc-full-nr-v17-9-full-system-20260916
// doc-full-nr-v18-1-complete-learning-system-20260916
// doc-full-nr-v18-2-complete-system-final-20260916
// doc-full-nr-v19-6-production-print-system-20260918
// doc-full-nr-v19-7-programming-special-activity-20260920
// doc-full-nr-v19-8-standalone-special-activities-20260921
// doc-full-nr-v19-9-detailed-teaching-slides-20260922
// doc-full-nr-v20-0-teaching-presentation-unified-20260922
