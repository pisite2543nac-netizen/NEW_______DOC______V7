/* DOC-FULL-NR V20.7 adaptive UX shell runtime — presentation/navigation only.
   One drawer owner, one backdrop, device-specific navigation, no business logic. */
(()=>{
  'use strict';
  const RELEASE='V20.7';
  const root=document.documentElement;
  const qs=(s,p=document)=>p.querySelector(s),qsa=(s,p=document)=>[...p.querySelectorAll(s)];
  const routeMeta={
    dashboard:['🏠','หน้าแรก'],attendance:['📷','เช็คชื่อ'],attendancehub:['📷','เช็คชื่อ'],paperscan:['📄','เก็บงาน'],students:['👨‍🎓','นักศึกษา'],
    courses:['📚','รายวิชา'],profile:['🪪','ข้อมูล'],work:['📋','งาน'],catalog:['📚','วิชา'],specialactivity:['🎮','กิจกรรม'],workadmin:['✅','ตรวจงาน'],workcheck:['📊','เช็กงาน'],exam:['📝','สอบ'],printcenter:['🖨️','รายงาน']
  };
  let resizeTimer=0,observer=null,lastNavSig='',lastRouteAt=0,lastRoute='';

  function deviceKind(){return window.DOCNR_DEVICE_RUNTIME?.classify?.()||(innerWidth<=620?'phone':innerWidth<=960?'tablet':'desktop')}
  function role(){return root.dataset.appRole||'user'}
  function isAdmin(){return role()==='admin'||!!qs('#sidebar [data-route="students"]')}
  function isTeacher(){return role()==='teacher'}
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
    qsa('#sidebar [data-route]').forEach(b=>{if(!b.dataset.uxCloseBound){b.dataset.uxCloseBound='1';b.addEventListener('click',()=>{if(deviceKind()!=='desktop')setTimeout(closeSidebar,0)})}});
  }
  function phoneRoutes(){
    return isAdmin()?['dashboard','attendance','paperscan','students']:isTeacher()?['dashboard','attendance','courses','workadmin']:['dashboard','attendance','courses','work'];
  }
  function effectiveRoute(){
    const r=root.dataset.appRoute||qs('#sidebar [data-route].active')?.dataset.route||'dashboard';
    if((isAdmin()||isTeacher())&&(r==='attendancehub'||r==='presence'))return 'attendance';
    return r;
  }
  function navigateRoute(route){
    const now=Date.now();if(route===lastRoute&&now-lastRouteAt<450)return;lastRoute=route;lastRouteAt=now;
    closeSidebar();
    if(window.DOCNR_BASE?.navigate){window.DOCNR_BASE.navigate(route);return}
    const fallback=qs(`#sidebar [data-route="${CSS.escape(route==='attendance'&&(isAdmin()||isTeacher())?'attendancehub':route)}"]`);fallback?.click();
  }
  function buildBottomNav(){
    let nav=qs('.docnr-mobile-bottom-nav');
    if(deviceKind()!=='phone'){nav?.remove();lastNavSig='';return}
    const routes=phoneRoutes(),sig=`${isAdmin()?'admin':isTeacher()?'teacher':'user'}:${routes.join('|')}`;
    if(!nav){nav=document.createElement('nav');nav.className='docnr-mobile-bottom-nav';nav.setAttribute('aria-label','เมนูหลักบนโทรศัพท์');document.body.appendChild(nav)}
    if(sig!==lastNavSig){
      lastNavSig=sig;
      nav.innerHTML=routes.map(r=>{const [i,t]=routeMeta[r]||['•',r];return `<button type="button" data-mobile-route="${r}" aria-label="${t}"><span class="i">${i}</span><span class="t">${t}</span></button>`}).join('')+`<button type="button" data-mobile-more aria-label="เมนูทั้งหมด"><span class="i">☰</span><span class="t">เมนู</span></button>`;
    }
    syncBottomActive();
  }
  function syncBottomActive(){
    const active=effectiveRoute();
    qsa('.docnr-mobile-bottom-nav [data-mobile-route]').forEach(b=>{const on=b.dataset.mobileRoute===active;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false')});
  }
  function enhanceTables(){qsa('.table-wrap,.v186-table-scroll,.v16-grade-table').forEach(el=>{if(!el.hasAttribute('tabindex'))el.tabIndex=0;if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','ตารางข้อมูล เลื่อนแนวนอนได้เมื่อข้อมูลกว้างกว่าหน้าจอ')})}
  function enhanceInstall(){const btn=qs('#install');if(!btn)return;const standalone=matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;if(standalone){btn.textContent='✓ ติดตั้งแล้ว';btn.classList.add('is-installed')}else if(btn.textContent.includes('ติดตั้งแล้ว'))btn.textContent='ติดตั้งแอป'}
  function enhance(){deviceState();ensureBackdrop();enhanceMenu();syncDrawer();buildBottomNav();enhanceTables();enhanceInstall();syncBottomActive()}
  function observe(){if(observer)return;observer=new MutationObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(enhance,55)});observer.observe(qs('#app')||document.body,{subtree:true,childList:true})}

  document.addEventListener('click',e=>{
    const r=e.target.closest?.('[data-mobile-route]');if(r){e.preventDefault();e.stopPropagation();navigateRoute(r.dataset.mobileRoute);return}
    if(e.target.closest?.('[data-mobile-more]')){e.preventDefault();e.stopPropagation();qs('#sidebar')?.classList.contains('open')?closeSidebar():openSidebar();return}
    if(!qs('#sidebar')?.classList.contains('open'))qs('.docnr-sidebar-backdrop')?.classList.remove('open');
  });
  addEventListener('docnr:route-state',()=>{syncBottomActive();closeSidebar()});
  addEventListener('docnr:route-ready',()=>syncBottomActive());
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(enhance,90)},{passive:true});
  addEventListener('orientationchange',()=>setTimeout(()=>{closeSidebar();enhance()},140),{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar()});
  document.addEventListener('DOMContentLoaded',()=>{enhance();observe()});
  if(document.readyState!=='loading'){enhance();observe()}
  window.DOCNR_UX_RUNTIME=Object.freeze({release:RELEASE,deviceKind,closeSidebar,openSidebar,syncDrawer,enhance,navigateRoute});
})();
