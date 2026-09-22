/* DOC-FULL-NR V20.3 adaptive UX shell runtime — no business logic.
   One drawer owner / one backdrop / device-aware bottom navigation. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const qs=(s,p=document)=>p.querySelector(s),qsa=(s,p=document)=>[...p.querySelectorAll(s)];
  const routeIcons={dashboard:'🏠',courses:'📚',specialactivity:'🎮',students:'👨‍🎓',workadmin:'📝',workcheck:'✅',printcenter:'🖨️',paperscan:'📄',attendancehub:'📷',exam:'🧪',academic:'⚙️',catalog:'📚',work:'📋',attendance:'📷',profile:'🪪'};
  let resizeTimer=0,observer=null,lastNavSig='';

  function deviceKind(){return window.DOCNR_DEVICE_RUNTIME?.classify?.()||(innerWidth<=620?'phone':innerWidth<=960?'tablet':'desktop')}
  function deviceState(){
    const kind=deviceKind(),w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    root.dataset.device=kind;root.dataset.orientation=w>h?'landscape':'portrait';root.dataset.density=(kind==='desktop'&&h<760)?'compact':'comfortable';root.style.setProperty('--docnr-vh',`${h*.01}px`);
    root.classList.toggle('docnr-phone',kind==='phone');root.classList.toggle('docnr-tablet',kind==='tablet');root.classList.toggle('docnr-desktop',kind==='desktop');
    return kind;
  }
  function ensureBackdrop(){
    let b=qs('.docnr-sidebar-backdrop');
    if(!b){b=document.createElement('button');b.type='button';b.className='docnr-sidebar-backdrop';b.setAttribute('aria-label','ปิดเมนู');document.body.appendChild(b)}
    if(!b.dataset.bound){b.dataset.bound='1';b.addEventListener('click',closeSidebar)}
    return b;
  }
  function syncDrawer(){
    const kind=deviceKind(),sb=qs('#sidebar'),bd=ensureBackdrop(),drawer=kind!=='desktop',open=!!(drawer&&sb?.classList.contains('open'));
    if(!drawer)sb?.classList.remove('open');
    bd.classList.toggle('open',open);document.body.classList.toggle('nav-open',open);qs('#menubtn')?.setAttribute('aria-expanded',open?'true':'false');
    document.getElementById('mobile-nav-backdrop')?.remove();
  }
  function closeSidebar(){qs('#sidebar')?.classList.remove('open');syncDrawer()}
  function openSidebar(){if(deviceKind()==='desktop')return;qs('#sidebar')?.classList.add('open');syncDrawer()}
  function enhanceMenu(){
    const menu=qs('#menubtn');
    if(menu&&!menu.dataset.uxBound){menu.dataset.uxBound='1';menu.setAttribute('aria-controls','sidebar');menu.addEventListener('click',()=>setTimeout(syncDrawer,0))}
    qsa('#sidebar [data-route],#sidebar [data-app-route]').forEach(b=>{if(!b.dataset.uxCloseBound){b.dataset.uxCloseBound='1';b.addEventListener('click',()=>{if(deviceKind()!=='desktop')setTimeout(closeSidebar,0)})}});
  }
  function mobileRoutes(){
    const buttons=qsa('#sidebar [data-route]');if(!buttons.length)return [];
    const admin=buttons.some(b=>b.dataset.route==='students');
    // Phone is capture/attendance-first. Tablet/desktop use the full sidebar instead.
    const wanted=admin?['dashboard','attendancehub','paperscan','students']:['dashboard','attendance','courses','profile'];
    return wanted.map(r=>buttons.find(b=>b.dataset.route===r)).filter(Boolean);
  }
  function buildBottomNav(){
    let nav=qs('.docnr-mobile-bottom-nav');
    if(deviceKind()!=='phone'){nav?.remove();lastNavSig='';return}
    const routes=mobileRoutes();if(!routes.length)return;
    const sig=routes.map(b=>`${b.dataset.route}:${(b.textContent||'').trim()}`).join('|');
    if(!nav){nav=document.createElement('nav');nav.className='docnr-mobile-bottom-nav';nav.setAttribute('aria-label','เมนูหลักบนโทรศัพท์');document.body.appendChild(nav)}
    if(sig!==lastNavSig){
      lastNavSig=sig;
      nav.innerHTML=routes.map(b=>`<button type="button" data-mobile-route="${b.dataset.route}"><span class="i">${routeIcons[b.dataset.route]||'•'}</span><span class="t">${(b.textContent||'').trim()}</span></button>`).join('')+`<button type="button" data-mobile-more><span class="i">☰</span><span class="t">เมนู</span></button>`;
    }
    syncBottomActive();
  }
  function syncBottomActive(){
    const active=qs('#sidebar [data-route].active')?.dataset.route;
    qsa('.docnr-mobile-bottom-nav [data-mobile-route]').forEach(b=>b.classList.toggle('active',b.dataset.mobileRoute===active));
  }
  function enhanceTables(){qsa('.table-wrap,.v186-table-scroll,.v16-grade-table').forEach(el=>{if(!el.hasAttribute('tabindex'))el.tabIndex=0;if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','ตารางข้อมูล เลื่อนแนวนอนได้เมื่อข้อมูลกว้างกว่าหน้าจอ')})}
  function enhanceInstall(){const btn=qs('#install');if(!btn)return;const standalone=matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;if(standalone){btn.textContent='✓ ติดตั้งแล้ว';btn.classList.add('is-installed')}else if(btn.textContent.includes('ติดตั้งแล้ว'))btn.textContent='ติดตั้งแอป'}
  function enhance(){deviceState();ensureBackdrop();enhanceMenu();syncDrawer();buildBottomNav();enhanceTables();enhanceInstall();syncBottomActive()}
  function observe(){
    if(observer)return;observer=new MutationObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(enhance,45)});observer.observe(qs('#app')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }

  document.addEventListener('click',e=>{
    const r=e.target.closest?.('[data-mobile-route]');if(r){e.preventDefault();const target=qs(`#sidebar [data-route="${CSS.escape(r.dataset.mobileRoute)}"]`);closeSidebar();target?.click();return}
    if(e.target.closest?.('[data-mobile-more]')){e.preventDefault();qs('#sidebar')?.classList.contains('open')?closeSidebar():openSidebar();return}
    // Fail-safe: if the drawer is already closed, never leave an invisible backdrop intercepting taps.
    if(!qs('#sidebar')?.classList.contains('open'))qs('.docnr-sidebar-backdrop')?.classList.remove('open');
  },true);
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(enhance,80)},{passive:true});
  addEventListener('orientationchange',()=>setTimeout(()=>{closeSidebar();enhance()},120),{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar()});
  document.addEventListener('DOMContentLoaded',()=>{enhance();observe()});
  if(document.readyState!=='loading'){enhance();observe()}
  window.DOCNR_UX_RUNTIME=Object.freeze({release:'V20.3',deviceKind,closeSidebar,openSidebar,syncDrawer,enhance});
})();
