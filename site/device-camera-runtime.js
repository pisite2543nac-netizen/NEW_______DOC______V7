/* DOC-FULL-NR V20.3 adaptive device + camera runtime.
   One camera owner, race-safe start/stop, explicit lifecycle events.
   Authorization and record writes remain server-authoritative. */
(function(){
  'use strict';
  const RELEASE='V20.3';
  const streams=new Map();
  const scanners=new Map();
  const starts=new Map();
  const epochs=new Map();
  let qrLoader=null;

  function ua(){return String(navigator.userAgent||'')}
  function shortestScreen(){
    const s=window.screen||{};
    const w=Number(s.width||innerWidth||0),h=Number(s.height||innerHeight||0);
    return Math.min(w||Infinity,h||Infinity);
  }
  function hasTouch(){return (navigator.maxTouchPoints||0)>0 || matchMedia('(pointer:coarse)').matches}
  function classify(){
    const u=ua();
    const hint=navigator.userAgentData?.mobile;
    const iphone=/iPhone|iPod/i.test(u);
    const ipad=/iPad/i.test(u) || (/Macintosh/i.test(u)&&navigator.maxTouchPoints>1);
    const android=/Android/i.test(u), androidMobile=android&&/Mobile/i.test(u);
    const smallTouch=hasTouch()&&shortestScreen()<600;
    if(hint===true||iphone||androidMobile||(!ipad&&smallTouch))return 'phone';
    if(ipad||(android&&!/Mobile/i.test(u))||(hasTouch()&&shortestScreen()>=600))return 'tablet';
    return 'desktop';
  }
  function paintDevice(){
    const kind=classify(),root=document.documentElement;
    root.dataset.deviceClass=kind;
    root.dataset.device=kind;
    root.classList.toggle('docnr-phone',kind==='phone');
    root.classList.toggle('docnr-tablet',kind==='tablet');
    root.classList.toggle('docnr-desktop',kind==='desktop');
    return kind;
  }
  function isPhone(){return classify()==='phone'}
  function isTablet(){return classify()==='tablet'}
  function isDesktop(){return classify()==='desktop'}

  function errorCode(err){return String(err?.name||err?.code||'CAMERA_ERROR')}
  function errorMessage(err){
    const name=errorCode(err),secure=window.isSecureContext;
    if(!secure)return 'กล้องใช้ได้เฉพาะ HTTPS หรือ PWA ที่ติดตั้งแล้ว กรุณาเปิดเว็บจากลิงก์หลักของระบบ';
    if(name==='NotAllowedError'||name==='PermissionDeniedError')return 'ไม่ได้รับสิทธิ์กล้อง กรุณาอนุญาต Camera ในการตั้งค่าเว็บไซต์/แอป แล้วกดเปิดกล้องอีกครั้ง';
    if(name==='NotFoundError'||name==='DevicesNotFoundError')return 'ไม่พบกล้องบนอุปกรณ์นี้';
    if(name==='NotReadableError'||name==='TrackStartError')return 'กล้องกำลังถูกแอปอื่นใช้งาน กรุณาปิดแอปกล้อง/วิดีโออื่นแล้วลองใหม่';
    if(name==='OverconstrainedError'||name==='ConstraintNotSatisfiedError')return 'กล้องไม่รองรับค่าที่ร้องขอ ระบบจะลดความละเอียดและลองใหม่';
    if(name==='AbortError')return 'การเปิดกล้องถูกยกเลิก กรุณากดเปิดกล้องใหม่อีกครั้ง';
    if(name==='CAMERA_REPLACED')return 'มีการเปิดกล้องใหม่ ระบบหยุดรอบเดิมเพื่อป้องกันกล้องซ้อนกัน';
    return `เปิดกล้องไม่สำเร็จ (${name}) กรุณาตรวจสิทธิ์กล้องหรือใช้ปุ่มถ่ายภาพสำรอง`;
  }
  function supportsCamera(){return !!(window.isSecureContext&&navigator.mediaDevices?.getUserMedia)}
  function nextEpoch(key){const n=(epochs.get(key)||0)+1;epochs.set(key,n);return n}
  function currentEpoch(key){return epochs.get(key)||0}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch{}}
  function hasLiveTracks(stream){return !!stream?.getVideoTracks?.().some(t=>t.readyState==='live')}

  function stopStream(key,reason='manual'){
    nextEpoch(key);
    const item=streams.get(key);
    if(item){
      try{item.stream?.getTracks?.().forEach(t=>t.stop())}catch{}
      if(item.video){try{item.video.pause()}catch{};try{item.video.srcObject=null}catch{}}
      streams.delete(key);
    }
    starts.delete(key);
    emit('docnr:camera-stopped',{key,reason});
  }
  function stopScanner(key,reason='manual'){
    const s=scanners.get(key);
    if(s){s.active=false;if(s.timer)clearTimeout(s.timer);scanners.delete(key)}
    stopStream(key,reason);
  }
  function stopAll(reason='route-change'){
    const keys=new Set([...scanners.keys(),...streams.keys(),...starts.keys()]);
    keys.forEach(k=>stopScanner(k,reason));
  }

  async function waitVideo(video,timeout=5000){
    if(video.videoWidth&&video.videoHeight)return true;
    await new Promise((resolve,reject)=>{
      let done=false;const finish=(ok)=>{if(done)return;done=true;clearTimeout(t);video.removeEventListener('loadedmetadata',yes);video.removeEventListener('canplay',yes);ok?resolve():reject(new Error('VIDEO_METADATA_TIMEOUT'))};
      const yes=()=>finish(true);const t=setTimeout(()=>finish(false),timeout);
      video.addEventListener('loadedmetadata',yes,{once:true});video.addEventListener('canplay',yes,{once:true});
    });
    return true;
  }
  async function requestStream(){
    if(!supportsCamera())throw Object.assign(new Error('CAMERA_UNAVAILABLE'),{name:window.isSecureContext?'NotSupportedError':'SecurityError'});
    const candidates=[
      {audio:false,video:{facingMode:{exact:'environment'},width:{ideal:1280},height:{ideal:720}}},
      {audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},
      {audio:false,video:{facingMode:{ideal:'environment'}}},
      {audio:false,video:true}
    ];
    let last=null;
    for(const constraints of candidates){
      try{return await navigator.mediaDevices.getUserMedia(constraints)}catch(e){
        last=e;
        if(!['OverconstrainedError','ConstraintNotSatisfiedError','NotFoundError','NotReadableError'].includes(String(e?.name||'')))break;
        await new Promise(r=>setTimeout(r,80));
      }
    }
    throw last||new Error('CAMERA_OPEN_FAILED');
  }
  async function startVideo(key,video){
    if(!key||!video)throw new Error('VIDEO_ELEMENT_REQUIRED');
    const live=streams.get(key);
    if(live&&live.video===video&&hasLiveTracks(live.stream))return {stream:live.stream,track:live.stream.getVideoTracks?.()[0],width:video.videoWidth||0,height:video.videoHeight||0,reused:true};
    if(starts.has(key))return starts.get(key);

    stopScanner(key,'replace');
    const epoch=nextEpoch(key);
    video.muted=true;video.autoplay=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
    const task=(async()=>{
      emit('docnr:camera-opening',{key});
      const stream=await requestStream();
      if(epoch!==currentEpoch(key)){
        try{stream.getTracks().forEach(t=>t.stop())}catch{}
        throw Object.assign(new Error('CAMERA_REPLACED'),{name:'CAMERA_REPLACED'});
      }
      streams.set(key,{stream,video});
      const track=stream.getVideoTracks?.()[0];
      if(track)track.addEventListener('ended',()=>{
        const active=streams.get(key);
        if(active?.stream===stream){streams.delete(key);scanners.delete(key);emit('docnr:camera-stopped',{key,reason:'track-ended'})}
      },{once:true});
      video.srcObject=stream;
      let playError=null;
      try{
        const playPromise=Promise.resolve(video.play()).then(()=>({ok:true})).catch(error=>({ok:false,error}));
        const playResult=await Promise.race([playPromise,new Promise(r=>setTimeout(()=>r({ok:true,timeout:true}),3500))]);
        if(playResult?.ok===false)playError=playResult.error;
      }catch(e){playError=e}
      if(playError){stopStream(key,'play-error');throw playError}
      try{await waitVideo(video,8000)}catch(e){stopStream(key,'metadata-timeout');e.name='NotReadableError';throw e}
      emit('docnr:camera-ready',{key,width:video.videoWidth||0,height:video.videoHeight||0});
      return {stream,track,width:video.videoWidth||0,height:video.videoHeight||0,reused:false};
    })();
    starts.set(key,task);
    try{return await task}finally{if(starts.get(key)===task)starts.delete(key)}
  }
  function drawFrame(video,canvas,max=960){
    if(!video?.videoWidth||!video?.videoHeight||!canvas)return null;
    const scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);return ctx;
  }
  async function ensureJsQR(){
    if(window.jsQR)return true;if(qrLoader)return qrLoader;
    qrLoader=(async()=>{
      for(const src of ['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js','https://unpkg.com/jsqr@1.4.0/dist/jsQR.js']){
        try{await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.async=true;el.crossOrigin=src.startsWith('http')?'anonymous':'';const t=setTimeout(()=>{el.remove();reject(new Error('QR_LOAD_TIMEOUT'))},4500);el.onload=()=>{clearTimeout(t);resolve()};el.onerror=()=>{clearTimeout(t);el.remove();reject(new Error('QR_LOAD_ERROR'))};document.head.appendChild(el)});if(window.jsQR)return true}catch{}
      }
      return false;
    })();return qrLoader;
  }
  async function makeDetector(formats){
    if(!('BarcodeDetector' in window))return null;
    try{
      let wanted=formats||['qr_code'];
      if(typeof BarcodeDetector.getSupportedFormats==='function'){
        const supported=await BarcodeDetector.getSupportedFormats();wanted=wanted.filter(x=>supported.includes(x));if(!wanted.length)return null;
      }
      return new BarcodeDetector({formats:wanted});
    }catch{return null}
  }
  async function decodeCanvas(canvas,detector,formats){
    if(detector){try{const codes=await detector.detect(canvas);if(codes?.[0]?.rawValue)return codes[0].rawValue}catch{}}
    if(window.jsQR||await ensureJsQR()){
      try{const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height);return window.jsQR(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'})?.data||null}catch{}
    }
    return null;
  }
  async function startScanner(opts){
    const {key,video,canvas,onCode,onReady,onError,formats=['qr_code'],fps=8}=opts||{};
    if(!key||!video||!canvas)throw new Error('SCANNER_CONFIG_REQUIRED');
    try{
      const started=await startVideo(key,video),detector=await makeDetector(formats),session={active:true,timer:null,last:'',lastAt:0,detector};
      scanners.set(key,session);onReady?.(started);
      const delay=Math.max(100,Math.round(1000/Math.max(1,Math.min(10,fps))));
      const loop=async()=>{
        const s=scanners.get(key);if(!s?.active)return;
        const active=streams.get(key);if(!active||!hasLiveTracks(active.stream)){stopScanner(key,'track-ended');return}
        try{
          const ctx=drawFrame(video,canvas,960);if(ctx){const raw=await decodeCanvas(canvas,s.detector,formats);if(raw){const now=Date.now();if(raw!==s.last||now-s.lastAt>2500){s.last=raw;s.lastAt=now;await onCode?.(raw)}}}
        }catch(e){console.warn('[DOCNR camera scan]',e)}
        if(scanners.get(key)?.active)session.timer=setTimeout(loop,delay);
      };
      session.timer=setTimeout(loop,80);return started;
    }catch(e){onError?.(e);throw e}
  }
  async function imageToCanvas(file,max=1600){
    if(!file)throw new Error('IMAGE_REQUIRED');
    let bmp=null,url=null,img=null;
    try{
      if('createImageBitmap' in window)bmp=await createImageBitmap(file);
      else{url=URL.createObjectURL(file);img=new Image();img.src=url;await img.decode()}
      const w=bmp?.width||img?.naturalWidth||0,h=bmp?.height||img?.naturalHeight||0;if(!w||!h)throw new Error('IMAGE_DECODE_FAILED');
      const scale=Math.min(1,max/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));canvas.getContext('2d',{willReadFrequently:true}).drawImage(bmp||img,0,0,canvas.width,canvas.height);return canvas;
    }finally{try{bmp?.close?.()}catch{};if(url)URL.revokeObjectURL(url)}
  }
  async function scanFile(file,formats=['qr_code','code_128','code_39','ean_13','ean_8']){
    const canvas=await imageToCanvas(file),detector=await makeDetector(formats);return await decodeCanvas(canvas,detector,formats);
  }
  async function normalizeImageBlob(file,quality=.9,max=2200){
    if(!file)throw new Error('IMAGE_REQUIRED');
    if(String(file.type||'').toLowerCase()==='image/jpeg' && file.size<=8*1024*1024)return file;
    const canvas=await imageToCanvas(file,max);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));
    if(!blob)throw new Error('IMAGE_CONVERT_FAILED');
    return blob;
  }
  async function captureBlob(video,quality=.88,max=2200){
    if(!video?.videoWidth||!video?.videoHeight)throw new Error('CAMERA_NOT_READY');
    const scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));if(!blob)throw new Error('CAPTURE_FAILED');return blob;
  }

  // Lifecycle safety. Native file/camera picker buttons explicitly stop their live stream before
  // opening the system picker. A short hidden transition can also occur while Android/iOS shows
  // the camera permission sheet, so never tear down a pending getUserMedia request immediately.
  let hiddenStopTimer=null;
  document.addEventListener('visibilitychange',()=>{
    clearTimeout(hiddenStopTimer);hiddenStopTimer=null;
    if(document.visibilityState==='hidden'){
      hiddenStopTimer=setTimeout(()=>{if(document.visibilityState==='hidden'&&starts.size===0)stopAll('page-hidden')},1400);
    }
  },{passive:true});
  window.addEventListener('pagehide',()=>{clearTimeout(hiddenStopTimer);stopAll('pagehide')},{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(paintDevice,100),{passive:true});
  window.addEventListener('resize',()=>setTimeout(paintDevice,50),{passive:true});
  paintDevice();
  window.DOCNR_DEVICE_RUNTIME=Object.freeze({release:RELEASE,classify,isPhone,isTablet,isDesktop,hasTouch,paintDevice});
  window.DOCNR_CAMERA=Object.freeze({release:RELEASE,supportsCamera,errorMessage,startVideo,startScanner,stopScanner,stopAll,scanFile,captureBlob,normalizeImageBlob,ensureJsQR,hasLiveTracks});
  console.info(`[DOC-FULL-NR] ${RELEASE} adaptive device/camera runtime loaded • ${classify()}`);
})();
