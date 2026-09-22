/* DOC-FULL-NR V17.3 mobile / PWA / fullscreen / copy-protection runtime.
   UI runtime only. Business authorization remains server-side. */
(function(){
  'use strict';
  const V173_COMPAT_RELEASE='V17.3-PWA-FULLSCREEN-RUNTIME';
  const RELEASE=window.DOCNR_RELEASE_META?.version||'V20.2';
  const $=(s,r=document)=>r.querySelector(s);

  function deviceProfile(){
    const shared=window.DOCNR_DEVICE_RUNTIME?.classify?.();
    if(shared){const touch=Number(navigator.maxTouchPoints||0)>0,coarse=matchMedia('(pointer:coarse)').matches;return Object.freeze({isPhone:shared==='phone',isTablet:shared==='tablet',isDesktop:shared==='desktop',touch,coarse,screenMin:Math.min(screen.width||innerWidth,screen.height||innerHeight),label:shared})}
    const ua=navigator.userAgent||'';const touch=Number(navigator.maxTouchPoints||0)>0;
    const ipad=/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&touch&&navigator.maxTouchPoints>1);
    const android=/Android/i.test(ua),androidMobile=android&&/Mobile/i.test(ua);
    const iphone=/iPhone|iPod/i.test(ua);const mobileUa=/Mobile|IEMobile|Opera Mini/i.test(ua);
    const sw=Math.min(screen.width||innerWidth,screen.height||innerHeight),coarse=matchMedia('(pointer:coarse)').matches;
    const isTablet=ipad||(android&&!androidMobile)||(touch&&coarse&&sw>=600&&!iphone);
    const isPhone=!isTablet&&(iphone||androidMobile||(mobileUa&&touch&&sw<600));
    return Object.freeze({isPhone,isTablet,isDesktop:!isPhone&&!isTablet,touch,coarse,screenMin:sw,label:isPhone?'phone':isTablet?'tablet':'desktop'});
  }
  const DEVICE=deviceProfile();
  document.documentElement.dataset.device=DEVICE.label;
  document.documentElement.classList.toggle('docnr-phone',DEVICE.isPhone);
  document.documentElement.classList.toggle('docnr-tablet',DEVICE.isTablet);
  document.documentElement.classList.toggle('docnr-desktop',DEVICE.isDesktop);

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

  // V20 Focus Fullscreen: installed PWA launches fullscreen from the manifest.
  // A normal browser is not allowed to enter native fullscreen during page load without user activation,
  // so we attempt immediately (for engines that permit it) and then again on the first trusted pointer/key gesture.
  let autoTried=false;
  function cameraGestureTarget(e){
    const t=e?.target;return !!t?.closest?.('#v14-start-scan,#v14-stop-scan,#v16-camera-start,#v16-camera-stop,#v16-capture,#v202-att-photo-btn,#v202-paper-photo-btn,input[type="file"],[data-camera-start],[data-camera-capture]');
  }
  async function tryFocusFullscreen(e){
    if(DEVICE.isPhone||autoTried||isFullscreen())return;
    if(e?.target?.closest?.('[data-camera-start],#v14-start-scan,#v16-camera-start,input,textarea,select,button[data-device-critical]'))return;
    if(e && !e.isTrusted)return;
    // Camera/file capture must keep the trusted gesture for permission prompts on iOS/Android.
    if(cameraGestureTarget(e))return;
    autoTried=true;
    try{localStorage.setItem('docnr-focus-fullscreen','1')}catch{}
    const ok=await enterFullscreen();
    if(!ok && e){
      // Do not keep retrying on every click; the explicit top-bar button remains available.
      window.dispatchEvent(new CustomEvent('docnr:fullscreen-unsupported'));
    }
  }
  function bootstrapFocusFullscreen(){
    document.documentElement.classList.add('docnr-focus-first');
    if(DEVICE.isPhone){autoTried=true;paintDisplayMode();return}
    if(isFullscreen()){autoTried=true;paintDisplayMode();return}
    // Best-effort startup attempt. Browsers that enforce user activation will reject this harmlessly.
    enterFullscreen().then(ok=>{if(ok)autoTried=true}).catch(()=>{});
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

  document.addEventListener('pointerdown',tryFocusFullscreen,true);
  document.addEventListener('touchstart',tryFocusFullscreen,{capture:true,passive:true});
  document.addEventListener('click',e=>{
    if(e.target.closest('#menubtn'))setTimeout(syncMenu,0);
    if(e.target.closest('[data-route],[data-app-route]'))setTimeout(closeMenu,0);
    tryFocusFullscreen(e);
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();else if(e.key==='Enter'||e.key===' ')tryFocusFullscreen(e)},true);
  window.addEventListener('resize',()=>{if(!matchMedia('(max-width: 780px)').matches)closeMenu();else syncMenu();paintDisplayMode()});
  document.addEventListener('fullscreenchange',paintDisplayMode);
  window.addEventListener('appinstalled',paintDisplayMode);
  window.addEventListener('docnr:fullscreen-unsupported',()=>{console.info('[DOCNR] Fullscreen API unavailable; installed standalone mode remains active.')});

  const observer=new MutationObserver(()=>{syncMenu();ensureFullscreenButton()});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  syncMenu();ensureFullscreenButton();installCopyProtection();paintDisplayMode();bootstrapFocusFullscreen();

  window.addEventListener('pageshow',()=>{paintDisplayMode();if(!isFullscreen()&&!autoTried)bootstrapFocusFullscreen()});
  window.addEventListener('load',()=>{
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.ready.then(reg=>{try{reg.update()}catch{}}).catch(()=>{});
  });
  window.DOCNR_DEVICE=DEVICE;
  window.DOCNR_MOBILE_RUNTIME=Object.freeze({release:RELEASE,displayMode,isInstalled,isFullscreen,enterFullscreen,toggleFullscreen,device:DEVICE,deviceClass:()=>DEVICE.label});
  console.info(`[DOC-FULL-NR] ${RELEASE} loaded`);
})();
