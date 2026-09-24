/* DOC-FULL-NR V20.6 stability runtime.
   Presentation/runtime guard only: no business authorization and no data mutation. */
(()=>{
  'use strict';
  const RELEASE='V20.6';
  const root=document.documentElement;
  let raf=0,lastSig='',observer=null;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];

  function deviceKind(){
    return window.DOCNR_DEVICE_RUNTIME?.classify?.() || (innerWidth<=620?'phone':innerWidth<=960?'tablet':'desktop');
  }
  function syncViewport(source='sync'){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const vv=window.visualViewport;
      const w=Math.max(1,Math.round(vv?.width||innerWidth||document.documentElement.clientWidth||1));
      const h=Math.max(1,Math.round(vv?.height||innerHeight||document.documentElement.clientHeight||1));
      const kind=deviceKind(),orientation=w>h?'landscape':'portrait';
      const sig=`${kind}:${orientation}:${w}x${h}`;
      root.dataset.device=kind;root.dataset.orientation=orientation;
      root.style.setProperty('--docnr-vw',`${w*.01}px`);root.style.setProperty('--docnr-vh',`${h*.01}px`);
      root.style.setProperty('--docnr-viewport-w',`${w}px`);root.style.setProperty('--docnr-viewport-h',`${h}px`);
      root.classList.toggle('docnr-phone',kind==='phone');root.classList.toggle('docnr-tablet',kind==='tablet');root.classList.toggle('docnr-desktop',kind==='desktop');
      stabilizeChrome();
      if(sig!==lastSig){lastSig=sig;try{window.dispatchEvent(new CustomEvent('docnr:viewport-stable',{detail:{kind,orientation,width:w,height:h,source}}))}catch{}}
    });
  }
  function stabilizeChrome(){
    const sb=q('#sidebar'),bd=q('.docnr-sidebar-backdrop');
    const drawer=deviceKind()!=='desktop';
    if(!drawer && sb?.classList.contains('open'))sb.classList.remove('open');
    const open=!!(drawer&&sb?.classList.contains('open'));
    if(bd){bd.classList.toggle('open',open);bd.toggleAttribute('aria-hidden',!open);bd.tabIndex=open?0:-1;}
    document.body.classList.toggle('nav-open',open);
    q('#menubtn')?.setAttribute('aria-expanded',open?'true':'false');
    // Old cached backdrops must never intercept taps.
    qa('#mobile-nav-backdrop').forEach(x=>x.remove());
    qa('.docnr-sidebar-backdrop:not(.open)').forEach(x=>{x.style.pointerEvents='none'});
    if(bd?.classList.contains('open'))bd.style.pointerEvents='auto';
  }
  function stabilizeContent(){
    qa('#content > *, .modal-card, .v14-overlay > *, .card, .v14-card').forEach(el=>{if(!el.style.minWidth)el.style.minWidth='0'});
    stabilizeChrome();
  }
  function scheduleContent(){clearTimeout(scheduleContent.t);scheduleContent.t=setTimeout(stabilizeContent,45)}
  function startObserver(){
    if(observer)return;
    observer=new MutationObserver(scheduleContent);
    observer.observe(q('#app')||document.body,{childList:true,subtree:true});
  }
  function cleanupTransient(){
    try{window.DOCNR_CAMERA?.stopAll?.('page-lifecycle')}catch{}
    stabilizeChrome();
  }
  addEventListener('resize',()=>syncViewport('resize'),{passive:true});
  window.visualViewport?.addEventListener('resize',()=>syncViewport('visualViewport'),{passive:true});
  addEventListener('orientationchange',()=>setTimeout(()=>syncViewport('orientation'),80),{passive:true});
  addEventListener('pageshow',()=>{syncViewport('pageshow');stabilizeContent()},{passive:true});
  addEventListener('pagehide',cleanupTransient,{passive:true});
  addEventListener('docnr:route-start',()=>{stabilizeChrome();scheduleContent()},{passive:true});
  addEventListener('docnr:route-ready',()=>{syncViewport('route-ready');scheduleContent()},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncViewport('visible')},{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){q('#sidebar')?.classList.remove('open');stabilizeChrome()}},true);
  document.addEventListener('DOMContentLoaded',()=>{syncViewport('dom');stabilizeContent();startObserver()},{once:true});
  if(document.readyState!=='loading'){syncViewport('immediate');stabilizeContent();startObserver()}
  window.DOCNR_STABILITY=Object.freeze({release:RELEASE,syncViewport,stabilizeChrome,deviceKind});
  console.info(`[DOC-FULL-NR] ${RELEASE} stability runtime loaded`);
})();
