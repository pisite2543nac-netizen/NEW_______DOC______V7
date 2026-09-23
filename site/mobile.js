/* DOC-FULL-NR V20.5 mobile / PWA / late attendance / touch interaction runtime.
   UI runtime only. Business authorization remains server-side. */
(function(){
  'use strict';
  const RELEASE=window.DOCNR_RELEASE_META?.version||'V20.5';
  const $=(s,r=document)=>r.querySelector(s);

  function deviceProfile(){
    const shared=window.DOCNR_DEVICE_RUNTIME?.classify?.();
    const touch=Number(navigator.maxTouchPoints||0)>0,coarse=matchMedia('(pointer:coarse)').matches;
    if(shared)return Object.freeze({isPhone:shared==='phone',isTablet:shared==='tablet',isDesktop:shared==='desktop',touch,coarse,label:shared});
    const sw=Math.min(screen.width||innerWidth,screen.height||innerHeight),isTablet=touch&&coarse&&sw>=600,isPhone=touch&&coarse&&!isTablet;
    return Object.freeze({isPhone,isTablet,isDesktop:!isPhone&&!isTablet,touch,coarse,label:isPhone?'phone':isTablet?'tablet':'desktop'});
  }
  let DEVICE=deviceProfile();
  function paintDevice(){
    DEVICE=deviceProfile();const root=document.documentElement;
    root.dataset.device=DEVICE.label;
    root.classList.toggle('docnr-phone',DEVICE.isPhone);root.classList.toggle('docnr-tablet',DEVICE.isTablet);root.classList.toggle('docnr-desktop',DEVICE.isDesktop);
  }

  function sidebar(){return document.getElementById('sidebar')}
  function clearLegacyBackdrop(){document.getElementById('mobile-nav-backdrop')?.remove()}
  function closeMenu(){
    clearLegacyBackdrop();
    if(window.DOCNR_UX_RUNTIME?.closeSidebar){window.DOCNR_UX_RUNTIME.closeSidebar();return}
    const s=sidebar();if(s)s.classList.remove('open');document.body.classList.remove('nav-open');
    const bd=$('.docnr-sidebar-backdrop');bd?.classList.remove('open');$('#menubtn')?.setAttribute('aria-expanded','false');
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
    document.body.classList.toggle('docnr-installed',mode!=='browser');document.body.classList.toggle('docnr-fullscreen',isFullscreen());
    const b=$('#fullscreen');if(b)b.textContent=isFullscreen()?'⛶ ออกจากเต็มจอ':'⛶ เต็มจอ';
    const i=$('#install');if(i&&isInstalled())i.textContent='✓ ติดตั้งแล้ว';
  }
  async function enterFullscreen(){
    if(isFullscreen())return true;
    try{const el=document.documentElement;if(el.requestFullscreen){await el.requestFullscreen({navigationUI:'hide'}).catch(()=>el.requestFullscreen());paintDisplayMode();return true}}catch(e){console.info('[DOCNR] fullscreen unavailable',e?.name||e)}
    return false;
  }
  async function toggleFullscreen(){
    try{if(document.fullscreenElement){await document.exitFullscreen();paintDisplayMode();return true}if(displayMode()==='fullscreen')return true;return await enterFullscreen()}catch{return false}
  }
  function ensureFullscreenButton(){
    const bar=$('.topbar .row:last-child')||$('.exam-top .row:last-child');if(!bar)return;
    let b=$('#fullscreen');
    if(!b){b=document.createElement('button');b.type='button';b.id='fullscreen';b.className='btn sm docnr-fullscreen-btn';b.title='เปิด/ปิดโหมดเต็มหน้าจอ';b.addEventListener('click',toggleFullscreen);const install=$('#install');if(install)install.insertAdjacentElement('afterend',b);else bar.insertBefore(b,bar.firstChild)}
    paintDisplayMode();
  }

  // Do not consume the first touch/click on phones or tablets for native fullscreen.
  // A fullscreen request during pointerdown can cancel the following click or camera permission
  // prompt on mobile browsers. Installed PWA mode remains fullscreen/standalone; browser mode has
  // an explicit Fullscreen button. Desktop gets a conservative background-only best effort.
  let desktopFocusTried=false;
  function isInteractiveTarget(target){return !!target?.closest?.('button,a,input,textarea,select,label,[role="button"],[tabindex],[contenteditable="true"],video,.modal,.v14-overlay')}
  async function tryDesktopFocusFullscreen(e){
    if(!DEVICE.isDesktop||desktopFocusTried||isFullscreen()||!e?.isTrusted||isInteractiveTarget(e.target))return;
    desktopFocusTried=true;await enterFullscreen();
  }

  function allowSelection(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"],.allow-copy,.v165-room-code-value,[data-v165-copy-code]')}
  function installCopyProtection(){
    document.documentElement.classList.add('docnr-copy-protected');
    const block=e=>{if(allowSelection(e.target))return;e.preventDefault()};
    document.addEventListener('copy',block,true);document.addEventListener('cut',block,true);document.addEventListener('dragstart',block,true);
    // Long-press/context-menu blocking is desktop-only. On iOS/Android it can interfere with labels,
    // native camera file controls and accessibility gestures.
    document.addEventListener('contextmenu',e=>{if(DEVICE.touch||allowSelection(e.target))return;e.preventDefault()},true);
    document.addEventListener('selectstart',e=>{if(DEVICE.touch||allowSelection(e.target))return;e.preventDefault()},true);
    document.addEventListener('keydown',e=>{const k=String(e.key||'').toLowerCase();if((e.ctrlKey||e.metaKey)&&(k==='c'||k==='x')&&!allowSelection(e.target))e.preventDefault()},true);
  }

  document.addEventListener('pointerdown',tryDesktopFocusFullscreen,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()},true);
  window.addEventListener('resize',()=>{paintDevice();paintDisplayMode()},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{paintDevice();closeMenu();paintDisplayMode()},80),{passive:true});
  document.addEventListener('fullscreenchange',paintDisplayMode);
  window.addEventListener('appinstalled',paintDisplayMode);
  window.addEventListener('pageshow',()=>{paintDevice();closeMenu();paintDisplayMode()});

  let obsTimer=0;
  const observer=new MutationObserver(()=>{clearTimeout(obsTimer);obsTimer=setTimeout(()=>{ensureFullscreenButton()},60)});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  paintDevice();clearLegacyBackdrop();ensureFullscreenButton();installCopyProtection();paintDisplayMode();

  window.addEventListener('load',()=>{if('serviceWorker' in navigator)navigator.serviceWorker.ready.then(reg=>{try{reg.update()}catch{}}).catch(()=>{})});
  window.DOCNR_DEVICE=DEVICE;
  window.DOCNR_MOBILE_RUNTIME=Object.freeze({release:RELEASE,displayMode,isInstalled,isFullscreen,enterFullscreen,toggleFullscreen,device:()=>DEVICE,deviceClass:()=>DEVICE.label,closeMenu});
  console.info(`[DOC-FULL-NR] ${RELEASE} mobile interaction runtime loaded`);
})();
