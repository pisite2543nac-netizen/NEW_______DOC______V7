/* DOC-FULL-NR mobile behavior hardening.
   No Supabase credentials or business logic live here. */
(function(){
  'use strict';

  function sidebar(){ return document.getElementById('sidebar'); }

  function closeMenu(){
    const s=sidebar();
    if(s) s.classList.remove('open');
    syncMenu();
  }

  function syncMenu(){
    const s=sidebar();
    const isMobile=window.matchMedia('(max-width: 780px)').matches;
    const open=!!(s && s.classList.contains('open') && isMobile);
    document.body.classList.toggle('nav-open',open);

    let backdrop=document.getElementById('mobile-nav-backdrop');
    if(open && !backdrop){
      backdrop=document.createElement('button');
      backdrop.type='button';
      backdrop.id='mobile-nav-backdrop';
      backdrop.className='mobile-nav-backdrop';
      backdrop.setAttribute('aria-label','ปิดเมนู');
      backdrop.addEventListener('click',closeMenu);
      document.body.appendChild(backdrop);
    }else if(!open && backdrop){
      backdrop.remove();
    }

    const menuBtn=document.getElementById('menubtn');
    if(menuBtn) menuBtn.setAttribute('aria-expanded',open?'true':'false');
  }

  document.addEventListener('click',function(e){
    if(e.target.closest('#menubtn')) setTimeout(syncMenu,0);
    if(e.target.closest('[data-route]')) setTimeout(syncMenu,0);
  });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeMenu(); });
  window.addEventListener('resize',function(){
    if(!window.matchMedia('(max-width: 780px)').matches) closeMenu();
    else syncMenu();
  });

  const observer=new MutationObserver(syncMenu);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  syncMenu();

  // Ask the browser to check for the current SW script without forcing a page reload.
  window.addEventListener('load',function(){
    if(!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(function(reg){
      try{ reg.update(); }catch(_e){}
    }).catch(function(){});
  });
})();
