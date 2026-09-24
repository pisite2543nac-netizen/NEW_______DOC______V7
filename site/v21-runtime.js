/* DOC-FULL-NR V21.0 single shell/runtime owner.
   Owns viewport state, drawer/backdrop, mobile bottom navigation,
   route progress, network status and fullscreen chrome. No business data writes. */
(()=>{
  'use strict';
  const RELEASE='V21.0';
  const root=document.documentElement;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const group={accounts:'students',enrollments:'students',profiles:'students',roomgroups:'students',users:'students',grading:'workadmin',overrides:'workadmin',reports:'workadmin',paperscan:'paperscan',presence:'attendancehub',promotion:'academic',audit:'academic',system:'academic',enroll:'catalog',history:'profile',attendance:'attendancehub'};
  const meta={dashboard:['🏠','หน้าแรก'],courses:['📚','รายวิชา'],workadmin:['✅','งาน/คะแนน'],work:['📋','งาน'],attendancehub:['📷','เช็คชื่อ'],attendance:['📷','เช็คชื่อ'],exam:['🧪','สอบ'],catalog:['🔎','ค้นวิชา'],profile:['👤','โปรไฟล์']};
  const phoneRoutes={
    admin:['dashboard','courses','workadmin','attendancehub'],
    teacher:['dashboard','courses','workadmin','attendancehub'],
    user:['dashboard','courses','work','attendance']
  };
  let lastViewport='';
  let lastNavigateAt=0;
  let lastNavigateKey='';

  function role(){return root.dataset.role||'user'}
  function device(){
    const d=window.DOCNR_DEVICE_RUNTIME?.classify?.();
    if(d==='phone'||d==='tablet'||d==='desktop')return d;
    const w=Math.max(1,window.innerWidth||0);return w<=620?'phone':w<=959?'tablet':'desktop';
  }
  function syncViewport(){
    const vv=window.visualViewport,w=Math.round(vv?.width||innerWidth||document.documentElement.clientWidth||1),h=Math.round(vv?.height||innerHeight||document.documentElement.clientHeight||1),kind=device();
    root.style.setProperty('--docnr-vh',`${h*.01}px`);root.style.setProperty('--docnr-viewport-w',`${w}px`);root.style.setProperty('--docnr-viewport-h',`${h}px`);
    root.classList.toggle('docnr-phone',kind==='phone');root.classList.toggle('docnr-tablet',kind==='tablet');root.classList.toggle('docnr-desktop',kind==='desktop');
    root.dataset.device=kind;root.dataset.orientation=w>h?'landscape':'portrait';
    const sig=`${kind}:${w}:${h}`;if(sig!==lastViewport){lastViewport=sig;try{dispatchEvent(new CustomEvent('docnr:viewport-stable',{detail:{kind,width:w,height:h}}))}catch{}}
    if(kind==='desktop')closeDrawer();
    ensureMobileNav();
  }
  function ensureProgress(){if($('#docnr-route-progress'))return;document.body.insertAdjacentHTML('beforeend','<div id="docnr-route-progress" aria-hidden="true"></div>')}
  function ensureBackdrop(){
    if(root.dataset.docnrSurface==='exam')return null;
    let b=$('#docnr-v21-backdrop');if(!b){b=document.createElement('button');b.type='button';b.id='docnr-v21-backdrop';b.setAttribute('aria-label','ปิดเมนู');b.addEventListener('click',closeDrawer);document.body.appendChild(b)}return b;
  }
  function openDrawer(){if(root.dataset.docnrSurface==='exam'||device()==='desktop')return;ensureBackdrop();root.classList.add('docnr-drawer-open');document.body.classList.add('nav-open');$('#menubtn')?.setAttribute('aria-expanded','true')}
  function closeDrawer(){root.classList.remove('docnr-drawer-open');document.body.classList.remove('nav-open');$('#menubtn')?.setAttribute('aria-expanded','false')}
  function toggleDrawer(){root.classList.contains('docnr-drawer-open')?closeDrawer():openDrawer()}
  function activeRoute(){return root.dataset.appRoute||'dashboard'}
  function visibleActive(){return group[activeRoute()]||activeRoute()}
  function navLabel(r){return meta[r]||['•',r]}
  function ensureMobileNav(){
    const kind=device();let nav=$('#docnr-mobile-nav');
    if(root.dataset.docnrSurface==='exam'){nav?.remove();return}
    if(kind!=='phone'){nav?.remove();return}
    const r=role(),routes=phoneRoutes[r]||phoneRoutes.user,sig=`${r}:${routes.join('|')}`;
    if(!nav){nav=document.createElement('nav');nav.id='docnr-mobile-nav';nav.setAttribute('aria-label','เมนูหลักบนมือถือ');document.body.appendChild(nav)}
    if(nav.dataset.sig!==sig){nav.dataset.sig=sig;nav.innerHTML=routes.map(x=>{const [i,t]=navLabel(x);return `<button type="button" data-v21-route="${x}" aria-label="${t}"><span class="icon">${i}</span><span class="label">${t}</span></button>`}).join('')+`<button type="button" data-v21-more aria-label="เปิดเมนูทั้งหมด"><span class="icon">☰</span><span class="label">เมนู</span></button>`}
    syncMobileActive();
  }
  function syncMobileActive(){const a=visibleActive();$$('#docnr-mobile-nav [data-v21-route]').forEach(b=>{const on=b.dataset.v21Route===a;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false')})}
  function navigate(route,arg=null){
    const key=`${route}:${arg||''}`,now=Date.now();if(key===lastNavigateKey&&now-lastNavigateAt<500)return;lastNavigateKey=key;lastNavigateAt=now;
    closeDrawer();const f=window.DOCNR_BASE?.navigate;if(typeof f==='function')return f(route,arg);const b=$(`#sidebar [data-route="${CSS.escape(route)}"]`);b?.click();
  }
  function syncNetwork(){root.classList.toggle('docnr-offline',navigator.onLine===false);let e=$('#docnr-network-state');const actions=$('.topbar-actions');if(!actions)return;if(!e){e=document.createElement('span');e.id='docnr-network-state';actions.insertBefore(e,actions.firstChild)}e.textContent=navigator.onLine===false?'ออฟไลน์':'ออนไลน์'}
  function updateFullscreen(){const b=$('#fullscreen');if(!b)return;const on=!!document.fullscreenElement;b.innerHTML=on?'⛶ ออกจากเต็มจอ':'⛶ เต็มจอ';b.setAttribute('aria-pressed',String(on))}
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen?.();else await document.documentElement.requestFullscreen?.()}catch{}updateFullscreen()}
  function enhanceRegistry(){
    const reg=$('.v171-code-registry'),grid=reg?.querySelector('.v171-code-grid');if(!reg||!grid||device()!=='phone')return;
    const n=grid.querySelectorAll('.v171-code-item').length;if(n<=3)return;reg.classList.add('docnr-registry-collapsible');let b=reg.querySelector('.docnr-registry-toggle');if(!b){b=document.createElement('button');b.type='button';b.className='btn docnr-registry-toggle';reg.appendChild(b);b.addEventListener('click',()=>{reg.classList.toggle('docnr-registry-expanded');paintRegistryToggle(reg,b,n)})}paintRegistryToggle(reg,b,n)
  }
  function paintRegistryToggle(reg,b,n){const open=reg.classList.contains('docnr-registry-expanded');b.textContent=open?'ย่อรายการ CODE':'ดู CODE ทั้งหมด '+n+' วิชา';b.setAttribute('aria-expanded',String(open))}
  function routeStart(){ensureProgress();root.dataset.navBusy='1';$('#content')?.setAttribute('aria-busy','true');closeDrawer()}
  function routeReady(){delete root.dataset.navBusy;$('#content')?.removeAttribute('aria-busy');$$('.docnr-route-loading').forEach(x=>x.remove());syncMobileActive();syncNetwork();enhanceRegistry()}
  function shellReady(){ensureProgress();ensureBackdrop();syncViewport();syncNetwork();updateFullscreen();ensureMobileNav();enhanceRegistry();const menu=$('#menubtn');if(menu){menu.setAttribute('aria-controls','sidebar');menu.setAttribute('aria-expanded',String(root.classList.contains('docnr-drawer-open')))}}

  document.addEventListener('click',e=>{
    const route=e.target.closest?.('[data-v21-route]');if(route){e.preventDefault();e.stopPropagation();navigate(route.dataset.v21Route);return}
    if(e.target.closest?.('[data-v21-more]')){e.preventDefault();e.stopPropagation();openDrawer();return}
    const side=e.target.closest?.('#sidebar [data-route]');if(side&&device()!=='desktop')setTimeout(closeDrawer,0);
  },true);
  addEventListener('docnr:route-start',routeStart);
  addEventListener('docnr:route-ready',routeReady);
  addEventListener('docnr:route-state',()=>{shellReady();syncMobileActive()});
  addEventListener('resize',()=>requestAnimationFrame(syncViewport),{passive:true});
  window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(syncViewport),{passive:true});
  addEventListener('orientationchange',()=>setTimeout(()=>{closeDrawer();syncViewport()},100),{passive:true});
  addEventListener('online',syncNetwork);addEventListener('offline',syncNetwork);addEventListener('pageshow',shellReady);addEventListener('pagehide',()=>{closeDrawer();try{window.DOCNR_CAMERA?.stopAll?.('pagehide')}catch{}});
  document.addEventListener('fullscreenchange',updateFullscreen);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shellReady,{once:true});else shellReady();
  window.DOCNR_V21=Object.freeze({release:RELEASE,device,openDrawer,closeDrawer,toggleDrawer,navigate,toggleFullscreen,syncViewport,syncNetwork});
})();
