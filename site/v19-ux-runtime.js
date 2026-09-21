/* DOC-FULL-NR V19.3 production UX runtime — no business logic */
(()=>{
  const root=document.documentElement;
  const qs=(s,p=document)=>p.querySelector(s);
  const qsa=(s,p=document)=>[...p.querySelectorAll(s)];
  const routeIcons={dashboard:'🏠',courses:'📚',specialactivity:'🎮',students:'👨‍🎓',workadmin:'📝',workcheck:'✅',paperscan:'📄',attendancehub:'📷',exam:'🧪',academic:'⚙️',catalog:'📚',work:'📋',attendance:'📷',profile:'🪪'};
  let resizeTimer=0, observer=null;
  function deviceState(){
    const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    root.dataset.device=w<=620?'phone':w<=960?'tablet':'desktop';
    root.dataset.orientation=w>h?'landscape':'portrait';
    root.dataset.density=(h<760&&w>960)?'compact':'comfortable';
    root.style.setProperty('--docnr-vh',`${h*.01}px`);
  }
  function closeSidebar(){const sb=qs('#sidebar'),bd=qs('.docnr-sidebar-backdrop');sb?.classList.remove('open');bd?.classList.remove('open');qs('#menubtn')?.setAttribute('aria-expanded','false')}
  function openSidebar(){const sb=qs('#sidebar'),bd=qs('.docnr-sidebar-backdrop');sb?.classList.add('open');bd?.classList.add('open');qs('#menubtn')?.setAttribute('aria-expanded','true')}
  function ensureBackdrop(){
    if(qs('.docnr-sidebar-backdrop'))return;
    const b=document.createElement('button');b.type='button';b.className='docnr-sidebar-backdrop';b.setAttribute('aria-label','ปิดเมนู');b.onclick=closeSidebar;document.body.appendChild(b);
  }
  function enhanceMenu(){
    const menu=qs('#menubtn');if(menu&&!menu.dataset.uxBound){menu.dataset.uxBound='1';menu.setAttribute('aria-controls','sidebar');menu.setAttribute('aria-expanded',qs('#sidebar')?.classList.contains('open')?'true':'false');menu.addEventListener('click',()=>setTimeout(()=>qs('#sidebar')?.classList.contains('open')?openSidebar():closeSidebar(),0))}
    qsa('#sidebar [data-route]').forEach(b=>{if(!b.dataset.uxBound){b.dataset.uxBound='1';b.addEventListener('click',()=>{if(innerWidth<=960)closeSidebar()})}})
  }
  function mobileRoutes(){
    const buttons=qsa('#sidebar [data-route]');if(!buttons.length)return [];
    const admin=buttons.some(b=>b.dataset.route==='students');
    const wanted=admin?['dashboard','courses','specialactivity','students','workcheck']:['dashboard','courses','specialactivity','work','attendance'];
    return wanted.map(r=>buttons.find(b=>b.dataset.route===r)).filter(Boolean);
  }
  function buildBottomNav(){
    let nav=qs('.docnr-mobile-bottom-nav');
    if(innerWidth>620){nav?.remove();return}
    const routes=mobileRoutes();if(!routes.length)return;
    if(!nav){nav=document.createElement('nav');nav.className='docnr-mobile-bottom-nav';nav.setAttribute('aria-label','เมนูด่วนบนมือถือ');document.body.appendChild(nav)}
    nav.innerHTML=routes.map(b=>`<button type="button" data-mobile-route="${b.dataset.route}"><span class="i">${routeIcons[b.dataset.route]||'•'}</span><span class="t">${(b.textContent||'').trim()}</span></button>`).join('')+`<button type="button" data-mobile-more><span class="i">☰</span><span class="t">เมนู</span></button>`;
    qsa('[data-mobile-route]',nav).forEach(btn=>btn.onclick=()=>qs(`#sidebar [data-route="${CSS.escape(btn.dataset.mobileRoute)}"]`)?.click());
    qs('[data-mobile-more]',nav).onclick=()=>qs('#sidebar')?.classList.contains('open')?closeSidebar():openSidebar();
    syncBottomActive();
  }
  function syncBottomActive(){
    const active=qs('#sidebar [data-route].active')?.dataset.route;
    qsa('.docnr-mobile-bottom-nav [data-mobile-route]').forEach(b=>b.classList.toggle('active',b.dataset.mobileRoute===active));
  }
  function enhanceTables(){
    qsa('.table-wrap,.v186-table-scroll,.v16-grade-table').forEach(el=>{if(!el.hasAttribute('tabindex'))el.tabIndex=0;if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label','ตารางข้อมูล เลื่อนแนวนอนได้เมื่อข้อมูลกว้างกว่าหน้าจอ')});
  }
  function enhanceInstall(){
    const btn=qs('#install');if(!btn)return;
    const standalone=matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
    if(standalone){btn.textContent='✓ ติดตั้งแล้ว';btn.classList.add('is-installed')}else if(btn.textContent.includes('ติดตั้งแล้ว'))btn.textContent='ติดตั้งแอป';
  }
  function enhance(){deviceState();ensureBackdrop();enhanceMenu();buildBottomNav();enhanceTables();enhanceInstall();syncBottomActive()}
  function observe(){
    if(observer)return;observer=new MutationObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(enhance,30)});observer.observe(qs('#app')||document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  }
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(enhance,70)},{passive:true});
  addEventListener('orientationchange',()=>setTimeout(enhance,120),{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar()});
  document.addEventListener('DOMContentLoaded',()=>{enhance();observe()});
  if(document.readyState!=='loading'){enhance();observe()}
})();
