/* DOC-FULL-NR V17.3 mobile / PWA / fullscreen / copy-protection runtime.
   UI runtime only. Business authorization remains server-side. */
(function(){
  'use strict';
  const RELEASE='V17.3-PWA-FULLSCREEN-RUNTIME';
  const $=(s,r=document)=>r.querySelector(s);

  function sidebar(){return document.getElementById('sidebar')}
  function closeMenu(){const s=sidebar();if(s)s.classList.remove('open');syncMenu()}
  function syncMenu(){
    const s=sidebar(),isMobile=matchMedia('(max-width: 780px)').matches;
    const open=!!(s&&s.classList.contains('open')&&isMobile);
    document.body.classList.toggle('nav-open',open);
    let backdrop=$('#mobile-nav-backdrop');
    if(open&&!backdrop){backdrop=document.createElement('button');backdrop.type='button';backdrop.id='mobile-nav-backdrop';backdrop.className='mobile-nav-backdrop';backdrop.setAttribute('aria-label','ปิดเมนู');backdrop.addEventListener('click',closeMenu);document.body.appendChild(backdrop)}
    else if(!open&&backdrop)backdrop.remove();
    const menuBtn=$('#menubtn');if(menuBtn)menuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  function displayMode(){
    if(matchMedia('(display-mode: fullscreen)').matches)return 'fullscreen';
    if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)return 'standalone';
    if(matchMedia('(display-mode: minimal-ui)').matches)return 'minimal-ui';
    return 'browser';
  }
  function isInstalled(){return displayMode()!=='browser'}
  function isFullscreen(){return !!document.fullscreenElement||displayMode()==='fullscreen'}
  function paintDisplayMode(){
    const mode=displayMode();document.documentElement.dataset.displayMode=mode;
    document.body.classList.toggle('docnr-installed',mode!=='browser');
    document.body.classList.toggle('docnr-fullscreen',isFullscreen());
    const b=$('#fullscreen');if(b){const label=isFullscreen()?'⛶ ออกจากเต็มจอ':'⛶ เต็มจอ';if(b.textContent!==label)b.textContent=label;}
    const i=$('#install');if(i&&isInstalled()&&i.textContent!=='✓ ติดตั้งแล้ว')i.textContent='✓ ติดตั้งแล้ว';
  }
  async function enterFullscreen(){
    if(isFullscreen())return true;
    try{
      const el=document.documentElement;
      if(el.requestFullscreen){await el.requestFullscreen({navigationUI:'hide'}).catch(()=>el.requestFullscreen());paintDisplayMode();return true}
    }catch(e){console.warn('[DOCNR] fullscreen',e)}
    return false;
  }
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement){await document.exitFullscreen();paintDisplayMode();return true}
      if(displayMode()==='fullscreen')return true;
      const ok=await enterFullscreen();
      if(!ok)window.dispatchEvent(new CustomEvent('docnr:fullscreen-unsupported'));
      return ok;
    }catch{return false}
  }
  function ensureFullscreenButton(){
    const bar=$('.topbar .row:last-child')||$('.exam-top .row:last-child');if(!bar)return;
    let b=$('#fullscreen');
    if(!b){b=document.createElement('button');b.type='button';b.id='fullscreen';b.className='btn sm docnr-fullscreen-btn';b.textContent='⛶ เต็มจอ';b.title='เปิด/ปิดโหมดเต็มหน้าจอ';b.onclick=toggleFullscreen;const install=$('#install');if(install)install.insertAdjacentElement('afterend',b);else bar.insertBefore(b,bar.firstChild)}
    paintDisplayMode();
  }

  // Installed apps attempt true fullscreen on the first deliberate user gesture when the OS/browser
  // launched in standalone rather than manifest-fullscreen. This satisfies browser user-activation rules.
  let autoTried=false;
  async function tryInstalledFullscreen(e){
    if(autoTried||!e.isTrusted||!isInstalled()||isFullscreen())return;
    autoTried=true;await enterFullscreen();
  }

  function allowSelection(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"],.allow-copy,.v165-room-code-value,[data-v165-copy-code]')}
  function installCopyProtection(){
    document.documentElement.classList.add('docnr-copy-protected');
    const block=e=>{if(allowSelection(e.target))return;e.preventDefault()};
    document.addEventListener('copy',block,true);
    document.addEventListener('cut',block,true);
    document.addEventListener('contextmenu',block,true);
    document.addEventListener('dragstart',block,true);
    document.addEventListener('selectstart',block,true);
    document.addEventListener('keydown',e=>{
      const k=String(e.key||'').toLowerCase();
      if((e.ctrlKey||e.metaKey)&&(k==='c'||k==='x')&&!allowSelection(e.target))e.preventDefault();
    },true);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#menubtn'))setTimeout(syncMenu,0);
    if(e.target.closest('[data-route],[data-app-route]'))setTimeout(closeMenu,0);
    tryInstalledFullscreen(e);
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  window.addEventListener('resize',()=>{if(!matchMedia('(max-width: 780px)').matches)closeMenu();else syncMenu();paintDisplayMode()});
  document.addEventListener('fullscreenchange',paintDisplayMode);
  window.addEventListener('appinstalled',paintDisplayMode);
  window.addEventListener('docnr:fullscreen-unsupported',()=>{console.info('[DOCNR] Fullscreen API unavailable; installed standalone mode remains active.')});

  const observer=new MutationObserver(()=>{syncMenu();ensureFullscreenButton()});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  syncMenu();ensureFullscreenButton();installCopyProtection();paintDisplayMode();

  window.addEventListener('load',()=>{
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.ready.then(reg=>{try{reg.update()}catch{}}).catch(()=>{});
  });
  window.DOCNR_MOBILE_RUNTIME=Object.freeze({release:RELEASE,displayMode,isInstalled,isFullscreen,enterFullscreen,toggleFullscreen});
  console.info(`[DOC-FULL-NR] ${RELEASE} loaded`);
})();
