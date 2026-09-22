/* DOC-FULL-NR V20.2 adaptive device + camera runtime.
   UI/device policy only. Authorization and record writes remain server-authoritative. */
(function(){
  'use strict';
  const RELEASE='V20.2';
  const streams=new Map();
  const scanners=new Map();
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
    const kind=classify();
    document.documentElement.dataset.deviceClass=kind;
    document.documentElement.classList.toggle('docnr-phone',kind==='phone');
    document.documentElement.classList.toggle('docnr-tablet',kind==='tablet');
    document.documentElement.classList.toggle('docnr-desktop',kind==='desktop');
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
    if(name==='OverconstrainedError'||name==='ConstraintNotSatisfiedError')return 'กล้องไม่รองรับค่าที่ร้องขอ ระบบจะลองใช้กล้องมาตรฐานแทน';
    if(name==='AbortError')return 'การเปิดกล้องถูกยกเลิก กรุณาลองอีกครั้ง';
    return `เปิดกล้องไม่สำเร็จ (${name}) กรุณาตรวจสิทธิ์กล้องหรือใช้ปุ่มถ่ายภาพสำรอง`;
  }
  function supportsCamera(){return !!(window.isSecureContext&&navigator.mediaDevices?.getUserMedia)}

  function stopStream(key){
    const item=streams.get(key);if(!item)return;
    try{item.stream?.getTracks?.().forEach(t=>t.stop())}catch{}
    if(item.video){try{item.video.pause()}catch{};try{item.video.srcObject=null}catch{}}
    streams.delete(key);
  }
  function stopScanner(key){
    const s=scanners.get(key);if(s){s.active=false;if(s.timer)clearTimeout(s.timer);scanners.delete(key)}
    stopStream(key);
  }
  function stopAll(){
    [...scanners.keys()].forEach(stopScanner);
    [...streams.keys()].forEach(stopStream);
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
      {audio:false,video:{facingMode:{exact:'environment'},width:{ideal:1920},height:{ideal:1080}}},
      {audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},
      {audio:false,video:{width:{ideal:1280},height:{ideal:720}}},
      {audio:false,video:true}
    ];
    let last=null;
    for(const constraints of candidates){
      try{return await navigator.mediaDevices.getUserMedia(constraints)}catch(e){last=e;if(!['OverconstrainedError','ConstraintNotSatisfiedError','NotFoundError'].includes(String(e?.name||'')))break}
    }
    throw last||new Error('CAMERA_OPEN_FAILED');
  }
  async function startVideo(key,video){
    stopScanner(key);stopStream(key);
    if(!video)throw new Error('VIDEO_ELEMENT_REQUIRED');
    video.muted=true;video.autoplay=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
    const stream=await requestStream();
    streams.set(key,{stream,video});
    const track=stream.getVideoTracks?.()[0];
    if(track)track.addEventListener('ended',()=>{if(streams.get(key)?.stream===stream)streams.delete(key)},{once:true});
    video.srcObject=stream;
    try{await video.play()}catch(e){stopStream(key);throw e}
    await waitVideo(video).catch(()=>{});
    return {stream,track,width:video.videoWidth||0,height:video.videoHeight||0};
  }
  function drawFrame(video,canvas,max=960){
    if(!video?.videoWidth||!video?.videoHeight||!canvas)return null;
    const scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);return ctx;
  }
  async function ensureJsQR(){
    if(window.jsQR)return true;if(qrLoader)return qrLoader;
    qrLoader=(async()=>{for(const src of ['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js','https://unpkg.com/jsqr@1.4.0/dist/jsQR.js']){try{await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.async=true;el.crossOrigin='anonymous';const t=setTimeout(()=>{el.remove();reject(new Error('QR_LOAD_TIMEOUT'))},4500);el.onload=()=>{clearTimeout(t);resolve()};el.onerror=()=>{clearTimeout(t);el.remove();reject(new Error('QR_LOAD_ERROR'))};document.head.appendChild(el)});if(window.jsQR)return true}catch{}}return false})();return qrLoader;
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
      const delay=Math.max(80,Math.round(1000/Math.max(1,Math.min(12,fps))));
      const loop=async()=>{
        const s=scanners.get(key);if(!s?.active)return;
        try{
          const ctx=drawFrame(video,canvas,960);if(ctx){const raw=await decodeCanvas(canvas,s.detector,formats);if(raw){const now=Date.now();if(raw!==s.last||now-s.lastAt>2200){s.last=raw;s.lastAt=now;await onCode?.(raw)}}}
        }catch(e){console.warn('[DOCNR camera scan]',e)}
        if(scanners.get(key)?.active)session.timer=setTimeout(loop,delay);
      };
      loop();return started;
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

  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stopAll()},{passive:true});
  window.addEventListener('pagehide',stopAll,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(paintDevice,100),{passive:true});
  paintDevice();
  window.DOCNR_DEVICE_RUNTIME=Object.freeze({release:RELEASE,classify,isPhone,isTablet,isDesktop,hasTouch,paintDevice});
  window.DOCNR_CAMERA=Object.freeze({release:RELEASE,supportsCamera,errorMessage,startVideo,startScanner,stopScanner,stopAll,scanFile,captureBlob,normalizeImageBlob,ensureJsQR});
  console.info(`[DOC-FULL-NR] ${RELEASE} adaptive device/camera runtime loaded • ${classify()}`);
})();
