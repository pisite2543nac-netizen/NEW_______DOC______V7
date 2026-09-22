import { getClient } from "./v18-supabase.js";
import { RELEASE_VERSION } from "./release-meta.js";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF="thjscmfqunlaqxlievna";
const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;
const V186_COMPAT_VERSION="V18.6-ROOM-WORK-CHECKLIST-AUDITED";
const V194_CLASSROOM_COMPAT="V19.4-CLASSROOM-OPEN-CLOSE-GLOBAL-BACK";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const fmtDate=d=>d?new Date(d).toLocaleDateString("th-TH",{dateStyle:"medium"}):"-";
const safeName=s=>String(s||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-110);

const state={
  uid:null,profile:null,route:null,subjectId:null,serverOffset:0,
  heartbeatTimer:null,countdownTimer:null,navTimer:null,presenceChannel:null,
  scanner:null,scanBusy:false,lastScanToken:null,lastScanAt:0,currentAttendanceSession:null,currentAttendanceDeadline:null,
  rtClient:null,roomChannel:null,roomRefreshTimer:null,currentRoomMode:null,
  notificationChannel:null,notificationReady:false,notificationUid:null,attendanceTimer:null,attendanceFinalizeNotice:false,attendanceAutoClosing:false,workChecklist:null
};

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return null;
    const s=JSON.parse(raw);return s?.access_token&&s?.user?.id?s:null;
  }catch{return null}
}
function uid(){return readSession()?.user?.id||null}
function client(){return getClient()}
function authClient(){return getClient()}
async function realtimeClient(){
  const s=readSession();if(!s)return null;
  if(state.rtClient&&state.uid===s.user.id)return state.rtClient;
  const c=getClient();state.rtClient=c;return c;
}
async function getProfile(force=false){
  const id=uid();
  if(!id){state.uid=null;state.profile=null;return null}
  if(!force&&state.profile&&state.uid===id)return state.profile;
  const {data,error}=await client().from("profiles").select("id,username,full_name,display_name,role,active,approval_status,approval_requested_at,approved_at,rejection_reason,academic_status,class_name,student_code,avatar_path,phone,phone_verified_at,birth_date,grade_level,room_label,seat_number,contact_email,department,major,last_seen_at").eq("id",id).maybeSingle();
  if(error)return null;
  state.uid=id;state.profile=data||null;return state.profile;
}
function content(){return $("#content")}
function setTitle(t){const e=$("#pagetitle");if(e)e.textContent=t}
function toast(message,bad=false){
  let e=$("#v14-toast");if(!e){e=document.createElement("div");e.id="v14-toast";document.body.appendChild(e)}
  e.textContent=message;e.className=`v14-toast show${bad?" bad":""}`;clearTimeout(toast.t);toast.t=setTimeout(()=>e.className="v14-toast",3800);
}
const v179RequestKey=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
async function v18Sha256Blob(blob){const b=await blob.arrayBuffer(),h=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function errorText(err){
  const raw=String(err?.message||err?.details||err?.error_description||err||"เกิดข้อผิดพลาด");
  const map={
    ADMIN_REQUIRED:"ต้องใช้บัญชี Admin",CLASSROOM_CLOSED:"ห้องเรียนรายวิชานี้ปิดอยู่ กรุณารอ Admin เปิดห้องเรียน",JOIN_CODE_ALREADY_USED:"CODE นี้ถูกใช้กับรายวิชาอื่นแล้ว กรุณาใช้ CODE อื่น",JOIN_CODE_INVALID:"CODE เข้าเรียนต้องเป็น A-Z/0-9 จำนวน 4–12 ตัว",ACTIVE_USER_REQUIRED:"บัญชีนี้ยังไม่พร้อมใช้งาน",NOT_ALLOWED:"ไม่มีสิทธิ์ดำเนินการ",
    NO_TARGETS:"ยังไม่มีผู้เรียนที่ได้รับอนุมัติ/เป้าหมายสำหรับงานนี้",INVALID_SCHEDULE:"วันและเวลาที่กำหนดไม่ถูกต้อง",
    NO_WORKSHEETS_SELECTED:"กรุณาเลือกใบงานอย่างน้อย 1 ใบ",STUDENT_NOT_APPROVED_FOR_SUBJECT:"นักศึกษาคนนี้ยังไม่ได้รับอนุมัติให้เรียนรายวิชานี้",
    STUDENT_NOT_IN_CLASSROOM:"นักศึกษาไม่ได้อยู่ในห้องเรียนนี้",INVALID_QR_TOKEN:"QR ไม่ถูกต้องหรือถูกยกเลิกแล้ว",
    EXAM_NOT_OPEN:"ยังไม่ถึงเวลาเปิดสอบ",EXAM_CLOSED:"หมดเวลาเปิดสอบแล้ว",MAX_ATTEMPTS_REACHED:"ใช้สิทธิ์เข้าสอบครบแล้ว",
    EXAM_TIME_EXPIRED:"หมดเวลาทำข้อสอบแล้ว",NOT_ASSIGNED:"บัญชีนี้ไม่ได้รับมอบหมายข้อสอบ",ATTEMPT_FINALIZED:"ข้อสอบถูกส่งเรียบร้อยแล้ว",
    ATTENDANCE_WINDOW_CLOSED_USE_ADMIN:"หมดเวลาเช็คชื่อผ่านหัวหน้าห้องแล้ว กรุณาให้นักศึกษาติดต่อ Admin เพื่อเช็คชื่อเป็นมาสาย",
    INVALID_ATTENDANCE_WINDOW:"ช่วงเวลาเช็คชื่อไม่ถูกต้อง"
  };
  for(const [k,v] of Object.entries(map))if(raw.includes(k))return v;
  return raw;
}
function busy(label="กำลังโหลดข้อมูล..."){if(content())content().innerHTML=`<div class="v14-loading"><div class="v14-spinner"></div><b>${esc(label)}</b></div>`}
function closeOverlay(){
  stopScanner();$("#v14-overlay")?.remove();document.body.classList.remove("v14-modal-open");
}
function overlay(html,wide=false){
  closeOverlay();document.body.classList.add("v14-modal-open");
  document.body.insertAdjacentHTML("beforeend",`<div id="v14-overlay" class="v14-overlay"><div class="v14-modal ${wide?"wide":""}">${html}</div></div>`);
  $$("[data-v14-close]",$("#v14-overlay")).forEach(b=>b.addEventListener("click",closeOverlay));
  return $("#v14-overlay");
}
function ask(msg){return window.confirm(msg)}
function nowMs(){return Date.now()+state.serverOffset}
async function syncServerTime(){
  try{
    const t0=Date.now();const {data,error}=await client().rpc("server_now");const t1=Date.now();
    if(!error&&data){const server=new Date(data).getTime();state.serverOffset=server-((t0+t1)/2)}
  }catch{}
}
function remainingText(date){
  if(!date)return "ไม่มีกำหนด";
  let ms=new Date(date).getTime()-nowMs();if(ms<=0)return "หมดเวลา";
  const d=Math.floor(ms/86400000);ms%=86400000;const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);const s=Math.floor((ms%60000)/1000);
  if(d>0)return `เหลือ ${d} วัน ${String(h).padStart(2,"0")} ชม. ${String(m).padStart(2,"0")} นาที`;
  return `เหลือ ${String(h).padStart(2,"0")} ชม. ${String(m).padStart(2,"0")} นาที ${String(s).padStart(2,"0")} วิ`;
}
function updateCountdowns(){
  $$('[data-v14-countdown]').forEach(e=>{
    const due=e.dataset.v14Countdown;const txt=remainingText(due);e.textContent=txt;e.classList.toggle("expired",txt==="หมดเวลา");
  });
}
function startCountdowns(){clearInterval(state.countdownTimer);updateCountdowns();state.countdownTimer=setInterval(updateCountdowns,1000)}
function deviceLabel(){
  const ua=navigator.userAgent||"";if(/iPhone|iPad|iPod/i.test(ua))return "iOS Safari/PWA";if(/Android/i.test(ua))return "Android";if(/Windows/i.test(ua))return "Windows";return "Browser";
}
async function heartbeat(){
  if(!uid()||document.visibilityState==="hidden")return;
  try{await client().rpc("heartbeat_user_presence",{p_activity:state.route||"online",p_activity_ref:state.subjectId||null,p_device:deviceLabel()})}catch{}
}
function startHeartbeat(){
  if(state.heartbeatTimer)return;heartbeat();state.heartbeatTimer=setInterval(heartbeat,45000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")heartbeat()},{passive:true});
}
function clearPresenceChannel(){if(state.presenceChannel&&state.rtClient){try{state.rtClient.removeChannel(state.presenceChannel)}catch{}}state.presenceChannel=null}
function clearRoomChannel(){if(state.roomChannel&&state.rtClient){try{state.rtClient.removeChannel(state.roomChannel)}catch{}}state.roomChannel=null;clearTimeout(state.roomRefreshTimer)}
async function subscribeSubjectRoom(sid,mode){
  clearRoomChannel();state.currentRoomMode=mode;
  const rt=await realtimeClient();if(!rt||!sid)return;
  const refresh=()=>{clearTimeout(state.roomRefreshTimer);state.roomRefreshTimer=setTimeout(()=>{
    if(state.subjectId!==sid||state.route!=="courses"||$("#v14-overlay"))return;
    if($$("[data-v14-wselect]:checked").length)return;
    if(mode==="admin")renderAdminSubject(sid).catch(()=>{});else if(mode==="student")renderStudentCourse(sid).catch(()=>{});
  },900)};
  const ch=rt.channel(`subject-room-${sid}-${Date.now()}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"subject_enrollments",filter:`subject_id=eq.${sid}`},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"worksheets",filter:`subject_id=eq.${sid}`},refresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"exams",filter:`subject_id=eq.${sid}`},refresh)
    .subscribe();
  state.roomChannel=ch;
}



function notificationStorageKey(id){return `docnr-os-notified:${uid()||"anon"}:${id||"unknown"}`}
function mobileNotificationSupported(){return "Notification" in window&&"serviceWorker" in navigator}
function notificationPermissionText(){
  if(!mobileNotificationSupported())return "อุปกรณ์นี้ไม่รองรับ Pop-up";
  if(Notification.permission==="granted")return "Pop-up โทรศัพท์: เปิดแล้ว";
  if(Notification.permission==="denied")return "Pop-up โทรศัพท์: ถูกปิดในตั้งค่า Browser";
  return "เปิด Pop-up แจ้งเตือนบนอุปกรณ์นี้";
}
async function requestMobileNotificationPermission(){
  if(!mobileNotificationSupported()){toast("Browser นี้ไม่รองรับการแจ้งเตือนของระบบปฏิบัติการ",true);return false}
  let permission=Notification.permission;
  if(permission!=="granted")permission=await Notification.requestPermission();
  if(permission==="granted"){
    localStorage.setItem("docnr-mobile-notifications","enabled");
    toast("เปิดแจ้งเตือน Pop-up บนอุปกรณ์นี้แล้ว");
    await replayPendingDeadlineNotifications();
    return true;
  }
  toast("ยังไม่ได้รับสิทธิ์แจ้งเตือน กรุณาอนุญาต Notifications ใน Browser/ระบบปฏิบัติการ",true);return false;
}
async function showOsNotification(n,{force=false}={}){
  if(!n||!mobileNotificationSupported()||Notification.permission!=="granted")return false;
  const id=n.id||`${n.type||"notification"}:${n.created_at||Date.now()}`,key=notificationStorageKey(id);
  if(!force&&localStorage.getItem(key))return false;
  const urgent=n.type==="worksheet_due_now"||n.metadata?.urgency==="critical";
  try{
    const reg=await navigator.serviceWorker.ready;
    await reg.showNotification(n.title||"Nangrong Smart Worksheet",{
      body:n.message||"มีการแจ้งเตือนใหม่",
      icon:"./icons/nangrong-app-192-v1761.png",
      badge:"./icons/nangrong-favicon-48-v1761.png",
      tag:`docnr-${id}`,
      renotify:true,
      requireInteraction:urgent,
      vibrate:urgent?[250,120,250,120,400]:[180,80,180],
      data:{route:n.metadata?.route||"work",notification_id:n.id||null,metadata:n.metadata||{}},
      actions:[{action:"open",title:"เปิดงานของฉัน"}]
    });
    localStorage.setItem(key,String(Date.now()));return true;
  }catch(e){
    try{new Notification(n.title||"Nangrong Smart Worksheet",{body:n.message||"มีการแจ้งเตือนใหม่",icon:"./icons/nangrong-app-192-v1761.png"});localStorage.setItem(key,String(Date.now()));return true}catch{return false}
  }
}
async function replayPendingDeadlineNotifications(){
  if(!uid()||Notification.permission!=="granted")return;
  const {data,error}=await client().rpc("my_pending_deadline_notifications");if(error)return;
  for(const n of Array.isArray(data)?data:[])await showOsNotification(n);
}
function handleNotificationRoute(route){
  route=String(route||"work");
  if(window.DOCNR_BASE?.navigate)window.DOCNR_BASE.navigate(route);
}
function bindNotificationClickBridge(){
  if(state.notificationBridgeBound)return;state.notificationBridgeBound=true;
  navigator.serviceWorker?.addEventListener?.("message",e=>{if(e.data?.type==="DOCNR_NOTIFICATION_CLICK")handleNotificationRoute(e.data.route||"work")});
  const q=new URLSearchParams(location.search),r=q.get("notifyRoute");
  if(r){setTimeout(()=>handleNotificationRoute(r),900);q.delete("notifyRoute");const qs=q.toString();history.replaceState(null,"",location.pathname+(qs?`?${qs}`:"")+location.hash)}
}
function notificationTime(meta,created){
  const t=meta?.scanned_at||meta?.updated_at||created;
  return t?new Date(t).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"medium"}):"-";
}
async function refreshNotificationBadge(){
  const p=await getProfile();if(!p)return;
  const {count}=await client().from("app_notifications").select("id",{count:"exact",head:true}).eq("user_id",uid()).is("read_at",null);
  const badge=$("#v161-notification-count");if(badge){const n=count||0;badge.textContent=n>99?"99+":String(n);badge.hidden=!n}
}
function ensureNotificationUI(){
  bindNotificationClickBridge();
  const bar=$(".topbar .row:last-child");if(!bar||$("#v161-notification-button"))return;
  const b=document.createElement("button");b.type="button";b.id="v161-notification-button";b.className="btn sm v161-notify-btn";
  b.innerHTML=`🔔<span id="v161-notification-count" hidden>0</span>`;b.title="การแจ้งเตือน • Deadline Pop-up";bar.insertBefore(b,bar.firstChild);
  b.onclick=showNotificationPanel;
}
async function showNotificationPanel(){
  $("#v161-notification-panel")?.remove();
  const {data,error}=await client().from("app_notifications").select("id,type,title,message,metadata,read_at,created_at").eq("user_id",uid()).order("created_at",{ascending:false}).limit(40);
  if(error){toast(errorText(error),true);return}
  const panel=document.createElement("aside");panel.id="v161-notification-panel";panel.className="v161-notification-panel";
  const permission=typeof Notification!=="undefined"?Notification.permission:"unsupported";
  panel.innerHTML=`<div class="v161-notification-head"><div><b>🔔 การแจ้งเตือน</b><small>Real-time • เตือนก่อนหมดเวลาส่ง 1 ชั่วโมง</small></div><button class="btn sm" id="v161-notification-close">✕</button></div>
    <div class="v178-notify-permission ${permission==='granted'?'ready':''}"><div><b>📱 ${esc(notificationPermissionText())}</b><small>${permission==='granted'?'ระบบจะแสดง Pop-up ของโทรศัพท์/แท็บเล็ต/คอมเมื่อแอปมี Session ทำงาน':'แตะเปิดสิทธิ์เพื่อรับ Pop-up บนอุปกรณ์นี้'}</small></div>${permission==='granted'?`<span class="v178-ready-dot">● พร้อม</span>`:`<button class="btn sm primary" id="v178-enable-notifications">เปิดแจ้งเตือนมือถือ</button>`}</div>
    <div class="v161-notification-list">${(data||[]).map(n=>`<button class="v161-notification-item ${n.read_at?"":"unread"}" data-v161-notification="${n.id}" data-v178-route="${esc(n.metadata?.route||'work')}">
      <b>${esc(n.title)}</b><span>${esc(n.message)}</span><small>${notificationTime(n.metadata,n.created_at)}</small>
    </button>`).join("")||`<div class="v14-empty">ยังไม่มีการแจ้งเตือน</div>`}</div>`;
  document.body.appendChild(panel);$("#v161-notification-close").onclick=()=>panel.remove();
  const enable=$("#v178-enable-notifications");if(enable)enable.onclick=async()=>{if(await requestMobileNotificationPermission()){panel.remove();showNotificationPanel()}};
  panel.addEventListener("click",e=>{const n=e.target.closest("[data-v178-route]");if(n){handleNotificationRoute(n.dataset.v178Route||"work");panel.remove()}});
  const unread=(data||[]).filter(n=>!n.read_at);
  await Promise.all(unread.map(n=>client().rpc("mark_notification_read",{p_notification_id:n.id}).catch(()=>null)));
  refreshNotificationBadge();
}
async function startNotificationRealtime(){
  const currentUid=uid();if(!currentUid)return;
  bindNotificationClickBridge();
  if(state.notificationReady&&state.notificationUid===currentUid){ensureNotificationUI();replayPendingDeadlineNotifications().catch(()=>{});return}
  state.notificationReady=true;state.notificationUid=currentUid;ensureNotificationUI();await refreshNotificationBadge();
  if(Notification.permission==="granted")replayPendingDeadlineNotifications().catch(()=>{});
  const rt=await realtimeClient();if(!rt)return;
  if(state.notificationChannel)try{rt.removeChannel(state.notificationChannel)}catch{}
  state.notificationChannel=rt.channel(`app-notifications-${currentUid}-${Date.now()}`)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"app_notifications",filter:`user_id=eq.${currentUid}`},payload=>{
      const n=payload.new||{};refreshNotificationBadge();
      toast(`${n.title||"แจ้งเตือน"} • ${n.message||""}`);
      if(["worksheet_due_1h","worksheet_due_now","worksheet_graded","submission_received"].includes(n.type))showOsNotification(n).catch(()=>{});
      if(state.route==="attendance"){
        const banner=$("#v161-latest-checkin");
        if(banner&&n.type==="attendance_checked")banner.innerHTML=`<b>✅ ${esc(n.title||"เช็คชื่อแล้ว")}</b><span>${esc(n.message||"")}</span><small>${notificationTime(n.metadata,n.created_at)}</small>`;
      }
    }).subscribe();
}
function navBtn(route,label){const b=document.createElement("button");b.type="button";b.dataset.v14Route=route;b.className="v14-nav nav-card-btn";const parts=String(label||"").trim().split(/\s+/),icon=/^[^\p{L}\p{N}]/u.test(parts[0]||"")?parts.shift():"•";b.innerHTML=`<span class="nav-card-icon">${esc(icon)}</span><span class="nav-card-label">${esc(parts.join(" ")||label)}</span>`;return b}
async function ensureNav(){
  const p=await getProfile();if(!p)return;
  const brand=$("#sidebar .brand .smalltext");
  if(brand)brand.textContent=`${p.role==="admin"?"ADMIN":"USER"} • ${RELEASE_VERSION}`;
  // V17: app.js is the single owner of Sidebar and route buttons.
  // Remove extension-owned navigation left by older cached DOMs.
  $$("#sidebar .nav [data-v14-route],#sidebar .nav [data-v16-primary-nav],#sidebar .nav [data-v14-divider]").forEach(x=>x.remove());
}
function scheduleEnsureNav(){if(state.navTimer)return;state.navTimer=setTimeout(()=>{state.navTimer=null;ensureNav().catch(()=>{});ensureNotificationUI();startNotificationRealtime().catch(()=>{});refreshNotificationBadge().catch(()=>{})},80)}
const shellObserver=new MutationObserver(scheduleEnsureNav);
shellObserver.observe($("#app")||document.body,{childList:true,subtree:true});

async function otpConfig(){return {enabled:false,mode:"disabled",phone_profile_only:true}}
async function requirePhoneGate(){return false}
async function navigate(route,arg=null){
  clearPresenceChannel();clearRoomChannel();state.route=route;state.subjectId=null;heartbeat();
  const p=await getProfile(true);if(!p)return;
  if(await requirePhoneGate(route))return;
  // Legacy contract marker: workcheck:renderRoomWorkChecklist
const routes=p.role==="admin"?{
    dashboard:renderAdminDashboard,
    courses:()=>arg?renderAdminSubject(arg):renderAdminCourses(),
    students:renderStudentsHub,
    workadmin:renderWorkAdminHub,
    workcheck:()=>renderRoomWorkChecklist(arg),
    printcenter:()=>arg?renderPrintSubjectV196(arg):renderPrintCenterV196(),
    paperscan:renderPaperScanHub,
    attendancehub:renderAttendanceHub,
    academic:renderAcademicHub,
    accounts:renderAccountApprovals,
    enrollments:renderEnrollmentAdmin,
    profiles:renderAdminProfiles,
    attendance:renderAttendance,
    presence:renderPresence,
    promotion:renderPromotion
  }:{
    dashboard:renderStudentDashboard,
    catalog:renderCourseRegistrationHome,
    enroll:renderEnrollSubjects,
    courses:()=>arg?renderStudentCourse(arg):renderStudentCourses(),
    work:renderWorkStatus,
    printcenter:()=>arg?renderPrintSubjectV196(arg):renderPrintCenterV196(),
    history:renderAcademicHistory,
    attendance:renderAttendance,
    presence:renderPresence
  };
  const fn=routes[route];
  if(!fn)throw new Error(`FEATURE_ROUTE_NOT_IMPLEMENTED:${route}`);
  try{await fn()}catch(e){
    console.error("DOC-FULL-NR feature route",route,e);
    if(content())content().innerHTML=`<div class="alert error"><b>เปิดเมนูไม่สำเร็จ</b><div>${esc(errorText(e))}</div><div class="row"><button class="btn primary" data-app-route="${esc(route)}">ลองใหม่</button><button class="btn" data-app-route="dashboard">กลับหน้าแรก</button></div></div>`;
    throw e;
  }
}

document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");if(!t)return;
  const custom=t.closest("[data-v14-route]");
  if(custom){e.preventDefault();e.stopImmediatePropagation();window.DOCNR_BASE?.navigate?.(custom.dataset.v14Route);return}
  const retry=t.closest("[data-v14-retry]");if(retry){e.preventDefault();window.DOCNR_BASE?.navigate?.(retry.dataset.v14Retry);return}
  // V17: data-route belongs exclusively to app.js. This module never intercepts Sidebar clicks.
},true);


// ---------------------------------------------------------------------------
// Account approval: separate from subject enrollment
// ---------------------------------------------------------------------------
async function renderAccountApprovals(){
  setTitle("คำขอบัญชี");busy("กำลังโหลดคำขอลงทะเบียน...");
  const {data,error}=await client().from("profiles")
    .select("id,username,full_name,display_name,student_code,birth_date,contact_email,phone,grade_level,room_label,class_name,department,major,approval_status,approval_requested_at,approved_at,rejection_reason,active,created_at")
    .eq("role","user").order("created_at",{ascending:false});
  if(error)throw error;
  const rows=data||[];
  const counts={pending:0,approved:0,rejected:0,suspended:0};rows.forEach(x=>counts[x.approval_status||"approved"]=(counts[x.approval_status||"approved"]||0)+1);
  content().innerHTML=`<section class="v14-page">
    <div class="v14-section-head"><div><span class="v14-kicker">ACCOUNT APPROVAL</span><h1>คำขอลงทะเบียนบัญชี</h1><p>อนุมัติบัญชีก่อนเข้าถึงรายวิชา ใบงาน Attendance และ Exam</p></div><div class="v14-stat-pill">${counts.pending||0} รออนุมัติ</div></div>
    <div class="v14-kpis four"><div><span>รออนุมัติ</span><b>${counts.pending||0}</b></div><div><span>อนุมัติแล้ว</span><b>${counts.approved||0}</b></div><div><span>ไม่อนุมัติ</span><b>${counts.rejected||0}</b></div><div><span>ระงับ</span><b>${counts.suspended||0}</b></div></div>
    <div class="card v14-filter v164-filter-grid">
      <input id="v15-account-q" class="input" placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัส / เบอร์โทร">
      <select id="v15-account-status" class="input"><option value="">ทุกสถานะ</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ไม่อนุมัติ</option><option value="suspended">ระงับ</option></select>
      <select id="v15-account-level" class="input"><option value="">ทุกระดับชั้น</option></select>
      <select id="v15-account-room" class="input"><option value="">ทุกห้อง/กลุ่ม</option></select>
      <select id="v15-account-dept" class="input"><option value="">ทุกแผนก</option></select>
      <select id="v15-account-major" class="input"><option value="">ทุกสาขา</option></select>
    </div>
    <div class="table-wrap"><table><thead><tr><th>ผู้สมัคร</th><th>รหัส</th><th>ชั้น/ห้อง</th><th>อีเมล</th><th>วันที่สมัคร</th><th>สถานะ</th><th></th></tr></thead><tbody id="v15-account-body"></tbody></table></div>
  </section>`;
  const fillSelect=(id,values)=>{const el=$(id);[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"th")).forEach(x=>el.insertAdjacentHTML("beforeend",`<option value="${esc(x)}">${esc(x)}</option>`))};
  fillSelect("#v15-account-level",rows.map(x=>x.grade_level));fillSelect("#v15-account-room",rows.map(x=>x.room_label));fillSelect("#v15-account-dept",rows.map(x=>x.department));fillSelect("#v15-account-major",rows.map(x=>x.major));
  const draw=()=>{
    const q=$("#v15-account-q").value.trim().toLowerCase(),st=$("#v15-account-status").value,level=$("#v15-account-level").value,room=$("#v15-account-room").value,dept=$("#v15-account-dept").value,major=$("#v15-account-major").value;
    const f=rows.filter(x=>(!st||(x.approval_status||"approved")===st)&&(!level||x.grade_level===level)&&(!room||x.room_label===room)&&(!dept||x.department===dept)&&(!major||x.major===major)&&(!q||`${x.full_name||""} ${x.display_name||""} ${x.student_code||""} ${x.phone||""} ${x.class_name||""}`.toLowerCase().includes(q)));
    $("#v15-account-body").innerHTML=f.map(x=>{
      const status=x.approval_status||"approved",cls=status==="approved"?"approved":status==="pending"?"pending":"bad";
      return `<tr><td><b>${esc(x.full_name||"-")}</b><div class="muted smalltext">ชื่อเล่น: ${esc(x.display_name&&x.display_name!==x.full_name?x.display_name:"-")} • ${esc(x.department||"")} ${esc(x.major||"")}</div></td><td>${esc(x.student_code||x.username||"-")}</td><td>${esc(x.grade_level||"")}${esc(x.room_label||"")}</td><td>${esc(x.contact_email||"-")}</td><td>${fmt(x.approval_requested_at||x.created_at)}</td><td><span class="v14-status ${cls}">${status==="pending"?"รออนุมัติ":status==="approved"?"อนุมัติแล้ว":status==="rejected"?"ไม่อนุมัติ":"ระงับ"}</span>${x.rejection_reason?`<div class="muted smalltext">${esc(x.rejection_reason)}</div>`:""}</td><td><div class="row">${status!=="approved"?`<button class="btn sm green" data-v15-account="${x.id}" data-account-status="approved">อนุมัติ</button>`:""}${status!=="rejected"?`<button class="btn sm red" data-v15-account="${x.id}" data-account-status="rejected">ไม่อนุมัติ</button>`:""}${status==="approved"?`<button class="btn sm warn" data-v15-account="${x.id}" data-account-status="suspended">ระงับ</button>`:""}</div></td></tr>`;
    }).join("")||`<tr><td colspan="7" class="v14-empty">ไม่พบข้อมูล</td></tr>`;
  };
  draw();["#v15-account-q","#v15-account-status","#v15-account-level","#v15-account-room","#v15-account-dept","#v15-account-major"].forEach(id=>{const el=$(id);if(el){el.oninput=draw;el.onchange=draw}});
}
async function decideAccount(id,status){
  let reason=null;
  if(status==="rejected"||status==="suspended"){reason=prompt(status==="rejected"?"เหตุผลที่ไม่อนุมัติ":"เหตุผลการระงับบัญชี","");if(reason===null)return}
  if(!ask(status==="approved"?"ยืนยันอนุมัติบัญชีนี้?":"ยืนยันการเปลี่ยนสถานะบัญชี?"))return;
  const r=await client().rpc("decide_account_approval",{p_user_id:id,p_status:status,p_reason:reason||null});
  if(r.error){toast(errorText(r.error),true);return}
  toast(status==="approved"?"อนุมัติบัญชีแล้ว":"บันทึกสถานะบัญชีแล้ว");renderAccountApprovals();
}

// ---------------------------------------------------------------------------
// Student academic history (read-only)
// ---------------------------------------------------------------------------
async function renderAcademicHistory(){
  setTitle("ประวัติการศึกษา");busy("กำลังโหลดประวัติการศึกษา...");
  const p=await getProfile(true);
  const {data,error}=await client().from("academic_history")
    .select("id,academic_year,semester,grade_level,room_label,class_name,seat_number,academic_status,decision,effective_at,created_at")
    .eq("user_id",uid()).order("effective_at",{ascending:false});
  if(error)throw error;
  const rows=data||[];
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ACADEMIC HISTORY</span><h1>ประวัติการศึกษา</h1><p>ข้อมูลแบบอ่านอย่างเดียว • แก้ไขได้โดย Admin ผ่านกระบวนการปีการศึกษาเท่านั้น</p></div></div>
    <div class="card"><div class="v14-info-grid"><div><span>สถานะปัจจุบัน</span><b>${esc(p?.academic_status||"studying")}</b></div><div><span>ระดับ/ห้องปัจจุบัน</span><b>${esc(p?.grade_level||"-")} ${esc(p?.room_label||"")}</b></div><div><span>รหัสนักศึกษา</span><b>${esc(p?.student_code||"-")}</b></div></div></div>
    <div class="v15-history-timeline">${rows.map(x=>`<article class="card v15-history-item"><div><span class="v14-kicker">${esc(x.academic_year||"-")} • ภาค ${esc(x.semester||"-")}</span><h3>${esc(x.grade_level||"-")} ${esc(x.room_label||"")}</h3><p>${esc(x.class_name||"")} ${x.seat_number?`• เลขที่ ${x.seat_number}`:""}</p></div><div><span class="v14-status approved">${esc(x.decision||x.academic_status||"-")}</span><small>${fmt(x.effective_at||x.created_at)}</small></div></article>`).join("")||`<div class="v14-empty">ยังไม่มีประวัติปีการศึกษาที่ปิดแล้ว • ข้อมูลปัจจุบันแสดงด้านบน</div>`}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Shared work / course helpers
// ---------------------------------------------------------------------------
async function approvedCourses(userId=uid()){
  const c=client();const {data:e,error}=await c.from("subject_enrollments").select("id,subject_id,status,requested_at,decided_at").eq("user_id",userId).eq("status","approved");
  if(error)throw error;const ids=(e||[]).map(x=>x.subject_id);if(!ids.length)return [];
  const {data:s,error:se}=await c.from("subjects").select("id,code,name,color_hex,semester,academic_year,description").in("id",ids).order("code");if(se)throw se;
  const em=new Map((e||[]).map(x=>[x.subject_id,x]));return (s||[]).map(x=>({...x,enrollment:em.get(x.id)}));
}
async function allSubjects(){const {data,error}=await client().from("subjects").select("id,code,name,color_hex,semester,academic_year,description,subject_type,active").eq("active",true).eq("subject_type","subject").order("code");if(error)throw error;return data||[]}
async function studentWorkRows(){
  const id=uid(),c=client();
  const {data:a,error}=await c.from("worksheet_assignments").select("worksheet_id,assigned_at,assignment_source").eq("user_id",id).order("assigned_at",{ascending:false});if(error)throw error;
  const ids=[...new Set((a||[]).map(x=>x.worksheet_id))];if(!ids.length)return [];
  const [wr,sr]=await Promise.all([
    c.from("worksheets").select("id,subject_id,title,reference_code,mode,status,open_at,due_at,allow_late,settings,subjects(id,code,name,color_hex)").in("id",ids),
    c.from("submissions").select("worksheet_id,status,submitted_at,confirmed_at,is_late,last_saved_at,attempt_count,updated_at").eq("user_id",id).in("worksheet_id",ids)
  ]);if(wr.error)throw wr.error;if(sr.error)throw sr.error;
  const sm=new Map();for(const s of sr.data||[]){const old=sm.get(s.worksheet_id);if(!old||new Date(s.updated_at||s.last_saved_at||s.submitted_at||0)>=new Date(old.updated_at||old.last_saved_at||old.submitted_at||0))sm.set(s.worksheet_id,s)}
  const groups=new Map();
  for(const w of wr.data||[]){
    const key=String(w.settings?.work_pair_key||w.id),g=groups.get(key)||{key,digital:null,paper:null};
    if(w.mode==="digital")g.digital=w;else if(w.mode==="paper")g.paper=w;groups.set(key,g);
  }
  const finalKeys=new Set(["submitted","confirmed","graded"]);
  const now=nowMs();
  return [...groups.values()].map(g=>{
    const d=g.digital,p=g.paper,w=d||p,ds=d?sm.get(d.id):null,ps=p?sm.get(p.id):null;
    const due=d?.due_at?new Date(d.due_at).getTime():(w?.due_at?new Date(w.due_at).getTime():null);
    const open=d?.open_at?new Date(d.open_at).getTime():(w?.open_at?new Date(w.open_at).getTime():null);
    let status;
    if(ds?.status==="graded")status={key:"graded",label:"ตรวจแล้ว",cls:"ok"};
    else if(ds&&finalKeys.has(ds.status))status={key:"sent",label:"ส่งออนไลน์แล้ว",cls:"ok"};
    else if(ps?.status==="graded")status={key:"graded",label:"ตรวจงานย้อนหลังแล้ว",cls:"ok"};
    else if(ps&&finalKeys.has(ps.status))status={key:"late",label:"ส่งย้อนหลังแล้ว",cls:"warn"};
    else if(ds?.status==="draft")status={key:"draft",label:"บันทึกร่าง",cls:"draft"};
    else if(open&&open>now)status={key:"upcoming",label:"ยังไม่เปิด",cls:"muted"};
    else if(due&&due<now)status={key:"overdue",label:"เกินกำหนด • พิมพ์ย้อนหลัง",cls:"bad"};
    else status={key:"pending",label:"ยังไม่ส่ง",cls:"wait"};
    return {...g,w,digitalSubmission:ds,paperSubmission:ps,status};
  }).sort((x,y)=>(new Date(x.digital?.due_at||x.w?.due_at||"9999-12-31")-new Date(y.digital?.due_at||y.w?.due_at||"9999-12-31")));
}
function workStatus(w,s){
  const now=nowMs(),open=w.open_at?new Date(w.open_at).getTime():null,due=w.due_at?new Date(w.due_at).getTime():null;
  if(s?.status==="graded")return {key:"graded",label:"ตรวจแล้ว",cls:"ok"};
  if(s&&["submitted","confirmed"].includes(s.status)){const late=s.is_late||(due&&s.submitted_at&&new Date(s.submitted_at).getTime()>due);return {key:late?"late":"sent",label:late?"ส่งแล้ว (ช้า)":"ส่งแล้ว",cls:late?"warn":"ok"}}
  if(s?.status==="draft")return {key:"draft",label:"บันทึกร่าง",cls:"draft"};
  if(open&&open>now)return {key:"upcoming",label:"ยังไม่เปิด",cls:"muted"};
  if(due&&due<now)return {key:"overdue",label:"เกินกำหนด",cls:"bad"};
  return {key:"pending",label:"ยังไม่ส่ง",cls:"wait"};
}
function workCard(row){
  const w=row.digital||row.paper||row.w,status=row.status,d=row.digital,p=row.paper;
  const done=["sent","late","graded"].includes(status.key);
  const overdue=status.key==="overdue";
  const action=done?`<button class="btn" disabled>✅ บันทึกงานแล้ว</button>`:
    overdue&&p?`<button class="btn warn" data-v175-late-paper="${p.id}">🖨️ พิมพ์ใบงานส่งย้อนหลัง</button>`:
    d?`<button class="btn primary" data-v14-open-work="${d.id}">📝 ทำใบงานประจำหน่วย</button>`:
    `<button class="btn" disabled>ยังไม่มีใบงาน</button>`;
  return `<article class="v14-work-card v176-workpair-card" style="--course:${esc(w?.subjects?.color_hex||"#22d3ee")}">
    <div class="v14-work-main"><div class="v14-course-chip">${esc(w?.subjects?.code||"")} ${esc(w?.subjects?.name||"")}</div><h3>${esc(w?.settings?.unit_topic||String(w?.title||"").replace(/^ใบงาน[^:]*:\s*/,""))}</h3>
    <div class="v14-meta">📝 ใบงานประจำหน่วย • 💻 ส่งตรงเวลา / 🖨️ ส่งย้อนหลัง • กำหนด ${fmt(d?.due_at||w?.due_at)}</div>
    <div class="v176-pair-codes"><span>${esc(d?.reference_code||"-")}</span><span>${esc(p?.reference_code||"-")}</span></div></div>
    <div class="v14-work-side"><span class="v14-status ${status.cls}">${esc(status.label)}</span>${!done&&d?.due_at?`<b class="v14-countdown" data-v14-countdown="${esc(d.due_at)}"></b>`:""}${action}</div>
  </article>`;
}
function dashboardRouteCard(route,icon,title,desc,tone="blue"){
  return `<button class="v1610-flow-card ${tone}" data-app-route="${esc(route)}"><span class="v1610-flow-icon">${icon}</span><span><b>${esc(title)}</b><small>${esc(desc)}</small></span><i>›</i></button>`;
}
function hubCard(route,icon,title,desc,tone="blue"){
  return `<button class="v1610-flow-card ${tone}" data-app-route="${esc(route)}"><span class="v1610-flow-icon">${icon}</span><span><b>${esc(title)}</b><small>${esc(desc)}</small></span><i>›</i></button>`;
}
async function renderAdminDashboard(){
  setTitle("หน้าแรก");
  const p=await getProfile();
  content().innerHTML=`<section class="v14-page v1610-dashboard"><div class="v1610-dashboard-hero"><img class="v172-dashboard-seal" src="./icons/icon-192.png" alt="ตราวิทยาลัยเทคนิคนางรอง"><div><span class="v14-kicker">DOC-FULL-NR • ${RELEASE_VERSION}</span><h1>ศูนย์ควบคุมการเรียนการสอน</h1><p>จัดการการเรียนการสอน กิจกรรม งาน คะแนน เช็คชื่อ สอบ พิมพ์ และระบบจากหน้าเดียว</p></div><div class="v1610-health" id="v1610-health"><i></i><b>กำลังตรวจ Backend</b><small>Health Check ไม่บล็อกการใช้งาน</small></div></div>
  <div class="v1610-flow-grid">${dashboardRouteCard("courses","📚","การเรียนการสอน","CODE • 17 หน่วย • สไลด์สอนจริง 20 หน้า • ใบงานคู่","cyan")}${dashboardRouteCard("specialactivity","🎮","กิจกรรมพิเศษ","Code Typing Academy • Practice • Ranking • Official Challenge","orange")}${dashboardRouteCard("students","👨‍🎓","นักศึกษาและสิทธิ์","อนุมัติบัญชี • สมาชิกวิชา • โปรไฟล์","green")}${dashboardRouteCard("workadmin","📝","งานและคะแนน","ตรวจงาน • Gradebook • รายงาน • Export","violet")}${dashboardRouteCard("workcheck","✅","ตารางเช็กรวมรายห้อง","ระดับ • ห้อง • แผนก • สาขา • 17 หน่วย","cyan")}${dashboardRouteCard("printcenter","🖨️","ศูนย์พิมพ์และสรุปผล","คะแนน • เช็กงาน • Attendance • ใบงาน • PDF","green")}${dashboardRouteCard("attendancehub","📷","เช็คชื่อและห้องเรียน","QR • 15 นาที • หัวหน้าห้อง • Online","orange")}${dashboardRouteCard("exam","🧪","ระบบสอบ","Question Bank • 50 ข้อ • 75 นาที","red")}${dashboardRouteCard("academic","⚙️","ปีการศึกษาและระบบ","Promotion • Audit • Settings","slate")}</div>
  <div class="card v1610-system-note"><b>${esc(p?.full_name||"Admin")}</b><span>Flow ประจำวัน: รายวิชา → เปิดหน่วย → สื่อ/ใบงาน → เช็คชื่อ → สอบ → คะแนน → รายงาน</span></div></section>`;
  Promise.race([client().rpc("admin_system_health_v18"),new Promise(resolve=>setTimeout(()=>resolve({error:new Error("timeout")}),4500))]).then(r=>{
    const el=$("#v1610-health");if(!el)return;const ok=!r?.error&&r?.data?.backend_ok;
    el.classList.toggle("ok",!!ok);el.innerHTML=ok?`<i></i><b>Backend พร้อมใช้งาน</b><small>${Number(r.data.active_subjects||0)} วิชา • ${Number(r.data.standard_templates||0)} ใบงาน • RPC ${Number(r.data.critical_rpcs||0)}/15</small>`:`<i></i><b>Dashboard พร้อมใช้งาน</b><small>Health Contract ตรวจไม่ครบ • เปิด System Health เพื่อตรวจรายละเอียด</small>`;
  }).catch(()=>{});
}
async function renderStudentDashboard(){
  setTitle("หน้าแรก");const p=await getProfile();
  content().innerHTML=`<section class="v14-page v1610-dashboard"><div class="v1610-dashboard-hero"><img class="v172-dashboard-seal" src="./icons/icon-192.png" alt="ตราวิทยาลัยเทคนิคนางรอง"><div><span class="v14-kicker">SMART LEARNING • ${RELEASE_VERSION}</span><h1>สวัสดี ${esc(p?.display_name||p?.full_name||"นักศึกษา")}</h1><p>เลือกงานจากปุ่มใหญ่ ระบบจะพาเข้าสู่ขั้นตอนจริงโดยตรง</p></div><div class="v1610-student-id"><span>🎓</span><b>${esc(p?.student_code||"นักศึกษา")}</b><small>${esc(`${p?.grade_level||""}${p?.room_label||""}`)}</small></div></div>
  <div class="v1610-flow-grid">${dashboardRouteCard("catalog","📚","รายวิชาทั้งหมด / ใส่ CODE","เลือกวิชาและใช้ CODE จากครู","cyan")}${dashboardRouteCard("courses","🏫","การเรียนการสอน","17 หน่วย • สไลด์สอนจริง 20 หน้า • ใบงานประจำหน่วย","green")}${dashboardRouteCard("specialactivity","🎮","กิจกรรมพิเศษ","Code Typing Academy • Practice • Ranking • Challenge","orange")}${dashboardRouteCard("work","📋","งานและคะแนนของฉัน","งานค้าง • Draft • ส่งแล้ว • กำหนดเวลา","violet")}${dashboardRouteCard("printcenter","🖨️","พิมพ์เอกสารของฉัน","ใบงานย้อนหลัง • สรุปงาน • PDF","green")}${dashboardRouteCard("attendance","📷","เช็คชื่อ","QR และประวัติการเข้าเรียน","orange")}${dashboardRouteCard("exam","🧪","ข้อสอบ","เข้าสอบเมื่อครูเปิด","red")}${dashboardRouteCard("profile","👤","ข้อมูลของฉัน","โปรไฟล์อ่านอย่างเดียว • ประวัติการศึกษา","slate")}</div>
  <div class="card v1610-system-note"><b>ลำดับการเรียน</b><span>รายวิชา → CODE → ครูปลดล็อกหน่วย → สไลด์/ใบงาน → ส่งงาน → เช็คชื่อ/สอบ</span></div></section>`;
}
async function renderStudentsHub(){
  setTitle("นักศึกษาและสิทธิ์");
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">STUDENT & ACCESS FLOW</span><h1>👨‍🎓 นักศึกษาและสิทธิ์</h1><p>รวมบัญชี สิทธิ์เข้าใช้งาน สมาชิกวิชา และข้อมูลนักศึกษาไว้ใน Flow เดียว</p></div></div><div class="v1610-flow-grid">${hubCard("accounts","🟢","อนุมัติบัญชี","Pending → Approved / Rejected / Suspended","green")}${hubCard("users","👥","จัดการผู้ใช้","สร้าง • แก้ข้อมูล • ระงับ • Reset Password","cyan")}${hubCard("enrollments","🔐","สมาชิกและสิทธิ์รายวิชา","ตรวจสมาชิก/คำขอรายวิชา","orange")}${hubCard("profiles","🪪","โปรไฟล์นักศึกษา","ข้อมูลการศึกษาแก้โดย Admin เท่านั้น","violet")}</div></section>`;
}
async function renderWorkAdminHub(){
  setTitle("งาน คะแนน และรายงาน");
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">WORK • GRADE • REPORT FLOW</span><h1>📝 งาน คะแนน และรายงาน</h1><p>ตรวจ Submission ให้คะแนน จัดสิทธิ์ส่งเพิ่ม และสรุปผลจากข้อมูลจริง</p></div></div><div class="v1610-flow-grid">${hubCard("workcheck","✅","ตารางเช็กรวมรายห้อง","แยกตามระดับ • ห้อง • แผนก • สาขา • ใบงาน 17 หน่วย","cyan")}${hubCard("printcenter","🖨️","ศูนย์พิมพ์และสรุปผล","เอกสารทางการ • คะแนน • Attendance • ใบงาน","green")}${hubCard("grading","📝","ตรวจงาน","Submission • Answer • Files • Rubric • Grade","violet")}${hubCard("paperscan","📄","สแกนงานย้อนหลัง","Barcode • ถ่ายครบทุกหน้า • ยืนยัน Packet","red")}${hubCard("overrides","⏳","สิทธิ์ส่งเพิ่ม","ขยายเวลา • ส่งซ้ำ • Extra Attempts","orange")}${hubCard("courses","📊","Gradebook รายวิชา","เข้า Course → สรุปคะแนน 40/20/20/20","cyan")}${hubCard("reports","📤","รายงาน / Export","Submission • คะแนน • CSV/Excel","green")}</div></section>`;
}

// ---------------------------------------------------------------------------
// V18.6 Room worksheet checklist
// Admin-only matrix grouped from registration metadata + approved enrollment.
// Digital/Paper of the same work_pair_key is intentionally one column.
// ---------------------------------------------------------------------------
function v186Unique(rows,key){return [...new Set(rows.map(x=>String(x?.[key]||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"))}
function v186Opt(values,label="ทั้งหมด"){return `<option value="">${esc(label)}</option>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}`}
function v186UnitNo(pair){return Number(pair?.digital?.settings?.sequence_no||pair?.paper?.settings?.sequence_no||pair?.digital?.settings?.lesson_sequence||pair?.paper?.settings?.lesson_sequence||999)}
function v186WorkLabel(pair,subject){const n=v186UnitNo(pair),name=String(subject?.name||"รายวิชา").trim();return `ใบงาน${name}${Number.isFinite(n)&&n<999?` หน่วยที่ ${n}`:""}`}
function v186WorkTopic(pair){return String(pair?.digital?.settings?.unit_topic||pair?.paper?.settings?.unit_topic||pair?.title||"").trim()}
function v186ClassTitle(rows,filters){
  const first=rows[0]||{},grade=filters.grade||first.grade_level||"",room=filters.room||first.room_label||"",major=filters.major||first.major||"";
  const abbr=(major.match(/\(([^)]+)\)/)||[])[1]||"",num=(grade.match(/(\d+)/)||[])[1]||grade;
  return `${abbr?abbr+" ":""}${num||""}${room||""}`.trim()||"หลายห้อง";
}
function v186SubmissionMap(detail){
  const priority={graded:5,confirmed:4,submitted:3,draft:2};const map=new Map();
  for(const x of detail.submissions||[]){const k=`${x.user_id}:${x.pair_id}`,old=map.get(k);if(!old||Number(priority[x.status]||0)>Number(priority[old.status]||0)||(!old.is_late&&x.is_late))map.set(k,x)}
  return map;
}
function v186CellState(uid,pair,assigned,subMap){
  const key=`${uid}:${pair.id}`;if(!assigned.has(key))return {label:"—",cls:"na",text:"ยังไม่ได้มอบหมาย"};
  const sub=subMap.get(key);if(sub){if(sub.status==="draft")return {label:"ร",cls:"draft",text:"บันทึกร่าง"};if(sub.is_late||sub.worksheet_id===pair.paper?.id)return {label:"ช",cls:"late",text:"ส่งย้อนหลัง / ส่งช้า"};if(["submitted","confirmed","graded"].includes(sub.status))return {label:"✓",cls:"done",text:"ส่งแล้ว"};return {label:"•",cls:"neutral",text:sub.status||"มีรายการส่ง"}}
  const due=pair.digital?.due_at||pair.paper?.due_at;if(due&&new Date(due).getTime()<nowMs())return {label:"✕",cls:"missing",text:"พ้นกำหนดและยังไม่ส่ง"};
  return {label:"/",cls:"waiting",text:"มอบหมายแล้ว / ยังไม่ถึงกำหนดหรือยังไม่ส่ง"};
}
function v186ChecklistTable(subject,students,works,assigned,subMap,gradeMap){
  const heads=works.map(pair=>{const label=v186WorkLabel(pair,subject),topic=v186WorkTopic(pair),n=v186UnitNo(pair);return `<th class="v186-work-head" title="${esc(`${label}${topic?` • ${topic}`:""}`)}"><span>${esc(`ใบงาน${subject.name}`)}</span><b>หน่วยที่ ${Number.isFinite(n)&&n<999?n:"-"}</b>${topic?`<small>${esc(topic)}</small>`:""}</th>`}).join("");
  const body=students.map((p,i)=>{let completed=0,assignedCount=0,late=0,missing=0;const cells=works.map(pair=>{const key=`${p.id}:${pair.id}`;if(assigned.has(key))assignedCount++;const st=v186CellState(p.id,pair,assigned,subMap);if(st.cls==="done"||st.cls==="late")completed++;if(st.cls==="late")late++;if(st.cls==="missing")missing++;return `<td class="v186-status ${st.cls}"><button type="button" class="v186-cell-btn" data-v186-user="${p.id}" data-v186-pair="${esc(pair.id)}" title="${esc(st.text)}">${st.label}</button></td>`}).join("");const gr=gradeMap.get(p.id),note=missing?`ยังไม่ส่ง ${missing}`:late?`ส่งช้า ${late}`:(assignedCount&&completed>=assignedCount?"ส่งครบ":"-");return `<tr><td class="v186-sticky v186-col-no">${i+1}</td><td class="v186-sticky v186-col-code"><b>${esc(p.student_code||"")}</b></td><td class="v186-sticky v186-col-name">${esc(p.full_name||"")}<small>${esc(p.display_name||"")}</small></td>${cells}<td class="v186-summary"><b>${completed}/${assignedCount}</b></td><td class="v186-score">${gr?`${Number(gr.work_score||0).toFixed(2)}/${Number(gr.work_points||40)}`:"-"}</td><td class="v186-note ${missing?"bad":""}">${esc(note)}</td></tr>`}).join("");
  return `<div class="v186-table-scroll"><table class="v186-check-table"><thead><tr><th class="v186-sticky v186-col-no">ลำดับ</th><th class="v186-sticky v186-col-code">รหัสนักศึกษา</th><th class="v186-sticky v186-col-name">ชื่อ - สกุล</th>${heads}<th>ส่งครบ<br>(หน่วย)</th><th>คะแนนงาน</th><th>หมายเหตุ</th></tr></thead><tbody>${body||`<tr><td colspan="${works.length+6}" class="v14-empty">ไม่พบนักศึกษาในกลุ่มที่เลือก</td></tr>`}</tbody></table></div>`;
}
function v186ChecklistExcel(subject,students,works,assigned,subMap,gradeMap,filters){
  const cols=works.length+6,title=`ตารางเช็กรวมการเก็บงาน ${v186ClassTitle(students,filters)}`,meta=`${subject.code} ${subject.name} • ปีการศึกษา ${subject.academic_year||"-"} • ภาคเรียน ${subject.semester||"-"} • ระดับ ${filters.grade||"ทั้งหมด"} • ห้อง ${filters.room||"ทั้งหมด"} • แผนก ${filters.department||"ทั้งหมด"} • สาขา ${filters.major||"ทั้งหมด"}`;
  const head=works.map(x=>`<th>${excelEsc(v186WorkLabel(x,subject))}<br><small>${excelEsc(v186WorkTopic(x))}</small></th>`).join("");
  const body=students.map((p,i)=>{let completed=0,assignedCount=0,late=0,missing=0;const cells=works.map(pair=>{const k=`${p.id}:${pair.id}`;if(assigned.has(k))assignedCount++;const st=v186CellState(p.id,pair,assigned,subMap);if(["done","late"].includes(st.cls))completed++;if(st.cls==="late")late++;if(st.cls==="missing")missing++;return `<td class="c">${excelEsc(st.label)}</td>`}).join("");const gr=gradeMap.get(p.id),note=missing?`ยังไม่ส่ง ${missing}`:late?`ส่งช้า ${late}`:(assignedCount&&completed>=assignedCount?"ส่งครบ":"-");return `<tr><td class="c">${i+1}</td><td class="code">${excelEsc(p.student_code||"")}</td><td>${excelEsc(p.full_name||"")}</td>${cells}<td class="c">${completed}/${assignedCount}</td><td class="c">${gr?`${Number(gr.work_score||0).toFixed(2)}/${Number(gr.work_points||40)}`:"-"}</td><td>${excelEsc(note)}</td></tr>`}).join("");
  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:6mm}body{font-family:Tahoma,Arial,sans-serif}table{border-collapse:collapse}th,td{border:1px solid #777;padding:5px;font-size:10px;vertical-align:middle}th{background:#dbeafe;text-align:center}.title td,.meta td{border:0;text-align:center;font-weight:700;font-size:16px}.meta td{font-size:11px;font-weight:400}.c{text-align:center}.code{mso-number-format:"\\@"}</style></head><body><table><tr class="title"><td colspan="${cols}">${excelEsc(title)}</td></tr><tr class="meta"><td colspan="${cols}">${excelEsc(meta)}</td></tr><tr><th>ลำดับ</th><th>รหัสนักศึกษา</th><th>ชื่อ - สกุล</th>${head}<th>ส่งครบ</th><th>คะแนนงาน</th><th>หมายเหตุ</th></tr>${body}</table></body></html>`;
}
async function renderRoomWorkChecklist(presetSubjectId=null){
  setTitle("ตารางเช็กรวมการเก็บงานรายห้อง");busy("กำลังเตรียมห้องเรียนและหมวดหมู่จากข้อมูลลงทะเบียน...");const c=client();
  const [sr,pr]=await Promise.all([
    c.from("subjects").select("id,code,name,academic_year,semester,active,subject_type").eq("active",true).eq("subject_type","subject").order("code"),
    c.from("profiles").select("id,student_code,full_name,display_name,grade_level,room_label,class_name,department,major,seat_number,active,approval_status,role").eq("role","user").eq("active",true).eq("approval_status","approved").order("student_code")
  ]);if(sr.error)throw sr.error;if(pr.error)throw pr.error;const subjects=sr.data||[],profiles=pr.data||[];
  const years=v186Unique(subjects,"academic_year"),semesters=v186Unique(subjects,"semester");
  content().innerHTML=`<section class="v14-page v186-checklist-page">
    <div class="v186-hero-shell v186-screen-only">
      <div class="v186-hero-icon">✅</div>
      <div class="v186-hero-copy">
        <div class="v186-breadcrumb">หน้าหลัก <span>›</span> ตารางเช็กรวมการเก็บงานรายห้อง</div>
        <span class="v14-kicker">ROOM WORK CHECKLIST • ${RELEASE_VERSION}</span>
        <h1>ตารางเช็กรวมการเก็บงานรายห้อง</h1>
        <p>ดูสถานะการส่งงานของนักศึกษาแต่ละห้องแบบตารางเดียว โดยนับ Digital/Paper ของหน่วยเดียวกันเป็น 1 งาน เพื่อให้ตรวจสอบได้ง่ายและพิมพ์ใช้งานได้ทันที</p>
      </div>
      <div class="v186-hero-aside">
        <div class="v186-hero-note">
          <b>ติดตามงาน เสริมวินัย</b>
          <small>สรุปสถานะงานรายห้องในมุมมองเดียว พร้อมส่งออกและพิมพ์ได้ทันที</small>
        </div>
        <div class="v186-head-badge"><span>รายวิชา</span><b>${subjects.length}</b><small>วิชาที่เปิดใช้งาน</small></div>
      </div>
    </div>
    <div class="card v186-filter-card v186-screen-only">
      <div class="v186-filter-top"><div class="v186-filter-title"><i>🔎</i><div><b>เลือกข้อมูลที่ต้องการดู</b><small>กรองเฉพาะข้อมูลที่จำเป็นก่อนสร้างตารางเช็กงาน</small></div></div><div class="v186-filter-actions"><button class="btn" id="v186-reset">รีเซ็ตข้อมูล</button><button class="btn primary v186-load-btn" id="v186-load">แสดงข้อมูล</button></div></div>
      <div class="v186-filter-grid">
        <label><span>ปีการศึกษา</span><select id="v186-year" class="input">${v186Opt(years)}</select></label>
        <label><span>ภาคเรียน</span><select id="v186-sem" class="input">${v186Opt(semesters)}</select></label>
        <label class="subject"><span>รายวิชา</span><select id="v186-subject" class="input"></select></label>
        <label><span>ระดับ</span><select id="v186-grade" class="input">${v186Opt(v186Unique(profiles,"grade_level"))}</select></label>
        <label><span>ห้อง</span><select id="v186-room" class="input">${v186Opt(v186Unique(profiles,"room_label"))}</select></label>
        <label><span>แผนก</span><select id="v186-dept" class="input">${v186Opt(v186Unique(profiles,"department"))}</select></label>
        <label class="major"><span>สาขา</span><select id="v186-major" class="input">${v186Opt(v186Unique(profiles,"major"))}</select></label>
      </div>
    </div>
    <div id="v186-checklist-result"><div class="v186-empty-state"><span>📋</span><b>เลือกวิชาและห้องที่ต้องการ</b><small>จากนั้นกด “แสดงข้อมูล” เพื่อเปิดตารางเช็กงาน</small></div></div>
  </section>`;
  const year=$("#v186-year"),sem=$("#v186-sem"),subjectSel=$("#v186-subject");
  const refreshSubjects=()=>{const y=year.value,m=sem.value,current=subjectSel.value;const rows=subjects.filter(x=>(!y||String(x.academic_year||"")===y)&&(!m||String(x.semester||"")===m));subjectSel.innerHTML=rows.map(x=>`<option value="${x.id}">${esc(`${x.code} • ${x.name}`)}</option>`).join("")||`<option value="">ไม่พบรายวิชา</option>`;if(rows.some(x=>x.id===current))subjectSel.value=current};
  year.onchange=refreshSubjects;sem.onchange=refreshSubjects;refreshSubjects();if(presetSubjectId&&[...subjectSel.options].some(o=>o.value===presetSubjectId))subjectSel.value=presetSubjectId;
  const load=()=>loadRoomWorkChecklist(subjects,profiles).catch(e=>{console.error(e);const host=$("#v186-checklist-result");if(host)host.innerHTML=`<div class="alert error"><b>โหลดตารางไม่สำเร็จ</b><div>${esc(errorText(e))}</div></div>`});
  $("#v186-load").onclick=load;
  const resetBtn=$("#v186-reset");if(resetBtn)resetBtn.onclick=()=>{year.value="";sem.value="";refreshSubjects();subjectSel.selectedIndex=0;const ids=["#v186-grade","#v186-room","#v186-dept","#v186-major"];ids.forEach(id=>{const el=$(id);if(el)el.value=""});load()};
  if(subjectSel.value)load();
}
async function loadRoomWorkChecklist(subjects,allProfiles){
  const sid=$("#v186-subject")?.value;if(!sid)return;const host=$("#v186-checklist-result");if(!host)return;host.innerHTML=`<div class="v14-loading"><div class="v14-spinner"></div><b>กำลังสร้างตารางเช็กงานจากข้อมูลจริง...</b></div>`;
  const filters={grade:$("#v186-grade")?.value||"",room:$("#v186-room")?.value||"",department:$("#v186-dept")?.value||"",major:$("#v186-major")?.value||""},subject=subjects.find(x=>x.id===sid);const c=client();
  const [er,detail,gr]=await Promise.all([c.from("subject_enrollments").select("user_id,status").eq("subject_id",sid).eq("status","approved"),loadSubjectWorkDetailData(sid),c.rpc("admin_subject_gradebook",{p_subject_id:sid})]);if(er.error)throw er.error;if(gr.error)throw gr.error;
  const enrolled=new Set((er.data||[]).map(x=>x.user_id));let students=allProfiles.filter(p=>enrolled.has(p.id));if(filters.grade)students=students.filter(p=>p.grade_level===filters.grade);if(filters.room)students=students.filter(p=>p.room_label===filters.room);if(filters.department)students=students.filter(p=>p.department===filters.department);if(filters.major)students=students.filter(p=>p.major===filters.major);students.sort((a,b)=>(Number(a.seat_number||999)-Number(b.seat_number||999))||String(a.student_code||"").localeCompare(String(b.student_code||"")));
  const works=[...(detail.works||[])].sort((a,b)=>v186UnitNo(a)-v186UnitNo(b)),assigned=new Set((detail.assignments||[]).map(x=>`${x.user_id}:${x.pair_id}`)),subMap=v186SubmissionMap(detail),gradeMap=new Map((gr.data||[]).map(x=>[x.user_id,x]));let complete=0,partial=0,none=0;
  for(const p of students){let ac=0,dc=0;for(const w of works){if(assigned.has(`${p.id}:${w.id}`)){ac++;const st=v186CellState(p.id,w,assigned,subMap);if(["done","late"].includes(st.cls))dc++}}if(ac&&dc>=ac)complete++;else if(dc)partial++;else none++}
  const title=v186ClassTitle(students,filters),table=v186ChecklistTable(subject,students,works,assigned,subMap,gradeMap);
  host.innerHTML=`<div class="v186-room-summary">
      <div class="v186-room-ident"><img src="./icons/icon-192.png" alt=""><div><div class="v186-room-title-row"><h2>${esc(title)}</h2><span>${esc(subject.code)}</span></div><p>${esc(subject.name)}</p><small>ปีการศึกษา ${esc(subject.academic_year||"-")} • ภาคเรียน ${esc(subject.semester||"-")} • ระดับ ${esc(filters.grade||"ทั้งหมด")} • ห้อง ${esc(filters.room||"ทั้งหมด")} • แผนก ${esc(filters.department||"ทั้งหมด")} • สาขา ${esc(filters.major||"ทั้งหมด")}</small></div></div>
      <div class="v186-mini-kpis v186-screen-only"><div><span>นักศึกษา</span><b>${students.length}</b></div><div><span>หน่วยงาน</span><b>${works.length}</b></div><div class="ok"><span>ส่งครบ</span><b>${complete}</b></div><div class="warn"><span>ส่งบางส่วน</span><b>${partial}</b></div><div class="bad"><span>ยังไม่ส่ง</span><b>${none}</b></div></div>
    </div>
    <div class="v186-toolbar v186-screen-only">
      <div class="v186-toolbar-left"><div class="v186-action-buttons"><button class="btn" id="v186-excel">⬇️ ส่งออก Excel</button><button class="btn primary" id="v186-print">🖨️ พิมพ์ A4 แนวนอน</button></div><div class="v186-legend"><span><i class="done">✓</i>ส่งแล้ว</span><span><i class="late">ช</i>ส่งย้อนหลัง</span><span><i class="draft">ร</i>ร่าง</span><span><i class="waiting">/</i>รอดำเนินการ</span><span><i class="missing">✕</i>พ้นกำหนด</span><span><i>—</i>ไม่ได้มอบหมาย</span></div></div>
      <label class="v186-searchbox"><span>🔍</span><input id="v186-search" class="input" placeholder="ค้นหารหัสนักศึกษา หรือชื่อ-สกุล..."></label>
    </div>
    <div class="v186-table-shell">${table}</div><div class="v186-table-foot v186-screen-only">แสดง <b id="v186-visible-count">${students.length}</b> จาก ${students.length} รายการ</div>`;
  state.workChecklist={subject,students,works,assigned,subMap,gradeMap,filters};
  $("#v186-excel").onclick=()=>{const html=v186ChecklistExcel(subject,students,works,assigned,subMap,gradeMap,filters);downloadExcelHtml(`ตารางเช็กรวม-${subject.code}-${title.replace(/\\s+/g,"-")}.xls`,html)};$("#v186-print").onclick=()=>window.print();
}
function showRoomWorkChecklistCell(userId,pairId){
  const ctx=state.workChecklist;if(!ctx)return;const p=ctx.students.find(x=>x.id===userId),pair=ctx.works.find(x=>String(x.id)===String(pairId));if(!p||!pair)return;const st=v186CellState(userId,pair,ctx.assigned,ctx.subMap),sub=ctx.subMap.get(`${userId}:${pair.id}`),due=pair.digital?.due_at||pair.paper?.due_at;
  overlay(`<div class="v14-modal-head"><div><h2>${esc(v186WorkLabel(pair,ctx.subject))}</h2><p>${esc(v186WorkTopic(pair))}</p></div><button class="btn" data-v14-close>✕</button></div><div class="v186-cell-detail"><div><span>นักศึกษา</span><b>${esc(p.student_code||"")} • ${esc(p.full_name||"")}</b></div><div><span>สถานะ</span><b class="${st.cls}">${esc(st.text)}</b></div><div><span>กำหนดส่ง Digital</span><b>${due?esc(fmt(due)):"ไม่กำหนด"}</b></div><div><span>เวลาส่งล่าสุด</span><b>${sub?.submitted_at||sub?.confirmed_at?esc(fmt(sub.submitted_at||sub.confirmed_at)):"-"}</b></div><div><span>รูปแบบที่รับ</span><b>${sub?.worksheet_id===pair.paper?.id||sub?.is_late?"Paper / ย้อนหลัง":"Digital / ตรงเวลา"}</b></div></div>`);
}

async function renderAttendanceHub(){
  setTitle("เช็คชื่อและห้องเรียน");
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ATTENDANCE FLOW</span><h1>📷 เช็คชื่อและห้องเรียน</h1><p>QR • Session 15 นาที • Late/Absent/Excused • หัวหน้าห้อง • Realtime Presence</p></div></div><div class="v1610-flow-grid">${hubCard("attendance","📷","Attendance","เปิด Session • Scan QR • สรุปยอด","orange")}${hubCard("presence","📡","สถานะออนไลน์","ดู Online/Away/Offline แบบ Realtime","cyan")}${hubCard("students","👨‍🎓","หัวหน้าห้อง / สมาชิก","จัดสิทธิ์นักศึกษาและสมาชิกห้อง","green")}${hubCard("courses","🏫","กลับรายวิชา","เลือกวิชาสำหรับงานเช็คชื่อ","slate")}</div></section>`;
}
async function renderAcademicHub(){
  setTitle("ปีการศึกษาและระบบ");
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ACADEMIC & SYSTEM FLOW</span><h1>⚙️ ปีการศึกษาและระบบ</h1><p>Promotion, Academic History, Audit และ System Health รวมในจุดเดียว</p></div></div><div class="v1610-flow-grid">${hubCard("promotion","📈","เลื่อนชั้น / ปีการศึกษา","Prepare → Review → Approve → Apply","green")}${hubCard("audit","🧾","Audit Log","ตรวจประวัติการดำเนินการสำคัญ","violet")}${hubCard("system","🩺","System Health / Settings","ตรวจ Backend, RLS, Storage, Registration","cyan")}${hubCard("reports","📊","รายงานสรุป","Export ข้อมูลเพื่อปิดภาคเรียน","orange")}</div></section>`;
}
function courseEnrollmentState(enroll){return enroll?.status||"none"}
function courseStatusLabel(st){return st==="approved"?"กำลังเรียน":st==="pending"?"รออนุมัติ":st==="rejected"?"เคยไม่อนุมัติ":st==="withdrawn"?"ถอนแล้ว":"เปิดรับสมัคร"}
async function renderCourseRegistrationHome(){
  setTitle("รายวิชาทั้งหมด");busy("กำลังโหลดรายวิชาทั้งหมด...");
  const c=client(),p=await getProfile();
  const [subjects,enrolls,works,csr]=await Promise.all([allSubjects(),enrollmentRowsMine(),studentWorkRows().catch(()=>[]),c.rpc("subject_classroom_states_v194")]);
  if(csr.error)throw csr.error;const openMap=classroomOpenMap(csr.data||[]),em=new Map(enrolls.map(x=>[x.subject_id,x])),approved=enrolls.filter(x=>x.status==="approved").length;
  content().innerHTML=`<section class="v14-page v165-enrollment-home">
    <div class="v165-course-home-head"><div><span class="v14-kicker">COURSE REGISTRATION</span><h1>รายวิชาเรียนทั้งหมด</h1><p>สวัสดี ${esc(p?.full_name||"")} • เลือกรายวิชาแล้วกรอกรหัสเข้าห้องที่ได้รับจาก Admin</p></div><div class="v165-my-course-count"><b>${approved}</b><span>วิชาที่กำลังเรียน</span></div></div>
    <div class="card v165-course-search"><input id="v165-course-q" class="input" placeholder="🔎 ค้นหารหัสวิชา / ชื่อวิชา"><div class="v165-course-tabs"><button class="active" data-v165-course-filter="all">ทั้งหมด</button><button data-v165-course-filter="available">เปิดรับสมัคร</button><button data-v165-course-filter="approved">กำลังเรียน</button><button data-v165-course-filter="pending">รออนุมัติ</button></div></div>
    <div class="v165-course-gallery" id="v165-course-gallery">${subjects.map((s,i)=>{const e=em.get(s.id),st=courseEnrollmentState(e),isOpen=openMap.get(s.id)!==false,cw=works.filter(x=>x.w?.subject_id===s.id),done=cw.filter(x=>["sent","late","graded"].includes(x.status?.key)).length,total=cw.length;return `<article class="v165-course-tile ${isOpen?"":"v194-room-closed"}" data-v165-course-card data-search="${esc(`${s.code} ${s.name}`.toLowerCase())}" data-status="${esc(st)}"><div class="v165-course-cover" style="--course:${esc(s.color_hex||["#79a8c7","#7aa895","#a48db3","#b49c72"][i%4])}"><span>📘</span><small>${esc(s.code)}</small></div><div class="v165-course-body"><div class="v165-course-badges"><span>${courseStatusLabel(st)}</span><span class="${isOpen?"v194-open-text":"v194-closed-text"}">${isOpen?"เปิดห้อง":"ปิดห้อง"}</span>${s.semester?`<span>ภาค ${esc(s.semester)}</span>`:""}</div><h3>${esc(s.name)}</h3><p>${esc(s.description||`ปีการศึกษา ${s.academic_year||"-"}`)}</p>${st==="approved"?`<div class="v165-progress-note">งานที่ดำเนินการ ${done}/${total}</div>`:""}<div class="v165-course-actions">${st==="approved"?`<button class="btn primary" data-v14-open-course="${s.id}" ${isOpen?"":"disabled"}>${isOpen?"เข้าเรียน":"ห้องเรียนปิด"}</button>`:`<button class="btn primary" data-v165-join-course="${s.id}" data-course-code="${esc(s.code)}" data-course-name="${esc(s.name)}" ${isOpen?"":"disabled"}>${isOpen?"ใส่รหัสเข้าร่วม":"ปิดรับเข้าห้อง"}</button>`}</div></div></article>`}).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่เปิดรับ</div>`}</div>
    <div class="v165-enroll-help"><span>🔐</span><div><b>รหัสเข้าห้องเรียนรับจาก Admin/ครูผู้สอน</b><p>เมื่อกรอกรหัสถูกต้อง ระบบจะเพิ่มคุณเป็นสมาชิกห้องเรียนรายวิชานั้นทันที และรับใบงานที่เผยแพร่แล้วโดยอัตโนมัติ</p></div></div>
  </section>`;
  let filter="all";const draw=()=>{const q=$("#v165-course-q")?.value.trim().toLowerCase()||"";$$("[data-v165-course-card]").forEach(card=>{const st=card.dataset.status,matchFilter=filter==="all"||(filter==="available"&&st!=="approved"&&st!=="pending")||st===filter;card.hidden=!(matchFilter&&(!q||card.dataset.search.includes(q)))})};$("#v165-course-q").oninput=draw;$$("[data-v165-course-filter]").forEach(b=>b.onclick=()=>{$$("[data-v165-course-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.v165CourseFilter;draw()});
}
async function showJoinCourseDialog(subjectId,code,name){
  overlay(`<div class="v14-modal-head"><div><span class="v14-kicker">JOIN COURSE</span><h2>เข้าร่วม ${esc(code)} ${esc(name)}</h2><p>กรอก CODE ที่ได้รับจาก Admin/ครูผู้สอน</p></div><button class="btn" data-v14-close>✕</button></div><form id="v165-join-form"><label class="field"><span>CODE เข้าเรียน</span><input class="input v165-code-input" name="code" autocomplete="off" inputmode="text" maxlength="12" placeholder="เช่น A1B2C3" required></label><div class="alert">CODE นี้ใช้เฉพาะการเข้าร่วมรายวิชา ไม่ใช่รหัสผ่านบัญชี • เมื่อ CODE ถูกต้องจะเข้าห้องเรียนวิชานี้ทันที</div><div class="row end"><button type="button" class="btn" data-v14-close>ยกเลิก</button><button class="btn primary">ยืนยัน CODE และเข้าเรียน</button></div></form>`);
  const codeInput=$("#v165-join-form input[name=code]");
  if(codeInput)codeInput.oninput=()=>{codeInput.value=codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12)};
  $("#v165-join-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),joinCode=String(f.get("code")||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,""),btn=e.submitter;if(joinCode.length<4){toast("กรุณากรอก CODE เข้าเรียน 4–12 ตัว",true);return}btn.disabled=true;btn.textContent="กำลังตรวจ CODE...";const {data,error}=await client().rpc("join_subject_with_code_v18",{p_subject_id:subjectId,p_code:joinCode});if(error||data?.ok===false){btn.disabled=false;btn.textContent="ยืนยัน CODE และเข้าเรียน";const key=data?.error||String(error?.message||"");toast(key.includes("JOIN_RATE_LIMITED")?`กรอกรหัสผิดหลายครั้ง ระบบพักการลองชั่วคราว ${Math.ceil(Number(data?.retry_after_seconds||900)/60)} นาที`:key.includes("JOIN_CODE_INVALID")?`CODE เข้าเรียนไม่ถูกต้อง${Number.isFinite(Number(data?.attempts_remaining))?` • เหลือลองได้ ${data.attempts_remaining} ครั้งก่อนพักชั่วคราว`:""}`:errorText(error||key),true);return}closeOverlay();toast(`เข้าเรียน ${data?.subject_code||code} สำเร็จ`);if(window.DOCNR_BASE?.navigate)window.DOCNR_BASE.navigate("courses",subjectId);else renderStudentCourse(subjectId)};
}

// ---------------------------------------------------------------------------
// Subject enrollment
// ---------------------------------------------------------------------------
async function enrollmentRowsMine(){const {data,error}=await client().from("subject_enrollments").select("id,subject_id,status,requested_at,decided_at,note").eq("user_id",uid());if(error)throw error;return data||[]}
async function renderEnrollSubjects(){return renderCourseRegistrationHome()}

async function renderEnrollmentAdmin(){
  setTitle("อนุมัติรายวิชา");busy("กำลังโหลดคำขอลงทะเบียน...");const {data,error}=await client().from("subject_enrollments").select("id,subject_id,user_id,status,requested_at,decided_at,note,subjects(code,name),profiles!subject_enrollments_user_id_fkey(full_name,student_code,grade_level,room_label,class_name)").order("requested_at",{ascending:false});if(error)throw error;const rows=data||[];
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ADMIN APPROVAL</span><h1>อนุมัติการลงทะเบียนรายวิชา</h1><p>ผู้เรียนจะได้รับใบงานและข้อสอบของวิชานั้นหลังอนุมัติ</p></div><div class="v14-stat-pill">รออนุมัติ <b>${rows.filter(x=>x.status==="pending").length}</b></div></div>
  <div class="card v14-filter"><select id="v14-enroll-filter" class="input"><option value="">ทุกสถานะ</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ไม่อนุมัติ</option><option value="withdrawn">ถอน</option></select><input id="v14-enroll-q" class="input" placeholder="ค้นหาชื่อ / รหัส / วิชา"></div>
  <div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>รายวิชา</th><th>วันที่ขอ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody id="v14-enroll-body"></tbody></table></div></section>`;
  const draw=()=>{const st=$("#v14-enroll-filter").value,q=$("#v14-enroll-q").value.trim().toLowerCase();const f=rows.filter(x=>(!st||x.status===st)&&(!q||`${x.profiles?.full_name} ${x.profiles?.student_code} ${x.subjects?.code} ${x.subjects?.name}`.toLowerCase().includes(q)));$("#v14-enroll-body").innerHTML=f.map(x=>`<tr><td><b>${esc(x.profiles?.full_name||"-")}</b><div class="muted smalltext">${esc(x.profiles?.student_code||"")} • ${esc(x.profiles?.grade_level||"")}${esc(x.profiles?.room_label||"")}</div></td><td><b>${esc(x.subjects?.code||"")}</b> ${esc(x.subjects?.name||"")}</td><td>${fmt(x.requested_at)}</td><td><span class="v14-status ${x.status}">${x.status==="pending"?"รออนุมัติ":x.status==="approved"?"อนุมัติแล้ว":x.status==="rejected"?"ไม่อนุมัติ":"ถอน"}</span></td><td>${x.status!=="approved"?`<button class="btn green sm" data-v14-decide-enroll="${x.id}" data-status="approved">อนุมัติ</button>`:""} ${x.status!=="rejected"?`<button class="btn red sm" data-v14-decide-enroll="${x.id}" data-status="rejected">ไม่อนุมัติ</button>`:""}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">ไม่พบรายการ</td></tr>`};draw();$("#v14-enroll-filter").onchange=draw;$("#v14-enroll-q").oninput=draw;
}

function classroomOpenMap(rows){return new Map((rows||[]).map(x=>[x.subject_id,x.is_open!==false]))}
function classroomStateBadge(open){return `<span class="v194-room-state ${open?"open":"closed"}">${open?"● เปิดห้องเรียน":"● ปิดห้องเรียน"}</span>`}

// ---------------------------------------------------------------------------
// Admin subject-first bundle / release
// ---------------------------------------------------------------------------
async function renderAdminCourses(){
  setTitle("ห้องเรียนรายวิชา");busy("กำลังโหลดห้องเรียนรายวิชาและ CODE เข้าเรียน...");const c=client();const [sr,wr,er,xr,cr,csr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,semester,academic_year,description").eq("active",true).eq("subject_type","subject").order("code"),
    c.from("worksheets").select("id,subject_id,mode,status,settings,open_at,due_at").order("created_at"),
    c.from("subject_enrollments").select("subject_id,status"),
    c.from("exams").select("id,subject_id,status"),
    c.rpc("admin_subject_join_code_registry"),
    c.rpc("subject_classroom_states_v194")
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(er.error)throw er.error;if(cr.error)throw cr.error;if(csr.error)throw csr.error;const ready=(wr.data||[]).filter(w=>w.settings?.template_ready===true),codes=cr.data?.subjects||[],codeMap=new Map(codes.map(x=>[x.subject_id,x])),openMap=classroomOpenMap(csr.data||[]);
  const codeRegistry=codes.map(x=>{const isOpen=openMap.get(x.subject_id)!==false;return `<article class="v171-code-item"><div><small>${esc(x.subject_code)}</small><b>${esc(x.subject_name)}</b><span>สมาชิก ${Number(x.member_count||0)} คน</span>${classroomStateBadge(isOpen)}</div><strong>${esc(x.join_code||"------")}</strong><div class="v171-code-actions"><button class="btn sm" data-v165-copy-code="${esc(x.join_code||"")}">📋 คัดลอก</button><button class="btn sm" data-v165-change-code="${x.subject_id}" data-v171-refresh="courses">🔄 เปลี่ยน CODE</button><button class="btn sm ${isOpen?"red":"green"}" data-v194-toggle-classroom="${x.subject_id}" data-open="${isOpen?"false":"true"}" data-refresh="courses">${isOpen?"🔒 ปิดห้อง":"🔓 เปิดห้อง"}</button><button class="btn sm primary" data-v14-admin-course="${x.subject_id}">จัดการห้อง</button></div></article>`}).join("");
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">SUBJECT = CLASSROOM</span><h1>ห้องเรียนรายวิชา</h1><p>ทุกวิชามี CODE เข้าเรียนของตัวเอง • CODE ถูกบันทึกในระบบและมองเห็นเฉพาะ Admin • Admin บอก CODE ให้นักศึกษาเพื่อเข้าเรียน</p></div><div class="v14-stat-pill">CODE พร้อมใช้ <b>${codes.length}/${(sr.data||[]).length}</b></div></div>
  <section class="card v171-code-registry"><div class="v171-code-registry-head"><div><span class="v14-kicker">ADMIN COURSE CODE REGISTRY</span><h2>🔐 CODE เข้าเรียนทั้งหมด</h2><p>ใช้หน้านี้เป็นทะเบียน CODE กลางของ Admin • นักศึกษาไม่สามารถเปิดดู CODE เหล่านี้จากระบบได้</p></div><span class="v171-code-ok">✅ ${codes.length} วิชา</span></div><div class="v171-code-grid">${codeRegistry||`<div class="v14-empty">ยังไม่มี CODE รายวิชา</div>`}</div></section>
  <div class="card v15-room-note"><b>ขั้นตอนใช้งาน</b><span>Admin เลือก CODE → บอกนักศึกษา → นักศึกษาเลือกรายวิชา → กรอก CODE → ระบบอนุมัติสมาชิกและพาเข้าห้องเรียนทันที</span></div>
  <div class="card v14-filter"><input id="v14-course-q" class="input" placeholder="ค้นหารหัสวิชา / ชื่อห้องเรียน"></div>
  <div id="v14-admin-course-grid" class="v14-course-grid">${(sr.data||[]).map(s=>{const ws=ready.filter(w=>w.subject_id===s.id),paper=ws.filter(w=>w.mode==="paper").length,digital=ws.filter(w=>w.mode==="digital").length,learners=(er.data||[]).filter(e=>e.subject_id===s.id&&e.status==="approved").length,published=(wr.data||[]).filter(w=>w.subject_id===s.id&&w.status==="published").length,examCount=(xr.data||[]).filter(x=>x.subject_id===s.id).length,cc=codeMap.get(s.id),isOpen=openMap.get(s.id)!==false;return `<article class="v14-course-card v15-room-card v171-room-card ${isOpen?"":"v194-room-closed"}" data-v171-course-card data-search="${esc(`${s.code} ${s.name}`.toLowerCase())}" style="--course:${esc(s.color_hex||"#22d3ee")}"><div class="v171-room-top"><span class="v15-room-label">🏫 ห้องเรียน</span><span class="v171-code-pill">CODE <b>${esc(cc?.join_code||"------")}</b></span></div>${classroomStateBadge(isOpen)}<span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><div class="v14-course-counts"><span>👥 ${learners} คน</span><span>📚 ${paper+digital} ใบ</span><span>🚀 ${published} เปิดแล้ว</span><span>🧪 ${examCount} ชุดสอบ</span></div><div class="v171-room-actions"><button class="btn sm" data-v165-copy-code="${esc(cc?.join_code||"")}">📋 คัดลอก CODE</button><button class="btn sm" data-v165-change-code="${s.id}" data-v171-refresh="courses">🔄 เปลี่ยน</button><button class="btn sm ${isOpen?"red":"green"}" data-v194-toggle-classroom="${s.id}" data-open="${isOpen?"false":"true"}" data-refresh="courses">${isOpen?"🔒 ปิดห้อง":"🔓 เปิดห้อง"}</button><button class="btn primary" data-v14-admin-course="${s.id}">จัดการห้องเรียน</button></div></article>`}).join("")}</div></section>`;
  $("#v14-course-q").oninput=e=>{const q=e.target.value.trim().toLowerCase();$$('[data-v171-course-card]').forEach(x=>x.hidden=!!(q&&!x.dataset.search.includes(q)))};
}
function wsSeq(w){const m=String(w.reference_code||"").match(/-([PD]\d{2})$/);return m?Number(m[1].slice(1)):Number(w.settings?.lesson_sequence||0)||0}
function wsCode(w){const m=String(w.reference_code||"").match(/-([PD]\d{2})$/);return m?m[1]:(w.mode==="paper"?"P":"D")}
function subjectRoomName(s){return `${s?.code||""} ${s?.name||""}`.trim()}
function openSubjectExam(subjectId){window.DOCNR_BASE?.navigate?.("exam",subjectId||null)}
async function renderAdminSubject(sid){
  state.subjectId=sid;state.route="courses";heartbeat();setTitle("ห้องเรียนรายวิชา");busy("กำลังเปิดห้องเรียนและชุดใบงาน...");const c=client();
  const [sr,wr,fr,er,xr,csr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,description,semester,academic_year").eq("id",sid).single(),
    c.from("worksheets").select("*").eq("subject_id",sid).order("created_at"),
    c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,mime_type,size_bytes,created_at").eq("subject_id",sid).order("created_at"),
    c.from("subject_enrollments").select("id,status,user_id,requested_at,profiles!subject_enrollments_user_id_fkey(full_name,student_code,grade_level,room_label,class_name)").eq("subject_id",sid),
    c.from("exams").select("id,title,status,open_at,due_at").eq("subject_id",sid).order("created_at",{ascending:false}),
    c.rpc("subject_classroom_states_v194")
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(fr.error)throw fr.error;if(er.error)throw er.error;if(csr.error)throw csr.error;
  const s=sr.data,allWorks=wr.data||[],ready=allWorks.filter(w=>w.settings?.template_ready===true),files=fr.data||[],approved=(er.data||[]).filter(e=>e.status==="approved"),pending=(er.data||[]).filter(e=>e.status==="pending"),exams=xr.data||[],isOpen=classroomOpenMap(csr.data||[]).get(sid)!==false;const joinCodeR=await c.rpc("admin_subject_join_code",{p_subject_id:sid,p_new_code:null});const joinCode=joinCodeR.data?.join_code||"------";
  const renderGroup=(mode,label)=>{const list=ready.filter(w=>w.mode===mode).sort((a,b)=>wsSeq(a)-wsSeq(b));return `<section class="v14-ws-section"><div class="v14-section-head compact"><div><h2>${label}</h2><p>${list.length} ใบ • คลังสำเร็จรูปสำหรับดูตัวอย่างและแนบสื่อ การเปิดให้นักศึกษาทำใช้แผง “ปลดล็อกการสอนทีละหน่วย” เท่านั้น</p></div></div><div class="v14-bundle-list">${list.map(w=>{const fs=files.filter(f=>f.worksheet_id===w.id||(!f.worksheet_id&&Number(f.sequence_no||0)===wsSeq(w)));return `<article class="v14-bundle" style="--course:${esc(s.color_hex||"#22d3ee")}"><div class="v14-select"><span>${esc(wsCode(w))}</span></div><div class="v14-bundle-main"><div class="v14-badges"><span>${mode==="paper"?"ใบงานกระดาษ":"ใบงานดิจิทัล"}</span><span class="${w.status}">${w.status==="published"?"เปิดสอนแล้ว":"รอปลดล็อกหน่วย"}</span></div><h3>${esc(w.title)}</h3><div class="v14-goal">🎯 ${esc(w.settings?.learning_goal||"เป้าหมายตามหน่วยการเรียน")}</div><div class="v14-meta">${w.open_at?`เปิด ${fmt(w.open_at)}`:"ยังไม่เปิดสอน"}${w.due_at?` • ส่ง ${fmt(w.due_at)}`:""}</div><div class="v14-actions"><button class="btn sm" data-v14-preview="${w.id}">👁 ดูตัวอย่างใบงาน</button>${mode==="paper"?`<button class="btn sm primary" data-v167-print-pack="${w.id}">🖨️ พิมพ์รายบุคคล + Barcode</button>`:""}<button class="btn sm" data-v14-upload="${w.id}" data-subject="${sid}" data-seq="${wsSeq(w)}">＋ เพิ่มสไลด์/สื่อ</button></div></div><div class="v14-media-pane"><b>📊 สไลด์ / สื่อประกอบ</b>${fs.length?fs.map(f=>`<button class="v14-file" data-v14-file="${esc(f.storage_path)}">${esc(f.original_name)}</button>`).join(""):`<div class="v14-media-empty">ยังไม่มีสื่อที่จับคู่</div>`}</div></article>`}).join("")||`<div class="v14-empty">ยังไม่มีใบงานสำเร็จรูปประเภทนี้</div>`}</div></section>`};
  const roster=approved.sort((a,b)=>String(a.profiles?.student_code||"").localeCompare(String(b.profiles?.student_code||""))).map((e,i)=>`<tr><td>${i+1}</td><td><b>${esc(e.profiles?.student_code||"-")}</b></td><td>${esc(e.profiles?.full_name||"-")}</td><td>${esc(`${e.profiles?.grade_level||""}${e.profiles?.room_label||""}`||e.profiles?.class_name||"-")}</td><td><span class="v14-status approved">สมาชิกห้อง</span></td></tr>`).join("");
  const published=allWorks.filter(w=>w.status==="published").length;
  content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับห้องเรียนรายวิชา</button>
  <div class="v14-course-hero v15-room-hero" style="--course:${esc(s.color_hex||"#22d3ee")}"><div><span class="v14-kicker">🏫 ห้องเรียน • ${esc(s.code)}</span><h1>${esc(s.name)}</h1><p>${esc(s.description||"")}</p><small>ชื่อห้องเรียนใช้ข้อมูลเดียวกับรายวิชา จึงไม่เกิดชื่อซ้ำหรือชื่อไม่ตรงกัน</small></div><div class="v15-room-hero-stats"><b>${approved.length}</b><span>นักศึกษาในห้อง</span><small>${pending.length} คำขอรออนุมัติ</small></div></div>
  <div class="card v194-room-control ${isOpen?"open":"closed"}"><div>${classroomStateBadge(isOpen)}<b>${isOpen?"ห้องเรียนเปิดใช้งาน":"ห้องเรียนปิดอยู่"}</b><small>${isOpen?"นักศึกษาที่เป็นสมาชิกสามารถเข้าห้อง และผู้เรียนใหม่สามารถใช้ CODE เข้าร่วมได้":"นักศึกษาจะไม่สามารถเข้าห้องหรือใช้ CODE เข้าร่วม จนกว่า Admin จะเปิดห้องอีกครั้ง"}</small></div><button class="btn ${isOpen?"red":"green"}" data-v194-toggle-classroom="${sid}" data-open="${isOpen?"false":"true"}" data-refresh="subject">${isOpen?"🔒 ปิดห้องเรียน":"🔓 เปิดห้องเรียน"}</button></div>
  <div class="card v165-room-code"><div><span class="v14-kicker">รหัสเข้าห้องเรียน</span><b class="v165-room-code-value">${esc(joinCode)}</b><small>แจกให้นักศึกษาที่ต้องการเข้าร่วมวิชานี้ • เปลี่ยนรหัสได้ทุกเมื่อ</small></div><div class="row"><button class="btn" data-v165-copy-code="${esc(joinCode)}">📋 คัดลอกรหัส</button><button class="btn" data-v165-change-code="${sid}">🔄 เปลี่ยนรหัส</button></div></div>
  <div class="v15-room-toolbar">
    <button class="btn" data-v15-jump="#v15-room-roster">👥 นักศึกษา ${approved.length}</button>
    <button class="btn" data-v15-jump="#v15-room-ready">📚 ใบงานสำเร็จรูป ${ready.length}</button>
    <button class="btn" data-v15-jump="#v15-room-ready">🚀 ปล่อยแล้ว ${published}</button>
    <button class="btn" data-v16-gradebook="${sid}">📊 สรุปคะแนน</button>
    <button class="btn" data-v16-paper-scan="${sid}">📄 สแกนสำเนาใบงาน</button>
    <button class="btn primary" data-v15-room-exam="${sid}">🧪 ระบบสอบ ${exams.length}</button>
  </div>
  <section id="v15-room-roster" class="card v15-room-roster"><div class="v14-section-head compact"><div><h2>👥 นักศึกษาในห้องเรียน</h2><p>สมาชิกห้อง = นักศึกษาที่ Admin อนุมัติให้เรียนรายวิชานี้</p></div><button class="btn sm" data-v14-route="enrollments">จัดการคำขอลงทะเบียน</button></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ระดับ/ห้อง</th><th>สถานะ</th></tr></thead><tbody>${roster||`<tr><td colspan="5" class="empty">ยังไม่มีนักศึกษาที่ได้รับอนุมัติเข้าห้องนี้</td></tr>`}</tbody></table></div>
  </section>
  <div class="card v14-releasebar" id="v15-room-ready"><div><b>📚 คลังใบงานสำเร็จรูปประจำห้องเรียน</b><div class="muted">ดูตัวอย่างและแนบสื่อได้ที่นี่ • การแจกงานให้นักศึกษา ${approved.length} คนใช้การปลดล็อกทีละหน่วยด้านบนเท่านั้น เพื่อกันทำงานล่วงหน้า</div></div></div>
  ${renderGroup("paper","🖨️ ใบงานสำหรับพิมพ์ P01–P05")}
  ${renderGroup("digital","💻 ใบงานอิเล็กทรอนิกส์ D01–D13")}
  <section class="v16-room-tools">
    <button class="v16-tool-card" data-v16-gradebook="${sid}"><span>📊</span><b>สรุปคะแนนรายวิชา</b><small>งาน 40 • จิตพิสัย 20 • กลางภาค 20 • ปลายภาค 20 • พิมพ์รายงานได้</small></button>
    <button class="v16-tool-card" data-v16-paper-scan="${sid}"><span>📄</span><b>สแกนใบงานทั้งแผ่น</b><small>เก็บภาพสำเนา ตรวจ Barcode/QR และสถานะหมดอายุจาก Server</small></button>
  </section>
  <section class="card v15-room-exam-card"><div><span class="v14-kicker">ROOM EXAM</span><h2>🧪 ระบบสอบของห้องเรียนนี้</h2><p>เปิด Exam Center โดยผูกกับรายวิชา ${esc(subjectRoomName(s))} โดยตรง เพื่อให้จัดข้อสอบและปล่อยสอบเป็นวงจรเดียวกับห้องเรียน</p></div><button class="btn primary" data-v15-room-exam="${sid}">เปิดระบบสอบของห้องนี้</button></section>
  </section>`;
  subscribeSubjectRoom(sid,"admin").catch(()=>{});
}
async function previewWorksheet(id){
  const c=client(),{data:w,error}=await c.from("worksheets").select("*,subjects(code,name,color_hex)").eq("id",id).single();if(error){toast(errorText(error),true);return}
  if(w.mode==="paper"&&window.DOCNR_BASE?.printWorksheet){window.DOCNR_BASE.printWorksheet(id);return}
  const qs=w.questions||[],max=qs.reduce((n,q)=>n+Number(q.points||0),0);
  overlay(`<div class="v14-modal-head"><div><span class="v14-kicker">DIGITAL PREVIEW</span><h2>${esc(w.title)}</h2><p>${esc(w.subjects?.code||"")} ${esc(w.subjects?.name||"")} • ${max} คะแนน</p></div><button class="btn" data-v14-close>ปิด</button></div><div class="v14-preview">${qs.map((q,i)=>`<div class="v14-question"><b>${i+1}. ${esc(q.text||q.prompt||"")}</b><small>${Number(q.points||0)} คะแนน</small>${Array.isArray(q.choices||q.options)?`<div>${(q.choices||q.options).map(o=>`<label><input type="radio" disabled> ${esc(typeof o==="object"?(o.label||o.text||o.value):o)}</label>`).join("")}</div>`:`<textarea disabled placeholder="พื้นที่คำตอบของนักศึกษา"></textarea>`}</div>`).join("")||`<div class="v14-empty">ยังไม่มีคำถาม</div>`}</div>`,true);
}
function localInputValue(d){const x=d?new Date(d):new Date();return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,16)}
async function uploadSubjectFile(subjectId,worksheetId,seq){
  const input=document.createElement("input");input.type="file";input.accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4";input.multiple=true;
  input.onchange=async()=>{for(const file of [...input.files]){if(file.size>50*1024*1024){toast(`${file.name} เกิน 50MB`,true);continue}const path=`${subjectId}/${worksheetId}/${Date.now()}-${safeName(file.name)}`;const c=client();const up=await c.storage.from("subject-files").upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error){toast(errorText(up.error),true);continue}const ins=await c.from("subject_files").insert({subject_id:subjectId,worksheet_id:worksheetId,resource_kind:"slide",sequence_no:Number(seq)||null,storage_path:path,original_name:file.name,mime_type:file.type||null,size_bytes:file.size,created_by:uid()});if(ins.error){await c.storage.from("subject-files").remove([path]);toast(errorText(ins.error),true);continue}toast(`อัปโหลด ${file.name} แล้ว`)}renderAdminSubject(subjectId)};input.click();
}
async function openSubjectFile(path){const {data,error}=await client().storage.from("subject-files").createSignedUrl(path,600);if(error||!data?.signedUrl){toast(errorText(error||"เปิดไฟล์ไม่ได้"),true);return}window.open(data.signedUrl,"_blank","noopener")}

// ---------------------------------------------------------------------------
// Student courses / work status
// ---------------------------------------------------------------------------
async function renderStudentCourses(){
  setTitle("ห้องเรียนของฉัน");busy("กำลังโหลดห้องเรียนรายวิชาที่อนุมัติ...");const c=client();const [courses,csr]=await Promise.all([approvedCourses(),c.rpc("subject_classroom_states_v194")]);if(csr.error)throw csr.error;const openMap=classroomOpenMap(csr.data||[]);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">MY SUBJECT ROOMS</span><h1>ห้องเรียนของฉัน</h1><p>แต่ละรายวิชาเป็นห้องเรียนของคุณ ภายในมีใบงาน สไลด์ สื่อ และทางเข้าสู่ระบบสอบของวิชานั้น</p></div><button class="btn primary" data-v14-route="enroll">＋ ลงทะเบียนรายวิชา</button></div><div class="v14-course-grid">${courses.map(s=>{const isOpen=openMap.get(s.id)!==false;return `<button class="v14-course-card ${isOpen?"":"v194-room-closed"}" data-v14-open-course="${s.id}" style="--course:${esc(s.color_hex||"#22d3ee")}" ${isOpen?"":"disabled"}>${classroomStateBadge(isOpen)}<span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><small>${isOpen?"สมาชิกห้องเรียน • เปิดดูใบงาน/สื่อ/ข้อสอบ":"Admin ปิดห้องเรียนชั่วคราว"}</small></button>`}).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่ได้รับอนุมัติ</div>`}</div></section>`;
}
async function renderStudentCourse(sid){
  state.subjectId=sid;state.route="courses";heartbeat();setTitle("ห้องเรียนของฉัน");busy("กำลังเปิดห้องเรียนรายวิชา...");const c=client();
  const [sr,csr]=await Promise.all([c.from("subjects").select("id,code,name,color_hex,description").eq("id",sid).single(),c.rpc("subject_classroom_states_v194")]);if(sr.error)throw sr.error;if(csr.error)throw csr.error;
  const s=sr.data,isOpen=classroomOpenMap(csr.data||[]).get(sid)!==false;
  if(!isOpen){content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับห้องเรียนของฉัน</button><div class="card v194-student-closed"><span>🔒</span><h1>ห้องเรียนนี้ปิดอยู่</h1><p>${esc(s.code)} ${esc(s.name)}</p><small>Admin ปิดห้องเรียนชั่วคราว คุณยังคงเป็นสมาชิกและข้อมูลเดิมไม่ถูกลบ เมื่อ Admin เปิดห้องอีกครั้งจะเข้าใช้งานได้ตามปกติ</small><button class="btn primary" data-v14-route="courses">กลับรายการห้องเรียน</button></div></section>`;return}
  content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับห้องเรียนของฉัน</button>
    <div class="v14-course-hero v15-room-hero" style="--course:${esc(s.color_hex||"#22d3ee")}"><div><span class="v14-kicker">🏫 ห้องเรียน • ${esc(s.code)}</span><h1>${esc(s.name)}</h1><p>${esc(s.description||"17 หน่วย • สไลด์ 20 หน้า/หน่วย • ใบงานคู่แบบออนไลน์/ย้อนหลัง")}</p></div><div class="row"><button class="btn primary" data-v15-room-exam="${sid}">🧪 ข้อสอบรายวิชานี้</button></div></div>
    <div class="card v176-room-rule"><b>รูปแบบห้องเรียนสำเร็จรูป</b><span>แต่ละหน่วยมีสไลด์ 20 หน้าและใบงานปุ่มเดียว • ก่อนกำหนดทำออนไลน์ • หลังหมดเวลาจึงพิมพ์ใบงานย้อนหลังรายบุคคล</span></div>
  </section>`;
  subscribeSubjectRoom(sid,"student").catch(()=>{});
}
async function renderWorkStatus(){
  setTitle("ตารางสถานะงาน");busy("กำลังตรวจงานทั้งหมด...");const rows=await studentWorkRows();const counts={sent:0,late:0,graded:0,draft:0,pending:0,upcoming:0,overdue:0};rows.forEach(x=>counts[x.status.key]++);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">WORK STATUS • LOGICAL PAIRS</span><h1>งานของฉัน</h1><p>1 หน่วย = 1 งาน • ระบบเลือกใบงานออนไลน์หรือใบงานพิมพ์ย้อนหลังให้อัตโนมัติตามเวลา</p></div></div><div class="v14-kpis four"><div><span>ทั้งหมด</span><b>${rows.length}</b></div><div><span>ส่งแล้ว/ตรวจแล้ว</span><b>${counts.sent+counts.late+counts.graded}</b></div><div><span>กำลังทำ/ยังไม่ส่ง</span><b>${counts.draft+counts.pending}</b></div><div><span>เกินกำหนด</span><b>${counts.overdue}</b></div></div>
  <div class="card v14-filter"><input id="v14-work-q" class="input" placeholder="ค้นหาวิชา / หน่วย"><select id="v14-work-status" class="input"><option value="">ทุกสถานะ</option><option value="pending">ยังไม่ส่ง</option><option value="draft">บันทึกร่าง</option><option value="sent">ส่งออนไลน์แล้ว</option><option value="late">ส่งย้อนหลังแล้ว</option><option value="graded">ตรวจแล้ว</option><option value="overdue">เกินกำหนด</option><option value="upcoming">ยังไม่เปิด</option></select></div><div id="v14-work-list" class="v14-work-list"></div></section>`;
  const draw=()=>{const q=$("#v14-work-q").value.trim().toLowerCase(),st=$("#v14-work-status").value;const f=rows.filter(x=>{const w=x.digital||x.paper||x.w;return (!q||`${w?.settings?.unit_topic||""} ${w?.title||""} ${w?.subjects?.code||""} ${w?.subjects?.name||""}`.toLowerCase().includes(q))&&(!st||x.status.key===st)});$("#v14-work-list").innerHTML=f.map(workCard).join("")||`<div class="v14-empty">ไม่พบงานตามตัวกรอง</div>`;startCountdowns()};draw();$("#v14-work-q").oninput=draw;$("#v14-work-status").onchange=draw;
}
// ---------------------------------------------------------------------------
// Admin private profiles
// ---------------------------------------------------------------------------
async function renderAdminProfiles(){
  setTitle("โปรไฟล์นักศึกษา");busy("กำลังโหลดข้อมูลส่วนตัวสำหรับ Admin...");
  const {data,error}=await client().from("profiles").select("id,username,full_name,display_name,student_code,birth_date,avatar_path,phone,grade_level,room_label,class_name,department,major,seat_number,approval_status,academic_status,active,last_seen_at,created_at").eq("role","user").order("full_name");
  if(error)throw error;const rows=data||[];
  const options=(values,label)=>`<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"th")).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}`;
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ADMIN ONLY • STUDENT PROFILE</span><h1>โปรไฟล์นักศึกษา</h1><p>ค้นหาและกรองง่าย พร้อมข้อมูลการเข้าเรียนและการส่งงาน</p></div><div class="v14-stat-pill">${rows.length} คน</div></div>
    <div class="card v14-filter v164-filter-grid">
      <input id="v14-profile-q" class="input" placeholder="ค้นหาชื่อ / ชื่อเล่น / รหัส / เบอร์โทร">
      <select id="v14-profile-level" class="input">${options(rows.map(x=>x.grade_level),"ทุกระดับชั้น")}</select>
      <select id="v14-profile-room" class="input">${options(rows.map(x=>x.room_label),"ทุกห้อง/กลุ่ม")}</select>
      <select id="v14-profile-dept" class="input">${options(rows.map(x=>x.department),"ทุกแผนก")}</select>
      <select id="v14-profile-major" class="input">${options(rows.map(x=>x.major),"ทุกสาขา")}</select>
      <select id="v14-profile-status" class="input"><option value="">ทุกสถานะบัญชี</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ไม่อนุมัติ</option><option value="suspended">ระงับ</option></select>
    </div><div id="v14-profile-grid" class="v14-profile-grid"></div></section>`;
  const draw=()=>{
    const q=$("#v14-profile-q").value.trim().toLowerCase(),level=$("#v14-profile-level").value,room=$("#v14-profile-room").value,dept=$("#v14-profile-dept").value,major=$("#v14-profile-major").value,status=$("#v14-profile-status").value;
    const f=rows.filter(p=>(!level||p.grade_level===level)&&(!room||p.room_label===room)&&(!dept||p.department===dept)&&(!major||p.major===major)&&(!status||(p.approval_status||"approved")===status)&&(!q||`${p.full_name||""} ${p.display_name||""} ${p.student_code||""} ${p.phone||""} ${p.class_name||""} ${p.department||""} ${p.major||""}`.toLowerCase().includes(q)));
    $("#v14-profile-grid").innerHTML=f.map(p=>`<button class="v14-profile-card" data-v14-profile="${p.id}"><div class="v14-avatar-placeholder">${esc((p.full_name||"?").slice(0,1))}</div><div><b>${esc(p.full_name||"-")}</b><small>ชื่อเล่น: ${esc(p.display_name&&p.display_name!==p.full_name?p.display_name:"-")}</small><small>${esc(p.student_code||"")} • ${esc(p.grade_level||"")}${esc(p.room_label||"")} • ${esc(p.major||"")}</small></div><span class="v14-status ${(p.approval_status||"approved")==="approved"?"approved":"pending"}">${(p.approval_status||"approved")==="approved"?"ใช้งาน":"ตรวจสถานะ"}</span></button>`).join("")||`<div class="v14-empty">ไม่พบข้อมูลตามตัวกรอง</div>`;
  };
  draw();["#v14-profile-q","#v14-profile-level","#v14-profile-room","#v14-profile-dept","#v14-profile-major","#v14-profile-status"].forEach(id=>{const el=$(id);if(el){el.oninput=draw;el.onchange=draw}});
}
async function showAdminProfile(id){
  const c=client();
  const [pr,er,assignR,subR,attR]=await Promise.all([
    c.from("profiles").select("*").eq("id",id).single(),
    c.from("subject_enrollments").select("status,requested_at,subjects(id,code,name)").eq("user_id",id),
    c.from("worksheet_assignments").select("worksheet_id,worksheets(id,title,mode,subject_id,settings,subjects(code,name))").eq("user_id",id),
    c.from("submissions").select("id,status,submitted_at,is_late,worksheet_id,worksheets(id,title,settings,subjects(code,name))").eq("user_id",id).order("updated_at",{ascending:false}),
    c.from("attendance_records").select("status,scanned_at,attendance_sessions(session_date,subject_id,subjects(code,name))").eq("user_id",id).order("created_at",{ascending:false})
  ]);
  if(pr.error){toast(errorText(pr.error),true);return}
  const p=pr.data,assignments=assignR.data||[],subs=subR.data||[],atts=attR.data||[];
  const logicalKey=w=>String(w?.settings?.work_pair_key||w?.id||"");
  const assigned=[...new Set(assignments.map(x=>logicalKey(x.worksheets)).filter(Boolean))];
  const completedSet=new Set(subs.filter(x=>["submitted","confirmed","graded"].includes(x.status)).map(x=>logicalKey(x.worksheets)).filter(Boolean));
  const completed=assigned.filter(x=>completedSet.has(x)).length;
  const workRate=assigned.length?Math.round(completed*1000/assigned.length)/10:0;
  const counts={present:0,late:0,absent:0,excused:0};atts.forEach(x=>{if(counts[x.status]!==undefined)counts[x.status]++});
  const attDen=counts.present+counts.late+counts.absent,attRate=attDen?Math.round((counts.present+counts.late)*1000/attDen)/10:0;
  const latestSubs=subs.slice(0,20),latestAtt=atts.slice(0,20);
  const subjectWork={};
  assignments.forEach(a=>{const s=a.worksheets?.subjects,code=s?.code||"-";if(!subjectWork[code])subjectWork[code]={name:s?.name||"",assigned:new Set(),done:new Set()};subjectWork[code].assigned.add(logicalKey(a.worksheets))});
  subs.forEach(s=>{const code=s.worksheets?.subjects?.code||"-";if(subjectWork[code]&&["submitted","confirmed","graded"].includes(s.status))subjectWork[code].done.add(logicalKey(s.worksheets))});
  const subjectAtt={};
  atts.forEach(r=>{const code=r.attendance_sessions?.subjects?.code||"-";if(!subjectAtt[code])subjectAtt[code]={name:r.attendance_sessions?.subjects?.name||"",present:0,late:0,absent:0,excused:0};if(subjectAtt[code][r.status]!==undefined)subjectAtt[code][r.status]++});
  let avatar=null;if(p.avatar_path){const r=await c.storage.from("avatars").createSignedUrl(p.avatar_path,600);avatar=r.data?.signedUrl||null}
  overlay(`<div class="v14-modal-head"><div><span class="v14-kicker">ADMIN STUDENT PROFILE</span><h2>${esc(p.full_name||"-")} ${p.display_name&&p.display_name!==p.full_name?`<small>(${esc(p.display_name)})</small>`:""}</h2><p>${esc(p.student_code||"")} • ${esc(p.class_name||"")}</p></div><button class="btn" data-v14-close>✕</button></div>
    <div class="v164-profile-kpis">
      <div><span>อัตราการส่งงาน</span><b>${workRate}%</b><small>${completed}/${assigned.length} งาน</small></div>
      <div><span>อัตราการเข้าเรียน</span><b>${attRate}%</b><small>มา ${counts.present} • สาย ${counts.late}</small></div>
      <div><span>ขาด</span><b>${counts.absent}</b><small>ครั้ง</small></div>
      <div><span>ลา</span><b>${counts.excused}</b><small>ครั้ง</small></div>
    </div>
    <div class="v14-profile-detail"><div>${avatar?`<img src="${avatar}" alt="รูปโปรไฟล์">`:`<div class="v14-big-avatar">${esc((p.full_name||"?")[0])}</div>`}</div>
      <div class="v14-info-grid">
        <div><span>ชื่อ-นามสกุล</span><b>${esc(p.full_name||"-")}</b></div><div><span>ชื่อเล่น</span><b>${esc(p.display_name&&p.display_name!==p.full_name?p.display_name:"-")}</b></div><div><span>วันเดือนปีเกิด</span><b>${p.birth_date?new Date(`${p.birth_date}T00:00:00`).toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"}):"-"}</b></div>
        <div><span>เลขนักศึกษา</span><b>${esc(p.student_code||"-")}</b></div><div><span>เลขที่</span><b>${esc(p.seat_number??"-")}</b></div>
        <div><span>ระดับ/ห้อง</span><b>${esc(p.grade_level||"")} ${esc(p.room_label||"")}</b></div><div><span>ห้องเรียน</span><b>${esc(p.class_name||"-")}</b></div>
        <div><span>แผนก</span><b>${esc(p.department||"-")}</b></div><div><span>สาขา</span><b>${esc(p.major||"-")}</b></div>
        <div><span>เบอร์โทร</span><b>${esc(p.phone||"-")}</b><small>ข้อมูลติดต่อ</small></div><div><span>อีเมลติดต่อ</span><b>${esc(p.contact_email||"-")}</b></div>
        <div><span>สถานะบัญชี</span><b>${esc(p.approval_status||"-")}</b></div><div><span>สถานะการศึกษา</span><b>${esc(p.academic_status||"-")}</b></div>
        <div><span>เปิดใช้งาน</span><b>${p.active?"ใช้งาน":"ปิดใช้งาน"}</b></div><div><span>ออนไลน์ล่าสุด</span><b>${fmt(p.last_seen_at)}</b></div>
        <div><span>วันที่สร้างบัญชี</span><b>${fmt(p.created_at)}</b></div><div><span>อนุมัติเมื่อ</span><b>${fmt(p.approved_at)}</b></div>
      </div>
    </div>
    <div class="v165-profile-enrollments"><section><h3>📚 กำลังเรียนอยู่</h3><div class="v14-chip-list">${(er.data||[]).filter(x=>x.status==="approved").map(x=>`<span>${esc(x.subjects?.code||"")} ${esc(x.subjects?.name||"")}</span>`).join("")||"<span>ยังไม่มีรายวิชาที่กำลังเรียน</span>"}</div></section><section><h3>🧾 สถานะการลงทะเบียนรายวิชา</h3><div class="v14-simple-list">${(er.data||[]).map(x=>`<div><b>${esc(x.subjects?.code||"")} ${esc(x.subjects?.name||"")}</b><span>${x.status==="approved"?"กำลังเรียน":x.status==="pending"?"รออนุมัติ":x.status==="rejected"?"ไม่อนุมัติ":"ถอนแล้ว"} • ${fmt(x.requested_at)}</span></div>`).join("")||"-"}</div></section></div>
    <div class="v164-profile-two">
      <section><h3>อัตราการส่งงานรายวิชา</h3><div class="v14-simple-list">${Object.entries(subjectWork).map(([code,x])=>{const total=x.assigned.size,done=x.done.size,rate=total?Math.round(done*1000/total)/10:0;return `<div><b>${esc(code)} ${esc(x.name)}</b><span>${done}/${total} งาน • ${rate}%</span></div>`}).join("")||"-"}</div></section>
      <section><h3>การเข้าเรียนรายวิชา</h3><div class="v14-simple-list">${Object.entries(subjectAtt).map(([code,x])=>{const den=x.present+x.late+x.absent,rate=den?Math.round((x.present+x.late)*1000/den)/10:0;return `<div><b>${esc(code)} ${esc(x.name)}</b><span>มา ${x.present} • สาย ${x.late} • ขาด ${x.absent} • ลา ${x.excused} • ${rate}%</span></div>`}).join("")||"-"}</div></section>
    </div>
    <h3>งานล่าสุด</h3><div class="v14-simple-list">${latestSubs.map(x=>`<div><b>${esc(x.worksheets?.subjects?.code||"")} ${esc(x.worksheets?.title||"")}</b><span>${esc(x.status)}${x.is_late?" • ส่งช้า":""} • ${fmt(x.submitted_at)}</span></div>`).join("")||"-"}</div>
    <h3>เช็คชื่อล่าสุด</h3><div class="v14-simple-list">${latestAtt.map(x=>`<div><b>${esc(x.attendance_sessions?.subjects?.code||"")} • ${fmtDate(x.attendance_sessions?.session_date)}</b><span>${esc(x.status)} • ${fmt(x.scanned_at)}</span></div>`).join("")||"-"}</div>`,true);
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------
async function renderPresence(){
  setTitle("สถานะออนไลน์");state.route="presence";busy("กำลังโหลดสถานะ Real-time...");const load=async()=>{const {data,error}=await client().rpc("presence_dashboard");if(error)throw error;return data||[]};const draw=rows=>{if(!content())return;content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">REAL-TIME PRESENCE</span><h1>สถานะออนไลน์</h1><p>Admin เห็นทั้งหมด • หัวหน้าห้องเห็นเฉพาะห้องของตน</p></div><div class="v14-live"><i></i> Live</div></div><div class="v14-presence-grid">${rows.map(x=>{const age=x.last_seen_at?nowMs()-new Date(x.last_seen_at).getTime():Infinity,online=age<90000,away=!online&&age<300000;return `<article class="v14-presence-card"><span class="dot ${online?"online":away?"away":"offline"}"></span><div><b>${esc(x.full_name||x.student_code||"-")}</b><small>${esc(x.student_code||"")} • ${esc(x.class_name||"")}</small><span>${esc(x.activity||"offline")} • ${x.last_seen_at?fmt(x.last_seen_at):"ยังไม่เคยออนไลน์"}</span></div><em>${online?"ออนไลน์":away?"เพิ่งออก":"ออฟไลน์"}</em></article>`}).join("")||`<div class="v14-empty">ยังไม่มีข้อมูลสถานะ</div>`}</div></section>`};draw(await load());
  const rt=await realtimeClient();if(rt){state.presenceChannel=rt.channel(`v14-presence-${uid()}`).on("postgres_changes",{event:"*",schema:"public",table:"user_presence"},async()=>{if(state.route!=="presence")return;try{draw(await load())}catch{}}).subscribe()}
}

// ---------------------------------------------------------------------------
// Attendance / leader controls
// ---------------------------------------------------------------------------
async function renderAttendance(){
  setTitle("เช็คชื่อ / การเข้าเรียน");state.route="attendance";busy("กำลังโหลดระบบเช็คชื่อ...");
  const p=await getProfile(),c=client();
  const [qr,summary,leaderRooms,lastNotice]=await Promise.all([
    p.role!=="admin"?c.rpc("get_my_attendance_qr"):Promise.resolve({data:null}),
    p.role!=="admin"?c.rpc("my_attendance_summary"):Promise.resolve({data:[]}),
    p.role!=="admin"?c.rpc("my_leader_classrooms"):Promise.resolve({data:[]}),
    p.role!=="admin"?c.from("app_notifications").select("title,message,metadata,created_at").eq("user_id",uid()).eq("type","attendance_checked").order("created_at",{ascending:false}).limit(1):Promise.resolve({data:[]})
  ]);
  const canScan=p.role==="admin"||(leaderRooms.data||[]).length>0;
  let rooms=[];
  if(p.role==="admin"){const rr=await c.from("classrooms").select("id,name,level,semester,academic_year").eq("active",true).order("name");rooms=rr.data||[]}
  else rooms=leaderRooms.data||[];
  const subjects=canScan?await allSubjects():[];
  const latest=lastNotice.data?.[0]||null;
  content().innerHTML=`<section class="v14-page v161-attendance-page">
    <div class="v14-section-head"><div><span class="v14-kicker">REAL-TIME ATTENDANCE</span><h1>${canScan?"เช็คชื่อด้วย QR Code":"QR ประจำตัว / การเข้าเรียน"}</h1><p>สแกนคนแรกเริ่มเวลา 15 นาที • ครบเวลา Server สรุปยอดอัตโนมัติ • หลังหมดเวลาเช็คสายโดย Admin เท่านั้น</p></div><span class="v16-live-pill"><i></i> Real-time</span></div>
    ${p.role!=="admin"?`<div class="v14-attendance-grid">
      <div class="card v161-student-id-card"><div class="v161-id-head"><div><span>QR ประจำตัวนักศึกษา</span><h2>${esc(p.full_name||"-")}</h2><p>${esc(p.grade_level||"")}${esc(p.room_label||"")} • รหัส ${esc(p.student_code||"-")}</p></div><div id="v14-my-qr"></div></div><small>QR เป็น Token สำหรับระบบ ไม่เปิดเผย user_id</small><button class="btn sm" id="v14-rotate-qr">ออก QR ใหม่</button></div>
      <div class="card"><h2>สรุปการเข้าเรียน</h2>${(summary.data||[]).map(x=>`<div class="v14-att-row"><div><b>${esc(x.subject_code)} ${esc(x.subject_name)}</b><small>มา ${x.present_count} • สาย ${x.late_count} • ขาด ${x.absent_count} • ลา ${x.excused_count}</small></div><strong>${x.attendance_percent??0}%</strong></div>`).join("")||`<div class="v14-empty">ยังไม่มีข้อมูลเช็คชื่อ</div>`}</div>
    </div>
    <div id="v161-latest-checkin" class="v161-checkin-banner">${latest?`<b>✅ ${esc(latest.title)}</b><span>${esc(latest.message)}</span><small>${notificationTime(latest.metadata,latest.created_at)}</small>`:`<b>สถานะเช็คชื่อวันนี้</b><span>เมื่อหัวหน้าห้อง/Admin สแกนสำเร็จ รายการจะขึ้นตรงนี้แบบ Real-time</span>`}</div>`:""}
    ${canScan?`<div class="card v14-scan-panel v161-scan-panel">
      <div class="v14-section-head compact"><div><h2>📷 เช็คชื่อภายใน 15 นาที</h2><p>เลือกห้องและรายวิชา จากนั้นสแกน QR นักศึกษา การสแกนคนแรกจะเริ่มนับเวลา</p></div><div class="v161-session-summary"><b id="v161-session-count">ยังไม่เริ่มรอบ</b><span id="v161-session-countdown">15:00</span></div></div>
      <div class="v14-form-grid"><label>ห้องเรียน<select class="input" id="v14-att-class"><option value="">เลือกห้อง</option>${rooms.map(r=>`<option value="${r.classroom_id||r.id}">${esc(r.classroom_name||r.name)}</option>`).join("")}</select></label><label>รายวิชา<select class="input" id="v14-att-subject"><option value="">เลือกรายวิชา</option>${subjects.map(s=>`<option value="${s.id}">${esc(s.code)} ${esc(s.name)}</option>`).join("")}</select></label></div>
      <div class="v161-att-actions"><button class="btn primary" id="v14-start-scan">📷 เปิดกล้องสแกน</button><button class="btn" id="v14-stop-scan">หยุดกล้อง</button><button class="btn green" id="v161-summary-submit" ${state.currentAttendanceSession?"":"disabled"}>✅ สรุปยอดและส่ง Admin</button><button class="btn" id="v14-att-summary-btn">📊 สรุปย้อนหลัง</button></div>
      <div id="v161-window-note" class="alert">⏱️ รอบเช็คชื่อปกติเปิด 15 นาทีจากการสแกนคนแรก หากสรุปก่อนเวลาได้ทันที หลังปิดรอบนักศึกษาที่มาทีหลังต้องให้ Admin สแกนและระบบจะบันทึกเป็น “มาสาย”</div>
      <div id="v14-att-summary-box"></div>
      <div class="v14-camera-grid"><div><video id="v14-scan-video" playsinline muted></video><canvas id="v14-scan-canvas" hidden></canvas></div><div>
        <form id="v14-manual-scan"><label class="field"><span>กรอก Token สำรอง</span><input class="input" name="token" placeholder="DOCNR-ATTEND:..." required></label><button class="btn">บันทึก Token</button></form>
        <div id="v14-scan-result" class="v14-scan-results"></div></div></div>
    </div>`:""}
    ${p.role==="admin"?`<div class="card v14-leader-admin"><h2>👑 แต่งตั้งหัวหน้าห้อง</h2><div class="row"><select id="v14-leader-class" class="input"><option value="">เลือกห้องเรียน</option>${rooms.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select><button id="v14-load-roster" class="btn">โหลดรายชื่อ</button></div><div id="v14-roster"></div></div>`:""}
    ${canScan?`<div class="card"><div class="row between"><div><h2>รอบเช็คชื่อล่าสุด</h2><small class="muted">กดรายการเพื่อดูรายชื่อทั้งหมด • Admin สามารถกำหนด มา/สาย/ขาด/ลา ได้โดยตรง</small></div><button class="btn sm" id="v14-refresh-sessions">รีเฟรช</button></div><div id="v14-session-list"></div></div>`:""}
  </section>`;
  if(p.role!=="admin"&&qr.data?.payload&&window.QRCode){
    new QRCode($("#v14-my-qr"),{text:qr.data.payload,width:170,height:170});
    $("#v14-rotate-qr").onclick=async()=>{if(!ask("ออก QR ใหม่? QR เดิมจะใช้เช็คชื่อไม่ได้ทันที"))return;const r=await c.rpc("rotate_attendance_qr",{p_user_id:null});if(r.error){toast(errorText(r.error),true);return}renderAttendance()}
  }
  if(canScan){
    $("#v14-start-scan").onclick=startScanner;$("#v14-stop-scan").onclick=stopScanner;
    $("#v14-manual-scan").onsubmit=async e=>{e.preventDefault();await submitAttendanceToken(new FormData(e.target).get("token"))};
    $("#v161-summary-submit").onclick=closeAttendanceCurrent;
    $("#v14-refresh-sessions").onclick=loadAttendanceSessions;$("#v14-att-summary-btn").onclick=loadAttendanceSummary;
    $("#v14-att-class").onchange=()=>{state.currentAttendanceSession=null;state.currentAttendanceDeadline=null;updateAttendanceWindow()};
    $("#v14-att-subject").onchange=()=>{state.currentAttendanceSession=null;state.currentAttendanceDeadline=null;updateAttendanceWindow()};
    await loadAttendanceSessions();startAttendanceWindowTimer();
  }
  if(p.role==="admin")$("#v14-load-roster").onclick=loadLeaderRoster;
  if(canScan){
    clearRoomChannel();const rt=await realtimeClient();
    if(rt){
      const refresh=()=>{clearTimeout(state.roomRefreshTimer);state.roomRefreshTimer=setTimeout(()=>{if(state.route==="attendance"){loadAttendanceSessions().catch(()=>{});refreshAttendanceSnapshot().catch(()=>{})}},500)};
      state.roomChannel=rt.channel(`attendance-live-${uid()}-${Date.now()}`)
        .on("postgres_changes",{event:"*",schema:"public",table:"attendance_sessions"},refresh)
        .on("postgres_changes",{event:"*",schema:"public",table:"attendance_records"},refresh)
        .subscribe();
    }
  }
}
function parseAttendanceToken(raw){const s=String(raw||"").trim();const x=s.startsWith("DOCNR-ATTEND:")?s.slice(13):s;return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}
function attendanceStatusLabel(s){return s==="present"?"มาเรียน":s==="late"?"มาสาย":s==="absent"?"ขาด":s==="excused"?"ลา":"รอเช็คชื่อ"}
function updateAttendanceWindow(){
  const el=$("#v161-session-countdown"),btn=$("#v161-summary-submit");if(btn)btn.disabled=!state.currentAttendanceSession;
  if(!el)return;
  if(!state.currentAttendanceDeadline){el.textContent="15:00";el.classList.remove("expired");return}
  const ms=new Date(state.currentAttendanceDeadline).getTime()-nowMs();
  if(ms<=0){
    el.textContent="หมดเวลา";el.classList.add("expired");
    if(!state.attendanceFinalizeNotice){state.attendanceFinalizeNotice=true;toast("ครบ 15 นาทีแล้ว ระบบกำลังสรุปยอดอัตโนมัติ นักศึกษาที่มาทีหลังต้องเช็คกับ Admin")}
    if(state.currentAttendanceSession&&!state.attendanceAutoClosing){
      state.attendanceAutoClosing=true;
      client().rpc("finalize_due_attendance_session_v161",{p_session_id:state.currentAttendanceSession}).then(r=>{
        state.attendanceAutoClosing=false;
        if(!r.error&&r.data?.ok){const s=r.data?.summary||{};toast(`สรุปอัตโนมัติแล้ว • มา ${s.present||0} สาย ${s.late||0} ขาด ${s.absent||0} ลา ${s.excused||0}`);state.currentAttendanceSession=null;state.currentAttendanceDeadline=null;stopScanner();loadAttendanceSessions().catch(()=>{})}
      }).catch(()=>{state.attendanceAutoClosing=false});
    }
    return
  }
  state.attendanceFinalizeNotice=false;const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000);el.textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;el.classList.remove("expired");
}
function startAttendanceWindowTimer(){clearInterval(state.attendanceTimer);updateAttendanceWindow();state.attendanceTimer=setInterval(updateAttendanceWindow,1000)}
async function refreshAttendanceSnapshot(){
  if(!state.currentAttendanceSession)return;
  const r=await client().rpc("attendance_session_snapshot",{p_session_id:state.currentAttendanceSession});
  if(r.error)return;
  const s=r.data||{},count=$("#v161-session-count");if(count)count.textContent=`เช็คแล้ว ${s.checked||0}/${s.expected||0} คน`;
  state.currentAttendanceDeadline=s.auto_close_at||state.currentAttendanceDeadline;
  if(s.status==="closed"){state.currentAttendanceSession=null;const b=$("#v161-summary-submit");if(b)b.disabled=true;toast(`สรุปยอดแล้ว • มา ${s.present||0} สาย ${s.late||0} ขาด ${s.absent||0} ลา ${s.excused||0}`)}
  updateAttendanceWindow();
}
async function submitAttendanceToken(raw){
  const token=parseAttendanceToken(raw);if(!token){toast("QR/Token ไม่ถูกต้อง",true);return}
  const classId=$("#v14-att-class")?.value,subjectId=$("#v14-att-subject")?.value;if(!classId||!subjectId){toast("กรุณาเลือกห้องและรายวิชาก่อนสแกน",true);return}
  if(state.scanBusy)return;state.scanBusy=true;
  const {data,error}=await client().rpc("scan_attendance_qr_v179",{p_classroom_id:classId,p_subject_id:subjectId,p_token:token,p_late_after_minutes:15,p_request_key:v179RequestKey()});state.scanBusy=false;
  if(error){toast(errorText(error),true);if(String(error.message||"").includes("ATTENDANCE_WINDOW_CLOSED_USE_ADMIN")){stopScanner();await loadAttendanceSessions()}return}
  state.currentAttendanceSession=data.session_id;state.currentAttendanceDeadline=data.auto_close_at||null;
  const btn=$("#v161-summary-submit");if(btn)btn.disabled=false;
  const box=$("#v14-scan-result"),when=data.scanned_at?new Date(data.scanned_at).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"medium"}):new Date().toLocaleString("th-TH");
  if(box)box.insertAdjacentHTML("afterbegin",`<div class="v161-scan-hit ${data.status}"><div><strong>${esc(data.full_name||"-")}</strong><span>${esc(data.grade_level||"")}${esc(data.room_label||"")} • รหัส ${esc(data.student_code||"-")}</span></div><div><b>${attendanceStatusLabel(data.status)}</b><small>${esc(when)}</small></div></div>`);
  toast(`เช็คชื่อ ${data.full_name||data.student_code} แล้ว • ${attendanceStatusLabel(data.status)}`);
  await refreshAttendanceSnapshot();loadAttendanceSessions();
}
async function startScanner(){
  if(state.scanner?.stream)return;const video=$("#v14-scan-video");if(!video)return;if(!navigator.mediaDevices?.getUserMedia){toast("เบราว์เซอร์นี้ไม่รองรับกล้อง กรุณาเปิดด้วย Chrome/Safari",true);return}
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});state.scanner={stream,raf:null,detector:null};video.srcObject=stream;await video.play();
    if("BarcodeDetector" in window){try{state.scanner.detector=new BarcodeDetector({formats:["qr_code"]})}catch{}}
    const canvas=$("#v14-scan-canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
    const loop=async()=>{if(!state.scanner?.stream)return;try{let raw=null;if(state.scanner.detector){const codes=await state.scanner.detector.detect(video);raw=codes?.[0]?.rawValue||null}else if(window.jsQR&&video.videoWidth){canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0);const img=ctx.getImageData(0,0,canvas.width,canvas.height);raw=window.jsQR(img.data,img.width,img.height,{inversionAttempts:"dontInvert"})?.data||null}if(raw){const token=parseAttendanceToken(raw),now=Date.now();if(token&&(token!==state.lastScanToken||now-state.lastScanAt>2500)){state.lastScanToken=token;state.lastScanAt=now;await submitAttendanceToken(token)}}}catch{}state.scanner.raf=requestAnimationFrame(loop)};loop();toast("กล้องพร้อมสแกน QR")
  }catch(e){toast("เปิดกล้องไม่ได้ กรุณาอนุญาต Camera หรือใช้ช่อง Token สำรอง",true)}
}
function stopScanner(){if(state.scanner?.raf)cancelAnimationFrame(state.scanner.raf);if(state.scanner?.stream)state.scanner.stream.getTracks().forEach(t=>t.stop());state.scanner=null;const v=$("#v14-scan-video");if(v)v.srcObject=null}
async function closeAttendanceCurrent(){
  if(!state.currentAttendanceSession||!ask("สรุปยอดตอนนี้และส่งให้ Admin? ผู้ที่ยังไม่ได้เช็คชื่อจะถูกบันทึกเป็นขาด และหลังจากนี้นักศึกษาที่มาทีหลังต้องเช็คกับ Admin เป็นมาสาย"))return;
  const r=await client().rpc("close_attendance_session",{p_session_id:state.currentAttendanceSession});
  if(r.error){toast(errorText(r.error),true);return}
  const s=r.data?.summary||{};toast(`ส่งสรุปให้ Admin แล้ว • มา ${s.present||0} สาย ${s.late||0} ขาด ${s.absent||0} ลา ${s.excused||0}`);
  state.currentAttendanceSession=null;state.currentAttendanceDeadline=null;stopScanner();renderAttendance();
}
async function loadAttendanceSessions(){
  const box=$("#v14-session-list");if(!box)return;
  const {data,error}=await client().from("attendance_sessions").select("id,session_date,started_at,auto_close_at,closed_at,status,late_after_minutes,close_reason,summary,classrooms(name),subjects(code,name)").order("started_at",{ascending:false}).limit(20);
  if(error){box.innerHTML=`<div class="alert error">${esc(errorText(error))}</div>`;return}
  const rows=data||[],open=rows.find(x=>x.status==="open");
  if(open&&!state.currentAttendanceSession){state.currentAttendanceSession=open.id;state.currentAttendanceDeadline=open.auto_close_at;refreshAttendanceSnapshot()}
  box.innerHTML=rows.map(x=>{const s=x.summary||{};return `<button class="v14-session-row" data-v14-session="${x.id}"><div><b>${esc(x.subjects?.code||"")} ${esc(x.subjects?.name||"")}</b><small>${esc(x.classrooms?.name||"")} • เริ่ม ${fmt(x.started_at)}${x.auto_close_at?` • กำหนดสรุป ${fmt(x.auto_close_at)}`:""}</small></div><div class="v161-session-row-end"><span class="v14-status ${x.status==="open"?"approved":"muted"}">${x.status==="open"?"กำลังเช็คชื่อ":"สรุปแล้ว"}</span>${x.status==="closed"?`<small>มา ${s.present||0} • สาย ${s.late||0} • ขาด ${s.absent||0} • ลา ${s.excused||0}</small>`:""}</div></button>`}).join("")||`<div class="v14-empty">ยังไม่มีรอบเช็คชื่อ</div>`;
  updateAttendanceWindow();
}
async function loadAttendanceSummary(){
  const classId=$("#v14-att-class")?.value,subjectId=$("#v14-att-subject")?.value,box=$("#v14-att-summary-box");
  if(!classId||!subjectId){toast("กรุณาเลือกห้องและรายวิชาก่อนดูสรุป",true);return}
  if(box)box.innerHTML='<div class="v14-loading-inline">กำลังสรุปการเข้าเรียน...</div>';
  const {data,error}=await client().rpc("attendance_subject_summary",{p_classroom_id:classId,p_subject_id:subjectId});
  if(error){if(box)box.innerHTML=`<div class="alert error">${esc(errorText(error))}</div>`;return}
  const classLabel=$("#v14-att-class")?.selectedOptions?.[0]?.textContent?.trim()||"-",subjectLabel=$("#v14-att-subject")?.selectedOptions?.[0]?.textContent?.trim()||"-";
  if(box)box.innerHTML=`<div class="row end v16-no-print" style="margin-bottom:10px"><button class="btn primary" id="v196-att-print">🖨️ พิมพ์สรุปการเข้าเรียน</button></div><div class="table-wrap"><table><thead><tr><th>รหัส</th><th>นักศึกษา</th><th>ครั้งเรียน</th><th>มา</th><th>สาย</th><th>ขาด</th><th>ลา</th><th>% เข้าเรียน</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${x.total_sessions}</td><td>${x.present_count}</td><td>${x.late_count}</td><td>${x.absent_count}</td><td>${x.excused_count}</td><td><b>${x.attendance_percent??0}%</b></td></tr>`).join("")||`<tr><td colspan="8" class="empty">ยังไม่มีรอบเช็คชื่อที่สรุปแล้ว</td></tr>`}</tbody></table></div>`;
  const pb=$("#v196-att-print");if(pb)pb.onclick=async()=>{const sr=await client().from("subjects").select("id,code,name,color_hex,academic_year,semester").eq("id",subjectId).single();if(sr.error){toast(errorText(sr.error),true);return}const rows=data||[],avg=rows.length?rows.reduce((a,x)=>a+Number(x.attendance_percent||0),0)/rows.length:0;const html=`<article class="v196-report landscape" style="--subject-color:${esc(v196SubjectColor(sr.data))}">${v196ReportHead(sr.data,"สรุปการเข้าเรียน",classLabel)}<div class="v196-report-band"><b>${esc(classLabel)}</b> • ${esc(subjectLabel)}</div><div class="v196-report-summary"><div><span>นักศึกษา</span><b>${rows.length}</b></div><div><span>เฉลี่ยเข้าเรียน</span><b>${avg.toFixed(1)}%</b></div><div><span>ครั้งมา</span><b>${rows.reduce((a,x)=>a+Number(x.present_count||0),0)}</b></div><div><span>ครั้งขาด</span><b>${rows.reduce((a,x)=>a+Number(x.absent_count||0),0)}</b></div></div><table><thead><tr><th>#</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ครั้งเรียน</th><th>มา</th><th>สาย</th><th>ขาด</th><th>ลา</th><th>% เข้าเรียน</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td class="center">${i+1}</td><td>${esc(x.student_code||"")}</td><td>${esc(x.full_name||"")}</td><td class="center">${x.total_sessions||0}</td><td class="center">${x.present_count||0}</td><td class="center">${x.late_count||0}</td><td class="center">${x.absent_count||0}</td><td class="center">${x.excused_count||0}</td><td class="center"><b>${Number(x.attendance_percent||0).toFixed(1)}%</b></td></tr>`).join("")}</tbody></table><div class="v196-signatures"><div>ครูผู้สอน</div><div>หัวหน้าแผนก/ผู้ตรวจสอบ</div></div><div class="v196-report-foot"><span>สรุป Attendance จากระบบ DOC-FULL-NR</span><span>${esc(classLabel)}</span></div></article>`;openV196Print("สรุปการเข้าเรียน",html,"landscape")};
}
async function loadAttendanceRoster(sessionId){
  const [rr,p,snap]=await Promise.all([client().rpc("attendance_session_roster_v161",{p_session_id:sessionId}),getProfile(),client().rpc("attendance_session_snapshot",{p_session_id:sessionId})]);
  if(rr.error){toast(errorText(rr.error),true);return}const editable=p?.role==="admin",s=snap.data||{};
  overlay(`<div class="v14-modal-head"><div><h2>รายชื่อการเข้าเรียน</h2><p>${editable?"Admin กำหนด มา / สาย / ขาด / ลา ได้โดยตรง":"หัวหน้าห้องดูผลแบบอ่านอย่างเดียว"} • เช็คแล้ว ${s.checked||0}/${s.expected||0}</p></div><button class="btn" data-v14-close>✕</button></div>
    <div class="v161-roster-summary"><span>มา <b>${s.present||0}</b></span><span>สาย <b>${s.late||0}</b></span><span>ขาด <b>${s.absent||0}</b></span><span>ลา <b>${s.excused||0}</b></span></div>
    <div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชั้น</th><th>สถานะ</th><th>เวลา</th></tr></thead><tbody>${(rr.data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${esc(x.grade_level||"")}${esc(x.room_label||"")}</td><td>${editable?`<select class="input" data-v161-att-user="${x.user_id}" data-session="${sessionId}"><option value="pending" ${x.status==="pending"?"selected":""} disabled>รอเช็คชื่อ</option><option value="present" ${x.status==="present"?"selected":""}>มา</option><option value="late" ${x.status==="late"?"selected":""}>สาย</option><option value="absent" ${x.status==="absent"?"selected":""}>ขาด</option><option value="excused" ${x.status==="excused"?"selected":""}>ลา</option></select>`:`<span class="v14-status ${x.status}">${attendanceStatusLabel(x.status)}</span>`}</td><td>${fmt(x.scanned_at)}</td></tr>`).join("")}</tbody></table></div>`,true);
}
async function loadLeaderRoster(){const cid=$("#v14-leader-class").value,box=$("#v14-roster");if(!cid){toast("เลือกห้องก่อน",true);return}box.innerHTML="กำลังโหลด...";const {data,error}=await client().rpc("admin_classroom_roster",{p_classroom_id:cid});if(error){box.innerHTML=`<div class="alert error">${esc(errorText(error))}</div>`;return}box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ระดับ</th><th>สิทธิ์</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${esc(x.grade_level||"")}${esc(x.room_label||"")}</td><td><button class="btn sm ${x.is_leader?"red":"green"}" data-v14-leader-user="${x.user_id}" data-class="${cid}" data-active="${x.is_leader?"false":"true"}">${x.is_leader?"ยกเลิกหัวหน้าห้อง":"แต่งตั้งหัวหน้าห้อง"}</button></td></tr>`).join("")}</tbody></table></div>`}

// ---------------------------------------------------------------------------
// Promotion Admin approval flow
// ---------------------------------------------------------------------------
async function renderPromotion(){
  setTitle("เลื่อนชั้น / ปีการศึกษา");busy("กำลังโหลดรายการเลื่อนชั้น...");const c=client();const {data,error}=await c.from("promotion_batches").select("*").order("created_at",{ascending:false}).limit(20);if(error)throw error;const batches=data||[];
  let current=batches[0]||null,items=[];if(current){const ir=await c.from("promotion_items").select("*").eq("batch_id",current.id).order("full_name");items=ir.data||[]}
  const years=await c.from("classrooms").select("academic_year").not("academic_year","is",null).order("academic_year",{ascending:false}).limit(1);const source=years.data?.[0]?.academic_year||"2569",target=String((Number(source)||2569)+1);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ADMIN APPROVAL REQUIRED</span><h1>ระบบเลื่อนชั้น</h1><p>ไม่มีการเลื่อนอัตโนมัติโดยไม่อนุมัติ • เก็บประวัติเดิมทั้งหมด</p></div><button class="btn primary" id="v14-new-promotion">＋ เตรียมปีการศึกษาใหม่</button></div>${current?`<div class="card v14-promotion-head"><div><b>ชุดล่าสุด: ${esc(current.source_academic_year||"-")} → ${esc(current.target_academic_year)}</b><span class="v14-status ${current.status}">${esc(current.status)}</span><small>สร้าง ${fmt(current.created_at)}</small></div><div class="row">${current.status==="draft"?`<button class="btn green" id="v14-approve-promotion">อนุมัติรายการ</button>`:""}${current.status==="approved"?`<button class="btn primary" id="v14-apply-promotion">ดำเนินการเลื่อนชั้นจริง</button>`:""}${!["applied","cancelled"].includes(current.status)?`<button class="btn red" id="v14-cancel-promotion">ยกเลิกชุด</button>`:""}</div></div><div class="table-wrap"><table><thead><tr><th>รหัส</th><th>นักศึกษา</th><th>เดิม</th><th>ผลที่เสนอ</th><th>การตัดสินใจ</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${esc(x.old_grade_level||"")}${esc(x.old_room_label||"")}</td><td>${esc(x.new_grade_level||"")} ${esc(x.new_room_label||"")}</td><td>${current.status==="draft"?`<select class="input" data-v14-promotion-item="${x.id}"><option value="promote" ${x.decision==="promote"?"selected":""}>เลื่อนชั้น</option><option value="repeat" ${x.decision==="repeat"||x.decision==="hold"?"selected":""}>เรียนซ้ำชั้น</option><option value="graduate" ${x.decision==="graduate"?"selected":""}>จบการศึกษา</option><option value="transfer" ${x.decision==="transfer"?"selected":""}>ย้ายออก</option><option value="suspend" ${x.decision==="suspend"?"selected":""}>พักการเรียน</option><option value="cancel" ${x.decision==="cancel"?"selected":""}>ยกเลิกรายการ</option></select>`:esc(x.decision)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="v14-empty">ยังไม่มีชุดเลื่อนชั้น</div>`}</section>`;
  $("#v14-new-promotion")?.addEventListener("click",()=>promotionCreateDialog(source,target));$("#v14-approve-promotion")?.addEventListener("click",async()=>{if(!ask("ยืนยันอนุมัติรายการเลื่อนชั้นนี้? หลังอนุมัติจะไม่สามารถแก้ผลรายคนได้"))return;const r=await c.rpc("approve_promotion_batch",{p_batch_id:current.id});if(r.error){toast(errorText(r.error),true);return}toast("อนุมัติชุดเลื่อนชั้นแล้ว");renderPromotion()});$("#v14-apply-promotion")?.addEventListener("click",async()=>{if(!ask("ยืนยันดำเนินการเลื่อนชั้นจริง? ระบบจะย้ายห้อง/ระดับตามรายการที่อนุมัติ"))return;const r=await c.rpc("apply_promotion_batch",{p_batch_id:current.id});if(r.error){toast(errorText(r.error),true);return}toast(`เลื่อนชั้นสำเร็จ ${r.data?.applied_count||0} คน`);renderPromotion()});$("#v14-cancel-promotion")?.addEventListener("click",async()=>{if(!ask("ยกเลิกชุดนี้?"))return;const r=await c.rpc("cancel_promotion_batch",{p_batch_id:current.id});if(r.error){toast(errorText(r.error),true);return}renderPromotion()});
}
function promotionCreateDialog(source,target){overlay(`<div class="v14-modal-head"><div><h2>เตรียมรายการเลื่อนชั้น</h2><p>ระบบสร้างรายการให้ตรวจ ก่อน Admin อนุมัติ</p></div><button class="btn" data-v14-close>✕</button></div><form id="v14-promo-form"><label class="field">ปีการศึกษาปัจจุบัน<input class="input" name="source" value="${esc(source)}"></label><label class="field">ปีการศึกษาใหม่<input class="input" name="target" value="${esc(target)}" required></label><label class="field">หมายเหตุ<textarea class="input" name="note"></textarea></label><div class="row end"><button class="btn primary">สร้างรายการตรวจสอบ</button></div></form>`);$("#v14-promo-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const r=await client().rpc("prepare_promotion_batch",{p_source_academic_year:String(f.get("source")||""),p_target_academic_year:String(f.get("target")||""),p_note:String(f.get("note")||"")||null});if(r.error){toast(errorText(r.error),true);return}closeOverlay();toast("สร้างรายการเลื่อนชั้นแล้ว กรุณาตรวจรายชื่อ");renderPromotion()}}


// ---------------------------------------------------------------------------
// V16.2 Subject score summary / Excel / print
// Print/download follows the uploaded grade-summary style:
// two centered title rows + light-blue header + summary component scores only.
// Detailed per-assignment status remains Admin-web only.
// ---------------------------------------------------------------------------
function scoreText(v){
  const n=Number(v||0);if(!Number.isFinite(n))return "0";
  return Number.isInteger(n)?String(n):n.toFixed(2);
}
function excelEsc(v){
  return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function downloadExcelHtml(filename,html){
  const blob=new Blob(["\uFEFF"+html],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2500);
}
function gradeSummaryRows(rows){
  return rows.map((x,i)=>({
    no:i+1,
    code:x.student_code||"",
    name:x.full_name||"",
    group:x.class_name||`${x.grade_level||""}${x.room_label||""}`,
    behavior:scoreText(x.behavior_score),
    work:scoreText(x.work_score),
    mid:scoreText(x.midterm_score),
    final:scoreText(x.final_score),
    total:scoreText(x.total_score),
    grade:scoreText(x.grade_value),
    result:x.pass_status||((Number(x.total_score||0)>=50)?"ผ่าน":"ไม่ผ่าน")
  }));
}
function gradeSummaryTableHtml(subject,rows,cfg,forExcel=false){
  const data=gradeSummaryRows(rows);
  const sem=subject.semester||"-",year=subject.academic_year||"-";
  const style=forExcel?`<style>
    @page{size:A4 landscape;margin:8mm}
    body{font-family:"TH Sarabun New","Tahoma",Arial,sans-serif;background:#fff;color:#000}
    table.report{border-collapse:collapse;width:100%;table-layout:fixed}
    .title td{border:0!important;text-align:center;font-size:22px;font-weight:700;height:34px}
    .subtitle td{border:0!important;text-align:center;font-size:20px;font-weight:700;height:32px}
    .space td{border:0!important;height:14px}
    th{background:#b7dff1;border:1px solid #222;text-align:center;font-weight:700;font-size:14px;padding:7px 4px;vertical-align:middle}
    td{border:1px solid #333;font-size:13px;padding:6px 5px;vertical-align:middle}
    td.c{text-align:center}.code{mso-number-format:"\\@"}.group{mso-number-format:"\\@"}
  </style>`:"";
  const colgroup=`<colgroup><col style="width:5%"><col style="width:12%"><col style="width:22%"><col style="width:14%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:7%"><col style="width:4%"><col style="width:8%"></colgroup>`;
  return `${style}<table class="report v162-grade-report-table">${colgroup}
    <tr class="title"><td colspan="11">ภาคเรียนที่ ${excelEsc(sem)} ปีการศึกษา ${excelEsc(year)}</td></tr>
    <tr class="subtitle"><td colspan="11">รหัสวิชา : ${excelEsc(subject.code||"")} : ${excelEsc(subject.name||"")}</td></tr>
    <tr class="space"><td colspan="11"></td></tr>
    <tr><th>ลำดับ</th><th>รหัสนักเรียนนักศึกษา</th><th>ชื่อ-สกุล</th><th>กลุ่มเรียน</th><th>จิตพิสัย(20)</th><th>ภาระงาน 17 งาน(40)</th><th>กลางภาค(20)</th><th>ปลายภาค(20)</th><th>รวม(100)</th><th>เกรด</th><th>ผล</th></tr>
    ${data.map(x=>`<tr><td class="c">${x.no}</td><td class="c code">${excelEsc(x.code)}</td><td>${excelEsc(x.name)}</td><td class="group">${excelEsc(x.group)}</td><td class="c">${x.behavior}</td><td class="c">${x.work}</td><td class="c">${x.mid}</td><td class="c">${x.final}</td><td class="c"><b>${x.total}</b></td><td class="c"><b>${x.grade}</b></td><td class="c">${excelEsc(x.result)}</td></tr>`).join("")}
  </table>`;
}
function exportGradeSummaryExcel(subject,rows,cfg){
  const title=`สรุปคะแนน-${subject.code||"รายวิชา"}-${new Date().toISOString().slice(0,10)}.xls`;
  const body=gradeSummaryTableHtml(subject,rows,cfg,true);
  const doc=`<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Grade Summary</x:Name><x:WorksheetOptions><x:Selected/><x:FitToPage/><x:Print><x:ValidPrinterInfo/><x:HorizontalResolution>600</x:HorizontalResolution><x:VerticalResolution>600</x:VerticalResolution></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${body}</body></html>`;
  downloadExcelHtml(title,doc);
}
function detailStatus(sub){
  if(!sub)return {label:"ยังไม่ส่ง",cls:"todo"};
  if(sub.status==="draft")return {label:"ร่าง",cls:"draft"};
  if(sub.is_late)return {label:"ส่งช้า",cls:"late"};
  if(["submitted","confirmed","graded"].includes(sub.status))return {label:"ส่งแล้ว",cls:"done"};
  return {label:sub.status||"—",cls:"neutral"};
}
async function loadSubjectWorkDetailData(sid){
  const c=client();
  const wr=await c.from("worksheets").select("id,title,reference_code,mode,status,due_at,settings").eq("subject_id",sid).order("reference_code",{ascending:true});
  if(wr.error)throw wr.error;
  const raw=wr.data||[];
  if(!raw.length)return {works:[],assignments:[],submissions:[]};
  const ids=raw.map(x=>x.id);
  const [ar,sr]=await Promise.all([
    c.from("worksheet_assignments").select("worksheet_id,user_id,assigned_at").in("worksheet_id",ids),
    c.from("submissions").select("worksheet_id,user_id,status,is_late,submitted_at,confirmed_at").in("worksheet_id",ids)
  ]);
  if(ar.error)throw ar.error;if(sr.error)throw sr.error;
  const byId=new Map(raw.map(w=>[w.id,w])),pairs=new Map();
  for(const w of raw){
    const key=String(w.settings?.work_pair_key||w.id),p=pairs.get(key)||{id:key,key,title:w.settings?.unit_topic||w.title,reference_code:"",mode:"pair",worksheet_ids:[]};
    p.worksheet_ids.push(w.id);
    if(w.mode==="digital")p.digital=w;else if(w.mode==="paper")p.paper=w;
    p.reference_code=[p.digital?.reference_code,p.paper?.reference_code].filter(Boolean).join(" / ");
    pairs.set(key,p);
  }
  const assignments=(ar.data||[]).map(a=>({...a,pair_id:String(byId.get(a.worksheet_id)?.settings?.work_pair_key||a.worksheet_id)}));
  const submissions=(sr.data||[]).map(s=>({...s,pair_id:String(byId.get(s.worksheet_id)?.settings?.work_pair_key||s.worksheet_id)}));
  return {works:[...pairs.values()],assignments,submissions};
}
function renderWorkDetailTable(rows,detail){
  const works=detail.works||[],assign=detail.assignments||[],subs=detail.submissions||[];
  if(!works.length)return `<div class="v14-empty">ยังไม่มีใบงานที่มอบหมายจริงในรายวิชานี้</div>`;
  const assigned=new Set(assign.map(x=>`${x.user_id}:${x.pair_id}`));
  const priority={graded:4,confirmed:3,submitted:2,draft:1};
  const subMap=new Map();
  for(const s of subs){
    const key=`${s.user_id}:${s.pair_id}`,old=subMap.get(key);
    if(!old||Number(priority[s.status]||0)>Number(priority[old.status]||0))subMap.set(key,s);
  }
  const head=works.map(w=>`<th title="${esc(w.title||"")}"><span class="v162-work-code">${esc(w.reference_code||w.title||"งาน")}</span><small>1 คู่ = 1 งาน</small></th>`).join("");
  const body=rows.map((x,i)=>`<tr><td class="sticky c">${i+1}</td><td class="sticky2"><b>${esc(x.student_code||"")}</b><small>${esc(x.full_name||"")}</small></td>${works.map(w=>{
    const key=`${x.user_id}:${w.id}`;
    if(!assigned.has(key))return `<td class="v162-work-na">—</td>`;
    const st=detailStatus(subMap.get(key));
    return `<td><span class="v162-work-status ${st.cls}">${st.label}</span></td>`;
  }).join("")}</tr>`).join("");
  return `<div class="v162-detail-note">Digital และ Paper ของหน่วยเดียวกันนับเป็น <b>1 งาน</b> เท่านั้น • Gradebook ใช้คะแนนตรวจจริง และงานย้อนหลังมีเครดิตสูงสุด 50%</div>
  <div class="v162-work-matrix"><table><thead><tr><th class="sticky">#</th><th class="sticky2">นักศึกษา</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
async function renderSubjectGradebook(sid){
  clearRoomChannel();state.subjectId=sid;state.route="courses";setTitle("สรุปคะแนนรายวิชา");busy("กำลังคำนวณคะแนนจากข้อมูลจริง...");
  const c=client();
  const [sr,gr,cr,er,detail]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,academic_year,semester").eq("id",sid).single(),
    c.rpc("admin_subject_gradebook_v193",{p_subject_id:sid}),
    c.from("subject_grade_settings").select("*").eq("subject_id",sid).maybeSingle(),
    c.from("exams").select("id,title,exam_kind,status,full_score").eq("subject_id",sid).order("created_at",{ascending:false}),
    loadSubjectWorkDetailData(sid)
  ]);
  if(sr.error)throw sr.error;if(gr.error)throw gr.error;
  const subject=sr.data,rows=gr.data||[],cfg=cr.data||{work_points:40,behavior_points:20,midterm_points:20,final_points:20,default_behavior_score:20,midterm_exam_id:null,final_exam_id:null},exams=er.data||[];
  const activeUsers=new Set(rows.map(x=>x.user_id));
  detail.assignments=(detail.assignments||[]).filter(x=>activeUsers.has(x.user_id));
  detail.submissions=(detail.submissions||[]).filter(x=>activeUsers.has(x.user_id));
  const activeWorkIds=new Set(detail.assignments.map(x=>x.worksheet_id));
  detail.works=(detail.works||[]).filter(x=>activeWorkIds.has(x.id));
  const avg=rows.length?rows.reduce((a,x)=>a+Number(x.total_score||0),0)/rows.length:0;
  const fullWork=rows.filter(x=>Number(x.assigned_work_count||0)>0&&Number(x.completed_work_count||0)>=Number(x.assigned_work_count||0)).length;
  const body=rows.map((x,i)=>`<tr>
    <td>${i+1}</td><td><b>${esc(x.student_code||"-")}</b></td><td>${esc(x.full_name||"-")}</td><td>${esc(x.class_name||`${x.grade_level||""}${x.room_label||""}`)}</td>
    <td><b>${Number(x.work_score||0).toFixed(2)}/40</b><small>ส่ง/ตรวจ ${Number(x.completed_work_count||0)}/17 งาน</small></td>
    <td><button class="v193-score-cell" data-v193-edit="${x.user_id}" title="ปรับคะแนนจิตพิสัย">${Number(x.behavior_score||0).toFixed(2)}/20 <span>✎</span></button></td>
    <td><button class="v193-score-cell" data-v193-edit="${x.user_id}" title="เพิ่ม/ลดคะแนนดิบกลางภาค"><b>${Number(x.midterm_score||0).toFixed(2)}/20</b><small>ดิบ ${Number(x.midterm_raw_score||0).toFixed(2)}/${Number(x.midterm_raw_max||20).toFixed(0)}${Number(x.midterm_adjustment||0)?` (${Number(x.midterm_adjustment)>0?"+":""}${Number(x.midterm_adjustment).toFixed(2)})`:""}</small></button></td>
    <td><button class="v193-score-cell" data-v193-edit="${x.user_id}" title="เพิ่ม/ลดคะแนนดิบปลายภาค"><b>${Number(x.final_score||0).toFixed(2)}/20</b><small>ดิบ ${Number(x.final_raw_score||0).toFixed(2)}/${Number(x.final_raw_max||20).toFixed(0)}${Number(x.final_adjustment||0)?` (${Number(x.final_adjustment)>0?"+":""}${Number(x.final_adjustment).toFixed(2)})`:""}</small></button></td>
    <td><strong>${Number(x.total_score||0).toFixed(2)}</strong></td>
    <td><span class="v193-grade-badge">${Number(x.grade_value||0).toFixed(1)}</span></td>
    <td><span class="v193-pass-pill ${x.pass_status==="ผ่าน"?"pass":"fail"}">${esc(x.pass_status||"-")}</span></td><td><button class="btn sm" data-v196-grade-student="${x.user_id}" title="พิมพ์รายงานรายบุคคล">🖨️</button></td>
  </tr>`).join("");
  state.gradebookV196={subject,rows,cfg};
  content().innerHTML=`<section class="v14-page v16-gradebook-page">
    <div class="v16-no-print"><button class="btn ghost" data-v14-admin-course="${sid}">← กลับห้องเรียน</button></div>
    <div class="v16-print-head v16-no-print"><img src="./icons/icon-192.png" alt=""><div><span>วิทยาลัยเทคนิคนางรอง</span><h1>สรุปผลคะแนนรายวิชา</h1><p>${esc(subject.code)} ${esc(subject.name)} • ปีการศึกษา ${esc(subject.academic_year||"-")} ภาคเรียน ${esc(subject.semester||"-")}</p></div></div>
    <div class="v16-summary-kpis v16-no-print"><div><span>นักศึกษา</span><b>${rows.length}</b></div><div><span>ส่งงานครบ</span><b>${fullWork}</b></div><div><span>คะแนนเฉลี่ย</span><b>${avg.toFixed(2)}</b></div><div><span>คะแนนเต็ม</span><b>100</b></div></div>
    <div class="v16-grade-rules v16-no-print"><b>เกณฑ์คะแนนปัจจุบัน</b><span>ใบงาน 17 งาน = 40 • จิตพิสัย = 20 • กลางภาค = 20 • ปลายภาค = 20 • รวม 100</span><small>คะแนนใบงานคิดค่าเฉลี่ยจากทั้ง 17 หน่วยแล้วแปลงเป็น 40 คะแนน โดยใช้คะแนนที่ครูตรวจจริง • Digital/Paper หน่วยเดียวกันนับ 1 งาน • งานย้อนหลังมีเครดิตสูงสุด 50% • เกรด: 80=4, 75=3.5, 70=3, 65=2.5, 60=2, 55=1.5, 50=1, ต่ำกว่า 50=0</small></div>
    <div class="v16-grade-actions v16-no-print">
      <button class="btn" id="v16-grade-settings">⚙️ เลือกชุดสอบกลาง/ปลายภาค</button>
      <button class="btn" id="v162-grade-excel">⬇️ ดาวน์โหลด Excel</button>
      <button class="btn primary" id="v16-grade-print">🖨️ พิมพ์สรุปคะแนน</button>
      <span class="v16-live-pill"><i></i> Real-time</span>
    </div>

    <div class="table-wrap v16-grade-table v16-no-print"><table><thead><tr><th>#</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ห้อง</th><th>งาน 17 งาน / 40</th><th>จิตพิสัย / 20</th><th>กลางภาค / 20</th><th>ปลายภาค / 20</th><th>รวม 100</th><th>เกรด</th><th>ผล</th><th>พิมพ์</th></tr></thead><tbody>${body||`<tr><td colspan="12" class="empty">ยังไม่มีนักศึกษาที่อนุมัติในห้องเรียนนี้</td></tr>`}</tbody></table></div>

    <section class="v162-web-work-details v16-no-print">
      <div class="v162-detail-head"><div><span>ADMIN ONLY</span><h2>รายละเอียดงานที่นำมาคิดคะแนน</h2><p>ดูว่านักศึกษาแต่ละคนได้รับงานใด ส่งแล้ว/ส่งช้า/ยังไม่ส่งอย่างไร รายละเอียดนี้ไม่แสดงในรายงานที่พิมพ์หรือดาวน์โหลด</p></div><div class="v162-detail-kpi">งานคู่ที่ถูกมอบหมาย <b>${detail.works.length}</b> รายการ</div></div>
      ${renderWorkDetailTable(rows,detail)}
    </section>

    <div class="v162-print-only v162-grade-print-sheet">${gradeSummaryTableHtml(subject,rows,cfg,false)}</div>
  </section>`;
  $("#v16-grade-print").onclick=()=>printGradebookSummaryV196(subject,rows);
  $("#v162-grade-excel").onclick=()=>exportGradeSummaryExcel(subject,rows,cfg);
  $("#v16-grade-settings").onclick=()=>gradeSettingsDialog(sid,cfg,exams);
  $$('[data-v193-edit]').forEach(b=>b.onclick=()=>{
    const row=rows.find(x=>x.user_id===b.dataset.v193Edit);if(row)gradeStudentScoreDialogV193(sid,row,cfg);
  });
  const rt=await realtimeClient();if(rt){
    const refresh=()=>{clearTimeout(state.roomRefreshTimer);state.roomRefreshTimer=setTimeout(()=>{if(state.subjectId===sid&&!$("#v14-overlay"))renderSubjectGradebook(sid).catch(()=>{})},1000)};
    state.roomChannel=rt.channel(`gradebook-${sid}-${Date.now()}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"submissions"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"worksheet_assignments"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"exam_attempts"},refresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"subject_behavior_scores",filter:`subject_id=eq.${sid}`},refresh)
      .subscribe();
  }
}
function gradeSettingsDialog(sid,cfg,exams){
  const mids=exams.filter(x=>x.exam_kind==="midterm"),finals=exams.filter(x=>x.exam_kind==="final");
  overlay(`<div class="v14-modal-head"><div><h2>เลือกชุดสอบสำหรับรวมคะแนน</h2><p>สัดส่วนคะแนนถูกล็อกตามเกณฑ์: งาน 40 • จิตพิสัย 20 • กลางภาค 20 • ปลายภาค 20</p></div><button class="btn" data-v14-close>✕</button></div>
  <form id="v16-grade-settings-form" class="v16-form-stack">
    <div class="alert info"><b>คะแนนรวม 100 คะแนน</b><div>ใบงาน 17 งานเฉลี่ยรวมเป็น 40 คะแนน และระบบตัดเกรดอัตโนมัติจากคะแนนรวม</div></div>
    <label>ชุดสอบกลางภาค<select class="input" name="midExam"><option value="">เลือกอัตโนมัติจากชุดล่าสุด</option>${mids.map(x=>`<option value="${x.id}" ${x.id===cfg.midterm_exam_id?"selected":""}>${esc(x.title)} • เต็ม ${scoreText(x.full_score||20)}</option>`).join("")}</select></label>
    <label>ชุดสอบปลายภาค<select class="input" name="finalExam"><option value="">เลือกอัตโนมัติจากชุดล่าสุด</option>${finals.map(x=>`<option value="${x.id}" ${x.id===cfg.final_exam_id?"selected":""}>${esc(x.title)} • เต็ม ${scoreText(x.full_score||20)}</option>`).join("")}</select></label>
    <div class="row end"><button class="btn primary">บันทึกชุดสอบ</button></div>
  </form>`);
  $("#v16-grade-settings-form").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target);
    const r=await client().rpc("admin_set_subject_grade_settings",{p_subject_id:sid,p_work_points:40,p_behavior_points:20,p_midterm_points:20,p_final_points:20,p_default_behavior_score:20,p_midterm_exam_id:String(f.get("midExam")||"")||null,p_final_exam_id:String(f.get("finalExam")||"")||null});
    if(r.error){toast(errorText(r.error),true);return}closeOverlay();toast("บันทึกชุดสอบแล้ว");renderSubjectGradebook(sid);
  };
}
function v193StepInput(name,label,value,min,max,help=""){
  return `<div class="v193-score-panel"><div><b>${esc(label)}</b>${help?`<small>${esc(help)}</small>`:""}</div><div class="v193-stepper"><button class="btn sm" type="button" data-v193-step="-1" data-target="${name}">−1</button><input class="input" name="${name}" type="number" step="0.01" min="${min}" max="${max}" value="${Number(value||0).toFixed(2)}"><button class="btn sm" type="button" data-v193-step="1" data-target="${name}">+1</button></div></div>`;
}
function gradeStudentScoreDialogV193(sid,row,cfg){
  const midMax=Number(row.midterm_raw_max||20),finMax=Number(row.final_raw_max||20),midBase=Number(row.midterm_base_raw||0),finBase=Number(row.final_base_raw||0);
  overlay(`<div class="v14-modal-head"><div><h2>ปรับคะแนนรายบุคคล</h2><p>${esc(row.student_code||"")} • ${esc(row.full_name||"")}</p></div><button class="btn" data-v14-close>✕</button></div>
  <form id="v193-score-form" class="v16-form-stack v193-score-form">
    <div class="v193-score-summary"><span>งาน <b>${Number(row.work_score||0).toFixed(2)}/40</b></span><span>รวมปัจจุบัน <b>${Number(row.total_score||0).toFixed(2)}/100</b></span><span>เกรด <b>${Number(row.grade_value||0).toFixed(1)}</b></span></div>
    ${v193StepInput("behavior","จิตพิสัย",row.behavior_score,0,20,"กำหนดได้ 0–20 คะแนน")}
    ${v193StepInput("midRaw","คะแนนดิบกลางภาค",row.midterm_raw_score,0,midMax,`คะแนนจากระบบ ${midBase.toFixed(2)} / ${midMax.toFixed(2)} • ปรับเพิ่ม/ลดได้`)}
    ${v193StepInput("finalRaw","คะแนนดิบปลายภาค",row.final_raw_score,0,finMax,`คะแนนจากระบบ ${finBase.toFixed(2)} / ${finMax.toFixed(2)} • ปรับเพิ่ม/ลดได้`)}
    <div class="v193-reset-row"><button type="button" class="btn" id="v193-reset-mid">คืนค่ากลางภาคจากระบบ</button><button type="button" class="btn" id="v193-reset-final">คืนค่าปลายภาคจากระบบ</button></div>
    <label>หมายเหตุการปรับคะแนน<textarea class="input" name="note" rows="2" placeholder="เช่น แก้คะแนนตามหลักฐาน / เพิ่มคะแนนกิจกรรม / หักคะแนนตามเงื่อนไข"></textarea></label>
    <div class="alert warn"><b>การปรับคะแนนสอบเป็น “คะแนนดิบ”</b><div>ระบบจะนำคะแนนดิบหลังปรับไปแปลงเป็นกลางภาค 20 และปลายภาค 20 อัตโนมัติ พร้อมบันทึก Audit Log</div></div>
    <div class="row end"><button class="btn primary">บันทึกและคำนวณใหม่</button></div>
  </form>`);
  const form=$("#v193-score-form");
  $$('[data-v193-step]').forEach(btn=>btn.onclick=()=>{const el=form.elements[btn.dataset.target];if(!el)return;const min=Number(el.min||0),max=Number(el.max||9999),next=Math.min(max,Math.max(min,Number(el.value||0)+Number(btn.dataset.v193Step||0)));el.value=next.toFixed(2)});
  $("#v193-reset-mid").onclick=()=>{form.elements.midRaw.value=midBase.toFixed(2)};
  $("#v193-reset-final").onclick=()=>{form.elements.finalRaw.value=finBase.toFixed(2)};
  form.onsubmit=async e=>{
    e.preventDefault();const f=new FormData(form),behavior=Number(f.get("behavior")),midRaw=Number(f.get("midRaw")),finalRaw=Number(f.get("finalRaw"));
    if(!Number.isFinite(behavior)||behavior<0||behavior>20){toast("จิตพิสัยต้องอยู่ระหว่าง 0–20",true);return}
    if(!Number.isFinite(midRaw)||midRaw<0||midRaw>midMax){toast(`คะแนนดิบกลางภาคต้องอยู่ระหว่าง 0–${midMax}`,true);return}
    if(!Number.isFinite(finalRaw)||finalRaw<0||finalRaw>finMax){toast(`คะแนนดิบปลายภาคต้องอยู่ระหว่าง 0–${finMax}`,true);return}
    const r=await client().rpc("admin_adjust_subject_scores_v193",{p_subject_id:sid,p_user_id:row.user_id,p_behavior_score:behavior,p_midterm_delta:Number((midRaw-midBase).toFixed(2)),p_final_delta:Number((finalRaw-finBase).toFixed(2)),p_note:String(f.get("note")||"")||null});
    if(r.error){toast(errorText(r.error),true);return}closeOverlay();toast("บันทึกคะแนนและคำนวณเกรดใหม่แล้ว");renderSubjectGradebook(sid);
  };
}

// ---------------------------------------------------------------------------
// V18.1 Paper Scan Hub — visible top-level Admin workflow
// ---------------------------------------------------------------------------
async function renderPaperScanHub(){
  clearRoomChannel();state.subjectId=null;state.route="paperscan";setTitle("สแกนใบงานย้อนหลัง");busy("กำลังโหลดศูนย์รับงานกระดาษ...");
  const c=client();const [sr,pr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex").eq("active",true).eq("subject_type","subject").order("code"),
    c.from("paper_scan_packets").select("id,worksheet_id,user_id,expected_pages,status,created_at,finalized_at").order("created_at",{ascending:false}).limit(20)
  ]);if(sr.error)throw sr.error;
  const packets=pr.data||[];
  content().innerHTML=`<section class="v14-page v181-paper-hub"><div class="v14-section-head"><div><span class="v14-kicker">LATE PAPER EVIDENCE</span><h1>📄 ศูนย์สแกนใบงานส่งย้อนหลัง</h1><p>เลือกวิชา → อ่าน Barcode → ถ่ายสำเนาให้ครบทุกหน้า → ยืนยันรับงาน ระบบจึงสร้าง Submission และนำไปตรวจคะแนนได้</p></div><span class="v14-stat-pill">Packet ล่าสุด <b>${packets.length}</b></span></div>
  <div class="alert warn"><b>กติกาหลักฐาน:</b> ใบงานกระดาษต้องถ่ายครบตามจำนวนหน้า (อย่างน้อย 2 หน้า) ก่อนระบบยืนยันรับงานย้อนหลัง และหลักฐานที่ยืนยันแล้วถูกล็อกเป็น Immutable Evidence</div>
  <div class="v14-course-grid">${(sr.data||[]).map(x=>`<button class="v14-course-card" data-v181-paper-subject="${x.id}" style="--course:${esc(x.color_hex||"#587FA2")}"><span class="code">${esc(x.code)}</span><b>${esc(x.name)}</b><small>เปิดกล้องสแกน Barcode และเก็บสำเนาทุกหน้า</small><div class="v14-card-footer"><span>📷 เปิดศูนย์สแกน</span><span>›</span></div></button>`).join("")}</div>
  <div class="card"><h2>ขั้นตอนรับงานย้อนหลัง</h2><div class="v181-step-grid"><div><b>1</b><span>สแกน Barcode นักศึกษา</span></div><div><b>2</b><span>ถ่ายหน้า 1…N ครบทุกหน้า</span></div><div><b>3</b><span>ตรวจ Preview ก่อนบันทึกแต่ละหน้า</span></div><div><b>4</b><span>กด “ยืนยันรับงานย้อนหลัง” เมื่อครบ</span></div></div></div></section>`;
}
// ---------------------------------------------------------------------------
// V16 Full-sheet paper scan / barcode verification / evidence copy
// ---------------------------------------------------------------------------
async function renderPaperScanCenter(sid){
  clearRoomChannel();state.subjectId=sid;state.route="paperscan";setTitle("สแกนสำเนาใบงานย้อนหลัง");busy("กำลังเปิดศูนย์สแกนเอกสาร...");
  const c=client(),[sr,rr]=await Promise.all([c.from("subjects").select("id,code,name").eq("id",sid).single(),c.rpc("admin_subject_paper_scans",{p_subject_id:sid})]);if(sr.error)throw sr.error;
  const subject=sr.data,recent=rr.data||[];
  content().innerHTML=`<section class="v14-page v16-scan-page">
    <button class="btn ghost" data-v14-route="paperscan">← กลับศูนย์สแกนทั้งหมด</button>
    <div class="v14-section-head"><div><span class="v14-kicker">MULTI-PAGE IMMUTABLE EVIDENCE</span><h1>📄 สแกนใบงานย้อนหลังให้ครบทุกหน้า</h1><p>${esc(subject.code)} ${esc(subject.name)} • Barcode หนึ่งใบงานจะสร้าง Packet หลักฐาน หน้า 1…N ก่อนยืนยันรับงาน</p></div><span class="v16-live-pill"><i></i> Server verified</span></div>
    <div class="v16-scan-grid">
      <div class="card v16-camera-card"><div class="v16-paper-frame"><video id="v16-paper-video" playsinline muted></video><div class="v16-paper-guide"><span id="v181-page-guide">อ่าน Barcode ก่อนเริ่มถ่าย</span></div></div><canvas id="v16-paper-canvas" hidden></canvas>
        <div class="row wrap"><button class="btn primary" id="v16-camera-start">เปิดกล้อง</button><button class="btn" id="v16-camera-stop">หยุดกล้อง</button><button class="btn green" id="v16-capture" disabled>📸 ถ่ายหน้าปัจจุบัน</button></div>
        <div id="v16-capture-review" class="v173-capture-review" hidden><img id="v16-capture-image" alt="ตัวอย่างสำเนาใบงาน"><div><b>ตรวจภาพหน้านี้ก่อนบันทึก</b><span>ต้องเห็นกระดาษครบทั้ง 4 มุม ตัวอักษรอ่านได้ และเป็นหน้าที่ระบบกำลังร้องขอ</span><div class="row wrap"><button class="btn" id="v16-retake" type="button">🔄 ถ่ายใหม่</button><button class="btn primary" id="v16-confirm-capture" type="button">✅ บันทึกหน้านี้</button></div></div></div>
        <div id="v181-pages" class="v181-page-progress"><div class="v14-empty">ยังไม่ได้อ่าน Barcode</div></div>
      </div>
      <div class="card"><h2>ตรวจ Barcode / QR</h2><form id="v16-token-form"><label class="field">Token ใบงาน<input id="v16-token" class="input" name="token" autocomplete="off" required placeholder="สแกนหรือกรอกรหัส"></label><button class="btn" type="submit">ตรวจข้อมูลจาก Server</button></form><div id="v16-token-info" class="v16-token-info"><div class="v14-empty">ยังไม่ได้อ่านรหัส</div></div><button class="btn primary w100" id="v181-finalize" disabled>✅ ยืนยันรับงานย้อนหลังเมื่อครบทุกหน้า</button></div>
    </div>
    <div class="v14-section-head compact"><div><h2>งานย้อนหลังที่รับล่าสุด</h2><p>เปิดดูสำเนาที่บันทึกใน Private Storage ได้จากรายการ</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>เวลา</th><th>นักศึกษา</th><th>ใบงาน</th><th>สถานะ</th><th>สำเนา</th></tr></thead><tbody>${recent.map(x=>`<tr><td>${fmt(x.scanned_at)}</td><td><b>${esc(x.student_code||"")}</b><div>${esc(x.full_name||"")}</div></td><td>${esc(x.reference_code||"")} ${esc(x.worksheet_title||"")}</td><td><span class="v14-status ${x.scan_status==="accepted"?"approved":"pending"}">${esc(x.scan_status)}</span></td><td><button class="btn sm" data-v16-view-scan="${esc(x.storage_path)}">เปิดภาพ</button></td></tr>`).join("")||`<tr><td colspan="5" class="empty">ยังไม่มีงานย้อนหลังที่ยืนยันแล้ว</td></tr>`}</tbody></table></div>
  </section>`;
  let stream=null,current=null,lastCode="",detecting=false,pendingBlob=null,pendingPreviewUrl=null;
  const video=$("#v16-paper-video"),tokenInput=$("#v16-token"),capture=$("#v16-capture"),review=$("#v16-capture-review"),reviewImg=$("#v16-capture-image"),confirmCapture=$("#v16-confirm-capture"),finalize=$("#v181-finalize");
  const stop=()=>{detecting=false;if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}video.srcObject=null;capture.disabled=true};
  const clearPreview=()=>{pendingBlob=null;if(pendingPreviewUrl){URL.revokeObjectURL(pendingPreviewUrl);pendingPreviewUrl=null}review.hidden=true;reviewImg.removeAttribute("src");capture.disabled=!stream||!current||current.revoked;capture.textContent=`📸 ถ่ายหน้า ${current?.nextPage||1}`};
  const refreshPages=async()=>{
    if(!current?.packetId){$("#v181-pages").innerHTML=`<div class="v14-empty">ยังไม่มีหน้าเอกสาร</div>`;finalize.disabled=true;return}
    const r=await c.from("paper_scan_pages").select("id,page_no,storage_path,size_bytes,sha256,scanned_at").eq("packet_id",current.packetId).order("page_no");const pages=r.data||[],done=new Set(pages.map(x=>Number(x.page_no)));
    current.captured=pages.length;current.nextPage=Array.from({length:current.expectedPages},(_,i)=>i+1).find(n=>!done.has(n))||current.expectedPages;
    $("#v181-pages").innerHTML=`<div class="v181-page-status"><b>เก็บหลักฐาน ${pages.length}/${current.expectedPages} หน้า</b><span>${pages.length===current.expectedPages?"ครบทุกหน้าแล้ว • พร้อมยืนยันรับงาน":`หน้าถัดไป: ${current.nextPage}/${current.expectedPages}`}</span></div><div class="v181-page-chips">${Array.from({length:current.expectedPages},(_,i)=>`<span class="${done.has(i+1)?"done":""}">${done.has(i+1)?"✓":"○"} หน้า ${i+1}</span>`).join("")}</div>`;
    $("#v181-page-guide").textContent=pages.length===current.expectedPages?"ครบทุกหน้าแล้ว กรุณายืนยันรับงาน":`วางหน้า ${current.nextPage}/${current.expectedPages} ให้เห็นครบทั้ง 4 มุม`;
    capture.textContent=`📸 ถ่ายหน้า ${current.nextPage}/${current.expectedPages}`;capture.disabled=!stream||current.revoked||pages.length>=current.expectedPages;finalize.disabled=pages.length!==current.expectedPages;
  };
  const lookup=async token=>{
    const clean=String(token||"").trim();if(!clean)return null;
    const tr=await c.from("paper_tokens").select("id,worksheet_id,user_id,token,used_at,expires_at,revoked_at,code_kind,last_verified_at").eq("token",clean).maybeSingle();
    if(tr.error||!tr.data){current=null;$("#v16-token-info").innerHTML=`<div class="alert error">ไม่พบ Barcode/QR นี้ในระบบ</div>`;capture.disabled=true;return null}
    const t=tr.data,[wr,pr]=await Promise.all([c.from("worksheets").select("id,title,reference_code,subject_id,due_at,status,settings").eq("id",t.worksheet_id).single(),c.from("profiles").select("id,full_name,student_code,class_name").eq("id",t.user_id).single()]);
    if(wr.error||wr.data.subject_id!==sid){current=null;$("#v16-token-info").innerHTML=`<div class="alert error">รหัสนี้ไม่ใช่ใบงานของวิชานี้</div>`;capture.disabled=true;return null}
    const expired=!!t.expires_at&&nowMs()>new Date(t.expires_at).getTime(),revoked=!!t.revoked_at,expectedPages=Math.max(2,Number(wr.data.settings?.page_count||2));
    const pk=await c.from("paper_scan_packets").select("id,expected_pages,status,accept_expired").eq("paper_token_id",t.id).neq("status","cancelled").order("created_at",{ascending:false}).limit(1).maybeSingle();
    current={token:t,worksheet:wr.data,profile:pr.data,expired,revoked,expectedPages,packetId:pk.data?.id||null,nextPage:1,captured:0};
    $("#v16-token-info").innerHTML=`<div class="v16-token-result ${revoked||expired?"warn":"ok"}"><b>${revoked?"รหัสถูกยกเลิก":expired?"รหัสหมดอายุ • Admin ต้องยืนยันรับ":"รหัสถูกต้อง"}</b><span>${esc(pr.data?.student_code||"")} • ${esc(pr.data?.full_name||"")}</span><span>${esc(wr.data.reference_code||"")} • ${esc(wr.data.title)}</span><small>ต้องสแกน ${expectedPages} หน้า • ส่งย้อนหลังเครดิตสูงสุด 50%</small></div>`;
    await refreshPages();capture.disabled=!stream||revoked;return current;
  };
  $("#v16-token-form").onsubmit=e=>{e.preventDefault();lookup(tokenInput.value)};
  $("#v16-camera-start").onclick=async()=>{if(!navigator.mediaDevices?.getUserMedia){toast("อุปกรณ์นี้ไม่รองรับกล้องผ่าน Browser",true);return}try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});video.srcObject=stream;await video.play();capture.disabled=!current||current.revoked||current.captured>=current.expectedPages;detecting=true;if("BarcodeDetector" in window){const detector=new BarcodeDetector({formats:["qr_code","code_128","code_39","ean_13","ean_8"]});const loop=async()=>{if(!detecting)return;try{const codes=await detector.detect(video),raw=codes?.[0]?.rawValue||"";if(raw&&raw!==lastCode){lastCode=raw;let parsed=raw;if(raw.includes("token=")){try{parsed=new URL(raw,location.href).searchParams.get("token")||raw}catch{}}tokenInput.value=parsed;await lookup(parsed)}}catch{}requestAnimationFrame(loop)};loop()}}catch{toast("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตสิทธิ์กล้อง",true)}};
  $("#v16-camera-stop").onclick=stop;
  $("#v16-retake").onclick=clearPreview;
  capture.onclick=async()=>{if(!stream||!current||current.captured>=current.expectedPages)return;capture.disabled=true;const canvas=$("#v16-paper-canvas");canvas.width=video.videoWidth||1920;canvas.height=video.videoHeight||1080;canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height);pendingBlob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.88));if(!pendingBlob){toast("ถ่ายภาพไม่สำเร็จ",true);capture.disabled=false;return}pendingPreviewUrl=URL.createObjectURL(pendingBlob);reviewImg.src=pendingPreviewUrl;review.hidden=false;review.scrollIntoView({behavior:"smooth",block:"center"})};
  confirmCapture.onclick=async()=>{
    if(!pendingBlob||!current)return;if(current.expired&&!current.acceptExpired){if(!ask("รหัสหมดอายุ ต้องการรับเป็นงานย้อนหลังที่หมดอายุหรือไม่?"))return;current.acceptExpired=true}
    confirmCapture.disabled=true;const pageNo=current.nextPage,blob=pendingBlob,sha=await v18Sha256Blob(blob),path=`${current.token.user_id}/paper-scans/${current.worksheet.id}/${current.token.id}/page-${String(pageNo).padStart(2,"0")}-${v179RequestKey()}.jpg`;
    const up=await c.storage.from("submissions").upload(path,blob,{contentType:"image/jpeg",upsert:false});if(up.error){toast(errorText(up.error),true);confirmCapture.disabled=false;return}
    const rr=await c.rpc("admin_record_paper_scan_page_v18",{p_token:current.token.token,p_page_no:pageNo,p_storage_path:path,p_original_name:`${current.worksheet.reference_code||current.worksheet.id}-p${pageNo}.jpg`,p_mime_type:"image/jpeg",p_size_bytes:blob.size,p_sha256:sha,p_accept_expired:!!current.acceptExpired,p_metadata:{capture:"full_sheet_camera",full_sheet:true,page_no:pageNo,expected_pages:current.expectedPages,device:deviceLabel()},p_request_key:v179RequestKey()});
    if(rr.error){await c.storage.from("submissions").remove([path]);toast(errorText(rr.error),true);confirmCapture.disabled=false;return}
    current.packetId=rr.data?.packet_id||current.packetId;clearPreview();confirmCapture.disabled=false;toast(`บันทึกหน้า ${pageNo}/${current.expectedPages} แล้ว`);await refreshPages();
  };
  finalize.onclick=async()=>{if(!current?.packetId||current.captured!==current.expectedPages)return;if(!ask(`ยืนยันรับงานย้อนหลัง ${current.expectedPages} หน้า ของ ${current.profile?.full_name||"นักศึกษา"}?`))return;finalize.disabled=true;const rr=await c.rpc("admin_finalize_paper_scan_packet_v18",{p_packet_id:current.packetId,p_request_key:v179RequestKey()});if(rr.error){toast(errorText(rr.error),true);finalize.disabled=false;return}toast("ยืนยันรับงานย้อนหลังครบทุกหน้าแล้ว • พร้อมตรวจคะแนน");stop();renderPaperScanCenter(sid)};
  const rt=await realtimeClient();if(rt){state.roomChannel=rt.channel(`paper-packet-${sid}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"paper_scan_pages"},()=>{if(current?.packetId)refreshPages().catch(()=>{})}).subscribe()}
}
async function openPaperScanCopy(path){
  const r=await client().storage.from("submissions").createSignedUrl(path,300);if(r.error){toast(errorText(r.error),true);return}window.open(r.data.signedUrl,"_blank","noopener");
}

// ---------------------------------------------------------------------------
// Delegated interactions (single owner)
// ---------------------------------------------------------------------------
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");if(!t)return;
  if(t.matches("[data-v16-base-route]")){const r=t.dataset.v16BaseRoute;clearPresenceChannel();clearRoomChannel();state.route=`base:${r}`;state.subjectId=null;heartbeat();if(window.DOCNR_BASE?.navigate){window.DOCNR_BASE.navigate(r)}else toast("Router หลักยังโหลดไม่เสร็จ กรุณาลองใหม่",true);return}
  if(t.matches("[data-v1610-flow]")){e.preventDefault();return}
  if(t.matches("[data-v1610-action]")){const action=t.dataset.v1610Action;closeOverlay();if(action.startsWith("custom:")){window.DOCNR_BASE?.navigate?.(action.slice(7));return}if(action.startsWith("base:")){const r=action.slice(5);clearPresenceChannel();clearRoomChannel();state.route=`base:${r}`;state.subjectId=null;heartbeat();if(window.DOCNR_BASE?.navigate)window.DOCNR_BASE.navigate(r);else toast("Router หลักยังโหลดไม่เสร็จ",true);return}}
  if(t.matches("[data-v161-notification]")){client().rpc("mark_notification_read",{p_notification_id:t.dataset.v161Notification});return}
  if(t.matches("[data-v15-account]")){await decideAccount(t.dataset.v15Account,t.dataset.accountStatus);return}
  if(t.matches("[data-v165-join-course]")){showJoinCourseDialog(t.dataset.v165JoinCourse,t.dataset.courseCode||"",t.dataset.courseName||"");return}
  if(t.matches("[data-v165-copy-code]")){try{await navigator.clipboard.writeText(t.dataset.v165CopyCode||"");toast("คัดลอกรหัสเข้าห้องเรียนแล้ว")}catch{toast("คัดลอกรหัสไม่สำเร็จ",true)}return}
  if(t.matches("[data-v165-change-code]")){const sid=t.dataset.v165ChangeCode,custom=prompt("ตั้ง CODE ใหม่ 4–12 ตัว (A-Z/0-9)\nกด Cancel เพื่อยกเลิก\nเว้นว่างแล้วกด OK เพื่อสุ่ม CODE ใหม่","");if(custom===null)return;const normalized=custom.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");const r=normalized?await client().rpc("admin_subject_join_code",{p_subject_id:sid,p_new_code:normalized}):await client().rpc("admin_regenerate_subject_join_code",{p_subject_id:sid});if(r.error){toast(errorText(r.error),true);return}toast(`บันทึก CODE ใหม่ ${r.data?.join_code||""} แล้ว`);if(t.dataset.v171Refresh==="courses")renderAdminCourses();else renderAdminSubject(sid);return}
  if(t.matches("[data-v14-request-course]")){const r=await client().rpc("request_subject_enrollment",{p_subject_id:t.dataset.v14RequestCourse});if(r.error)toast(errorText(r.error),true);else{toast("ส่งคำขอลงทะเบียนแล้ว");renderEnrollSubjects()}return}
  if(t.matches("[data-v14-withdraw-course]")){if(!ask("ยืนยันถอนคำขอ/ถอนรายวิชานี้? ประวัติงานที่ส่งแล้วจะยังคงอยู่"))return;const r=await client().rpc("withdraw_subject_enrollment",{p_subject_id:t.dataset.v14WithdrawCourse});if(r.error)toast(errorText(r.error),true);else{toast("ถอนรายวิชาแล้ว");renderEnrollSubjects()}return}
  if(t.matches("[data-v14-decide-enroll]")){const st=t.dataset.status;if(!ask(st==="approved"?"อนุมัติให้นักศึกษาคนนี้เรียนรายวิชานี้?":"ไม่อนุมัติคำขอนี้?"))return;const r=await client().rpc("decide_subject_enrollment",{p_enrollment_id:t.dataset.v14DecideEnroll,p_status:st,p_note:null});if(r.error)toast(errorText(r.error),true);else{toast(st==="approved"?"อนุมัติแล้ว":"บันทึกไม่อนุมัติแล้ว");renderEnrollmentAdmin()}return}
  if(t.matches("[data-v194-toggle-classroom]")){const sid=t.dataset.v194ToggleClassroom,next=t.dataset.open==="true";if(!ask(next?"ยืนยันเปิดห้องเรียนให้นักศึกษาเข้าใช้งานและใช้ CODE เข้าร่วมได้?":"ยืนยันปิดห้องเรียนชั่วคราว? ข้อมูลสมาชิก งาน และคะแนนจะไม่ถูกลบ"))return;t.disabled=true;const r=await client().rpc("admin_set_subject_classroom_open_v194",{p_subject_id:sid,p_is_open:next});if(r.error){t.disabled=false;toast(errorText(r.error),true);return}toast(next?"เปิดห้องเรียนแล้ว":"ปิดห้องเรียนแล้ว");if(t.dataset.refresh==="subject")renderAdminSubject(sid);else renderAdminCourses();return}
  if(t.matches("[data-v14-admin-course]")){window.DOCNR_BASE?.navigate?.("courses",t.dataset.v14AdminCourse);return}
  if(t.matches("[data-v14-open-course]")){window.DOCNR_BASE?.navigate?.("courses",t.dataset.v14OpenCourse);return}
  if(t.matches("[data-v14-preview]")){previewWorksheet(t.dataset.v14Preview);return}
  if(t.matches("[data-v14-upload]")){uploadSubjectFile(t.dataset.subject,t.dataset.v14Upload,t.dataset.seq);return}
  if(t.matches("[data-v14-file]")){openSubjectFile(t.dataset.v14File);return}
  if(t.matches("[data-v15-room-exam]")){openSubjectExam(t.dataset.v15RoomExam);return}
  if(t.matches("[data-v16-gradebook]")){renderSubjectGradebook(t.dataset.v16Gradebook);return}
  if(t.matches("[data-v196-gradebook]")){renderSubjectGradebook(t.dataset.v196Gradebook);return}
  if(t.matches("[data-v196-grade-student]")){printStudentGradeV196(t.dataset.v196GradeStudent);return}
  if(t.matches("[data-v196-print-mywork]")){printMyWorkSummaryV196(t.dataset.v196PrintMywork).catch(e=>toast(errorText(e),true));return}
  if(t.matches("[data-v196-blank]")){window.DOCNR_BASE?.printWorksheet?.(t.dataset.v196Blank);return}
  if(t.matches("[data-v196-blank-pack]")){window.DOCNR_BASE?.printSubjectWorksheetPack?.(t.dataset.v196BlankPack);return}
  if(t.matches("[data-v196-pack]")){window.DOCNR_HARDENING?.openPaperPrintPack?.(t.dataset.v196Pack);return}
  if(t.matches("[data-v181-paper-subject]")){renderPaperScanCenter(t.dataset.v181PaperSubject);return}
  if(t.matches("[data-v16-paper-scan]")){renderPaperScanCenter(t.dataset.v16PaperScan);return}
  if(t.matches("[data-v16-view-scan]")){openPaperScanCopy(t.dataset.v16ViewScan);return}
  if(t.matches("[data-v186-user]")){showRoomWorkChecklistCell(t.dataset.v186User,t.dataset.v186Pair);return}
  if(t.matches("[data-v15-jump]")){document.querySelector(t.dataset.v15Jump)?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(t.matches("[data-v14-open-work]")){if(window.DOCNR_BASE?.openWorksheet)window.DOCNR_BASE.openWorksheet(t.dataset.v14OpenWork);else toast("ตัวเปิดใบงานหลักยังโหลดไม่เสร็จ กรุณารีเฟรชหน้า",true);return}
  if(t.matches("[data-v14-profile]")){showAdminProfile(t.dataset.v14Profile);return}
  if(t.matches("[data-v14-session]")){loadAttendanceRoster(t.dataset.v14Session);return}
  if(t.matches("[data-v14-leader-user]")){const active=t.dataset.active==="true",r=await client().rpc("set_classroom_leader",{p_classroom_id:t.dataset.class,p_user_id:t.dataset.v14LeaderUser,p_active:active});if(r.error)toast(errorText(r.error),true);else{toast(active?"แต่งตั้งหัวหน้าห้องแล้ว":"ยกเลิกหัวหน้าห้องแล้ว");loadLeaderRoster()}return}
},false);

document.addEventListener("change",async e=>{
  const t=e.target;
  if(t.matches("[data-v14-promotion-item]")){let reason=null;if(["transfer","suspend"].includes(t.value)){reason=prompt(t.value==="transfer"?"เหตุผลการย้ายออก (จำเป็น)":"เหตุผลการพักการเรียน (จำเป็น)","");if(!reason){renderPromotion();return}}const r=await client().rpc("set_promotion_item_decision_v15",{p_item_id:t.dataset.v14PromotionItem,p_decision:t.value,p_new_grade_level:null,p_new_room_label:null,p_new_class_name:null,p_new_seat_number:null,p_reason:reason,p_effective_at:null});if(r.error){toast(errorText(r.error),true);renderPromotion()}else toast("บันทึกการตัดสินใจแล้ว");return}
  if(t.matches("[data-v161-att-user]")){const note=prompt(t.value==="excused"?"ระบุเหตุผลการลา (แนะนำให้กรอก)":"หมายเหตุการแก้สถานะ (ไม่บังคับ)","")||null;const r=await client().rpc("admin_set_attendance_status_v161",{p_session_id:t.dataset.session,p_user_id:t.dataset.v161AttUser,p_status:t.value,p_note:note});if(r.error){toast(errorText(r.error),true);loadAttendanceRoster(t.dataset.session);return}toast(`บันทึกสถานะ ${attendanceStatusLabel(t.value)} แล้ว`);loadAttendanceRoster(t.dataset.session);return}
  if(t.matches("[data-v14-att-status]")){const note=prompt("หมายเหตุการแก้สถานะ (ไม่บังคับ)","")||null;const r=await client().rpc("set_attendance_record_status",{p_record_id:t.dataset.v14AttStatus,p_status:t.value,p_note:note});if(r.error){toast(errorText(r.error),true);loadAttendanceRoster(t.dataset.session);return}toast("แก้สถานะการเข้าเรียนแล้ว");loadAttendanceRoster(t.dataset.session)}
});


// ---------------------------------------------------------------------------
// V19.6 Production Print Center
// ---------------------------------------------------------------------------
function v196SubjectColor(s){
  const palette={"20001-1001":"#2E7D32","20001-1004":"#9A6700","21900-1005":"#1565C0","21901-2008":"#7B1FA2","21901-2017":"#00838F","21901-2020":"#455A64","21910-2010":"#EF6C00","31901-2001":"#512DA8","31901-2004":"#00796B","31901-2009":"#00897B","31910-0004":"#D84315"};
  return String(s?.color_hex||palette[String(s?.code||"")]||"#1565C0")
}
function v196UnitNumber(w){const n=Number(w?.settings?.sequence_no||w?.settings?.lesson_sequence||wsSeq(w)||0);return Number.isFinite(n)&&n>0?n:0}
function v196PrintStamp(){return new Date().toLocaleString("th-TH",{dateStyle:"long",timeStyle:"short"})}
function closeV196Print(){const o=$("#v196-print-overlay");if(o)o.remove();document.body.classList.remove("v196-printing");document.body.removeAttribute("data-v196-orientation")}
function openV196Print(title,html,orientation="portrait"){
  closeV196Print();const wrap=document.createElement("div");wrap.id="v196-print-overlay";wrap.innerHTML=`<div class="v196-print-toolbar no-print"><div><b>${esc(title)}</b><small>ตรวจเอกสารก่อนพิมพ์ • รองรับ Print / Save PDF</small></div><div class="row"><button class="btn" id="v196-print-close">ปิด</button><button class="btn primary" id="v196-print-now">🖨️ พิมพ์ / Save PDF</button></div></div><main class="v196-print-pages">${html}</main>`;document.body.appendChild(wrap);
  $("#v196-print-close",wrap).onclick=closeV196Print;$("#v196-print-now",wrap).onclick=()=>{document.body.dataset.v196Orientation=orientation;document.body.classList.add("v196-printing");window.print();setTimeout(()=>{document.body.classList.remove("v196-printing");document.body.removeAttribute("data-v196-orientation")},500)};
}
function v196ReportHead(subject,title,subtitle=""){
  const printedBy=state.profile?.full_name||state.profile?.display_name||"ผู้ใช้งานระบบ";
  return `<div class="v196-report-top"></div><header class="v196-report-head"><img src="./icons/icon-192.png" alt="ตราวิทยาลัยเทคนิคนางรอง"><div><h1>${esc(title)}</h1><p>วิทยาลัยเทคนิคนางรอง${subject?` • ${esc(subject.code||"")} ${esc(subject.name||"")}`:""}</p><div class="v20-print-meta-grid"><span>รหัสวิชา <b>${esc(subject?.code||"-")}</b></span><span>ปีการศึกษา <b>${esc(subject?.academic_year||"-")}</b></span><span>ภาคเรียน <b>${esc(subject?.semester||"-")}</b></span><span>ห้อง/กลุ่ม <b>${esc(subtitle||"-")}</b></span><span>วันที่พิมพ์ <b>${esc(v196PrintStamp())}</b></span><span>ผู้พิมพ์ <b>${esc(printedBy)}</b></span><span>ระบบ <b>${RELEASE_VERSION}</b></span><span class="v20-print-page">หน้า <b>1</b></span></div></div><div class="v196-report-meta">DOC-FULL-NR<br>${RELEASE_VERSION}</div></header>`}
async function renderPrintCenterV196(){
  setTitle("ศูนย์พิมพ์และสรุปผล");busy("กำลังเตรียมรายการเอกสาร...");const p=await getProfile(true),subjects=p?.role==="admin"?await allSubjects():await approvedCourses();
  const tools=p?.role==="admin"?`${hubCard("workcheck","✅","ตารางเช็กงาน 17 หน่วย","A4 แนวนอน • สถานะงานทั้งห้อง","cyan")}${hubCard("attendance","📷","สรุปการเข้าเรียน","มา • สาย • ขาด • ลา • เปอร์เซ็นต์","orange")}${hubCard("exam","🧪","สรุปผลการสอบ","สถานะสอบและผลรายห้อง","red")}${hubCard("reports","📊","รายงาน / Export","ข้อมูลสำรองและไฟล์รายงาน","green")}`:`${hubCard("work","📋","สรุปงานของฉัน","ตรวจสถานะงานก่อนพิมพ์","violet")}${hubCard("attendance","📷","ประวัติการเข้าเรียน","ตรวจข้อมูล Attendance","orange")}${hubCard("history","🗓️","ประวัติการศึกษา","ข้อมูลปีการศึกษาแบบอ่านอย่างเดียว","slate")}`;
  content().innerHTML=`<section class="v14-page v196-print-center"><div class="v196-print-hero"><img src="./icons/icon-192.png" alt=""><div><span class="v14-kicker">PRINT & REPORT CENTER • ${RELEASE_VERSION}</span><h1>🖨️ ${p?.role==="admin"?"ศูนย์พิมพ์และสรุปผล":"พิมพ์เอกสารของฉัน"}</h1><p>เอกสารมาตรฐานเดียวกันทั้งระบบ • สีประจำวิชา • A4 • Save PDF • ใช้ข้อมูลจากระบบจริง</p></div><span class="v196-print-badge">${subjects.length} รายวิชา</span></div><div class="v196-print-tools">${tools}</div><div class="v196-print-subjects">${subjects.map(s=>`<article class="v196-print-subject" style="--subject-color:${esc(v196SubjectColor(s))}"><div class="v196-print-subject-main"><div class="v196-print-subject-head"><div><span class="v196-print-code">${esc(s.code||"")}</span><h3>${esc(s.name||"")}</h3></div><span style="width:20px;height:20px;border-radius:50%;background:${esc(v196SubjectColor(s))};border:2px solid #fff;box-shadow:0 0 0 1px #d0d5dd"></span></div><div class="v196-print-actions"><button class="btn primary" data-app-route="printcenter" data-app-arg="${s.id}">เอกสารและใบงาน</button>${p?.role==="admin"?`<button class="btn" data-v196-gradebook="${s.id}">สรุปคะแนน</button><button class="btn" data-app-route="workcheck" data-app-arg="${s.id}">เช็กงาน 17 หน่วย</button>`:`<button class="btn" data-v196-print-mywork="${s.id}">สรุปงานของฉัน</button>`}</div></div></article>`).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่พร้อมพิมพ์</div>`}</div></section>`;
}
async function renderPrintSubjectV196(sid){
  setTitle("เอกสารและใบงาน");busy("กำลังโหลดชุดพิมพ์รายวิชา...");const p=await getProfile(true),c=client();
  const [sr,wr]=await Promise.all([c.from("subjects").select("id,code,name,color_hex,academic_year,semester").eq("id",sid).single(),c.from("worksheets").select("id,title,reference_code,mode,status,due_at,settings").eq("subject_id",sid).order("created_at")]);
  if(sr.error)throw sr.error;if(wr.error)throw wr.error;const subject=sr.data;
  let papers=(wr.data||[]).filter(w=>w.mode==="paper"&&v196UnitNumber(w)>=1&&v196UnitNumber(w)<=17&&!w.settings?.legacy_seed_archived).sort((a,b)=>v196UnitNumber(a)-v196UnitNumber(b));
  if(p?.role!=="admin"){
    if(!papers.length){ papers=[]; }
    else { const ar=await c.from("worksheet_assignments").select("worksheet_id").eq("user_id",uid()).in("worksheet_id",papers.map(x=>x.id));if(ar.error)throw ar.error;const allowed=new Set((ar.data||[]).map(x=>x.worksheet_id));papers=papers.filter(x=>allowed.has(x.id)); }
  }
  const summaryTools=p?.role==="admin"?`<div class="v196-print-tools"><button class="v196-print-tool" data-v196-gradebook="${sid}"><span>📊</span><b>สรุปคะแนนทั้งห้อง</b><small>40 + 20 + 20 + 20 • เกรด • ผ่าน/ไม่ผ่าน</small></button><button class="v196-print-tool" data-app-route="workcheck" data-app-arg="${sid}"><span>✅</span><b>ตารางเช็กงาน 17 หน่วย</b><small>A4 แนวนอน • Filter รายห้อง</small></button><button class="v196-print-tool" data-app-route="attendance"><span>📷</span><b>สรุปการเข้าเรียน</b><small>เลือกห้องและรายวิชา แล้วกดพิมพ์</small></button><button class="v196-print-tool" data-app-route="exam" data-app-arg="${sid}"><span>🧪</span><b>สรุปผลการสอบ</b><small>กลางภาค / ปลายภาค / สถานะสอบ</small></button></div>`:`<div class="v196-print-tools"><button class="v196-print-tool" data-v196-print-mywork="${sid}"><span>📋</span><b>สรุปงานของฉัน</b><small>งาน 17 หน่วยและสถานะการส่ง</small></button><button class="v196-print-tool" data-app-route="attendance"><span>📷</span><b>การเข้าเรียน</b><small>ตรวจประวัติ Attendance</small></button></div>`;
  content().innerHTML=`<section class="v14-page v196-print-center"><div class="v16-no-print"><button class="btn ghost" data-app-route="printcenter">← กลับศูนย์พิมพ์</button></div><div class="v196-print-hero" style="border-left:7px solid ${esc(v196SubjectColor(subject))}"><img src="./icons/icon-192.png" alt=""><div><span class="v14-kicker">${esc(subject.code)} • PRINT PACKAGE</span><h1>${esc(subject.name)}</h1><p>ปีการศึกษา ${esc(subject.academic_year||"-")} • ภาคเรียน ${esc(subject.semester||"-")} • ใบงาน 17 หน่วยใช้สีประจำวิชาเดียวกัน</p></div><span class="v196-print-badge">${papers.length} ใบงาน</span></div>${summaryTools}<section class="v196-print-section"><div class="v196-print-section-head"><div><h2>ใบงาน A4 ประจำรายวิชา</h2><small class="muted">${p?.role==="admin"?"พิมพ์ใบงานเปล่า หรือชุดรายบุคคลพร้อม Barcode":"พิมพ์ย้อนหลังได้เมื่อ Server ตรวจสิทธิ์แล้ว"}</small></div>${p?.role==="admin"?`<button class="btn primary" data-v196-blank-pack="${sid}">🗂️ พิมพ์ใบงานเปล่าทั้ง 17 หน่วย</button>`:""}</div><div class="v196-print-list">${papers.map(w=>`<div class="v196-print-work" style="--subject-color:${esc(v196SubjectColor(subject))}"><div class="v196-print-unit">U${String(v196UnitNumber(w)).padStart(2,"0")}</div><div><b>${esc(w.title||`ใบงานหน่วย ${v196UnitNumber(w)}`)}</b><small>${esc(w.reference_code||"")} • ${w.due_at?`กำหนด ${esc(fmt(w.due_at))}`:"ไม่กำหนดวันส่ง"}</small></div><div class="v196-print-work-actions">${p?.role==="admin"?`<button class="btn" data-v196-blank="${w.id}">ใบงานเปล่า</button><button class="btn primary" data-v196-pack="${w.id}">รายบุคคล + Barcode</button>`:`<button class="btn primary" data-v175-late-paper="${w.id}">ตรวจสิทธิ์และพิมพ์ย้อนหลัง</button>`}</div></div>`).join("")||`<div class="v14-empty">ยังไม่มีใบงานกระดาษที่ได้รับสิทธิ์พิมพ์</div>`}</div></section></section>`;
}
async function printMyWorkSummaryV196(sid){
  const c=client(),p=await getProfile(true);const [sr,ar,srsub]=await Promise.all([c.from("subjects").select("id,code,name,color_hex,academic_year,semester").eq("id",sid).single(),c.from("worksheet_assignments").select("worksheet_id").eq("user_id",uid()),c.from("submissions").select("worksheet_id,status,submitted_at,confirmed_at,is_late,updated_at").eq("user_id",uid())]);if(sr.error)throw sr.error;if(ar.error)throw ar.error;if(srsub.error)throw srsub.error;
  const ids=(ar.data||[]).map(x=>x.worksheet_id);let works=[];if(ids.length){const wr=await c.from("worksheets").select("id,subject_id,title,mode,due_at,settings").in("id",ids).eq("subject_id",sid);if(wr.error)throw wr.error;works=wr.data||[]}
  const sm=new Map((srsub.data||[]).map(x=>[x.worksheet_id,x])),pairs=new Map();for(const w of works){const n=v196UnitNumber(w);if(n<1||n>17)continue;const k=String(w.settings?.work_pair_key||n);const old=pairs.get(k)||{unit:n,digital:null,paper:null};old[w.mode]=w;pairs.set(k,old)}const rows=[...pairs.values()].sort((a,b)=>a.unit-b.unit).map(x=>{const d=x.digital,pap=x.paper,sd=d?sm.get(d.id):null,sp=pap?sm.get(pap.id):null,sub=[sd,sp].filter(Boolean).sort((a,b)=>new Date(b.updated_at||b.submitted_at||0)-new Date(a.updated_at||a.submitted_at||0))[0];let st="ยังไม่ส่ง";if(sub){st=sub.status==="draft"?"ร่าง":sub.is_late||sp===sub?"ส่งย้อนหลัง":"ส่งแล้ว"}return {...x,status:st,when:sub?.submitted_at||sub?.confirmed_at||null}});
  const done=rows.filter(x=>x.status==="ส่งแล้ว"||x.status==="ส่งย้อนหลัง").length,color=v196SubjectColor(sr.data);const html=`<article class="v196-report" style="--subject-color:${esc(color)}">${v196ReportHead(sr.data,"สรุปสถานะใบงานรายบุคคล",`${p?.grade_level||""}${p?.room_label||""}`)}<div class="v196-report-band"><b>${esc(p?.student_code||"")} • ${esc(p?.full_name||"")}</b> &nbsp; ชั้น/ห้อง ${esc(p?.class_name||`${p?.grade_level||""}${p?.room_label||""}`||"-")}</div><div class="v196-report-summary"><div><span>หน่วยทั้งหมด</span><b>17</b></div><div><span>มีรายการงาน</span><b>${rows.length}</b></div><div><span>ส่งแล้ว/ย้อนหลัง</span><b>${done}</b></div><div><span>คงเหลือ</span><b>${Math.max(0,17-done)}</b></div></div><table><thead><tr><th>#</th><th>หน่วย</th><th>หัวข้อใบงาน</th><th>สถานะ</th><th>เวลาส่ง</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td class="center">${i+1}</td><td class="center">${x.unit}</td><td>${esc((x.digital||x.paper)?.title||"")}</td><td class="center">${esc(x.status)}</td><td class="center">${x.when?esc(fmt(x.when)):"-"}</td></tr>`).join("")||`<tr><td colspan="5" class="center">ยังไม่มีรายการงาน</td></tr>`}</tbody></table><div class="v196-signatures"><div>นักศึกษา</div><div>ครูผู้สอน</div></div><div class="v196-report-foot"><span>เอกสารสรุปจาก DOC-FULL-NR</span><span>${esc(sr.data.code)}</span></div></article>`;openV196Print(`สรุปงาน ${sr.data.code}`,html,"portrait");
}
function printGradebookSummaryV196(subject,rows){
  const color=v196SubjectColor(subject),passed=rows.filter(x=>x.pass_status==="ผ่าน").length,avg=rows.length?rows.reduce((a,x)=>a+Number(x.total_score||0),0)/rows.length:0;
  const html=`<article class="v196-report landscape" style="--subject-color:${esc(color)}">${v196ReportHead(subject,"สรุปผลคะแนนรายวิชา",`ปีการศึกษา ${subject.academic_year||"-"} ภาค ${subject.semester||"-"}`)}<div class="v196-report-summary"><div><span>นักศึกษา</span><b>${rows.length}</b></div><div><span>คะแนนเฉลี่ย</span><b>${avg.toFixed(2)}</b></div><div><span>ผ่าน</span><b>${passed}</b></div><div><span>ไม่ผ่าน</span><b>${Math.max(0,rows.length-passed)}</b></div></div><table><thead><tr><th>#</th><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>ชั้น/ห้อง</th><th>งาน /40</th><th>จิตพิสัย /20</th><th>กลางภาค /20</th><th>ปลายภาค /20</th><th>รวม /100</th><th>เกรด</th><th>ผล</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td class="center">${i+1}</td><td>${esc(x.student_code||"-")}</td><td>${esc(x.full_name||"-")}</td><td class="center">${esc(x.class_name||`${x.grade_level||""}${x.room_label||""}`)}</td><td class="center">${Number(x.work_score||0).toFixed(2)}</td><td class="center">${Number(x.behavior_score||0).toFixed(2)}</td><td class="center">${Number(x.midterm_score||0).toFixed(2)}</td><td class="center">${Number(x.final_score||0).toFixed(2)}</td><td class="center"><b>${Number(x.total_score||0).toFixed(2)}</b></td><td class="center">${Number(x.grade_value||0).toFixed(1)}</td><td class="center">${esc(x.pass_status||"-")}</td></tr>`).join("")||`<tr><td colspan="11" class="center">ไม่มีข้อมูล</td></tr>`}</tbody></table><div class="v196-signatures"><div>ครูผู้สอน</div><div>หัวหน้าแผนก/ผู้ตรวจสอบ</div></div><div class="v196-report-foot"><span>งาน 40 • จิตพิสัย 20 • กลางภาค 20 • ปลายภาค 20</span><span>${esc(subject.code||"")}</span></div></article>`;
  openV196Print(`สรุปคะแนน ${subject.code||""}`,html,"landscape");
}
function printStudentGradeV196(userId){
  const ctx=state.gradebookV196;if(!ctx)return toast("กรุณาเปิดสรุปคะแนนรายวิชาก่อน",true);const row=ctx.rows.find(x=>x.user_id===userId);if(!row)return;const s=ctx.subject;const color=v196SubjectColor(s);const html=`<article class="v196-report" style="--subject-color:${esc(color)}">${v196ReportHead(s,"รายงานผลการเรียนรายบุคคล",`ปีการศึกษา ${s.academic_year||"-"} ภาค ${s.semester||"-"}`)}<div class="v196-student-report-grid"><div><b>ชื่อ-นามสกุล</b><br>${esc(row.full_name||"-")}</div><div><b>รหัสนักศึกษา</b><br>${esc(row.student_code||"-")}</div><div><b>ชั้น/ห้อง</b><br>${esc(row.class_name||`${row.grade_level||""}${row.room_label||""}`)}</div><div><b>สถานะ</b><br>${esc(row.pass_status||"-")}</div></div><table><thead><tr><th>องค์ประกอบ</th><th>คะแนนเต็ม</th><th>คะแนนที่ได้</th></tr></thead><tbody><tr><td>ใบงาน 17 หน่วย</td><td class="center">40</td><td class="center">${Number(row.work_score||0).toFixed(2)}</td></tr><tr><td>จิตพิสัย</td><td class="center">20</td><td class="center">${Number(row.behavior_score||0).toFixed(2)}</td></tr><tr><td>สอบกลางภาค</td><td class="center">20</td><td class="center">${Number(row.midterm_score||0).toFixed(2)}</td></tr><tr><td>สอบปลายภาค</td><td class="center">20</td><td class="center">${Number(row.final_score||0).toFixed(2)}</td></tr><tr><th>รวม</th><th class="center">100</th><th class="center">${Number(row.total_score||0).toFixed(2)}</th></tr></tbody></table><div class="v196-grade-big"><div><span>คะแนนรวม</span><b>${Number(row.total_score||0).toFixed(2)}</b></div><div><span>เกรด</span><b>${Number(row.grade_value||0).toFixed(1)}</b></div><div><span>ผล</span><b style="font-size:16pt">${esc(row.pass_status||"-")}</b></div></div><div class="v196-signatures"><div>ครูผู้สอน</div><div>หัวหน้าแผนก/ผู้ตรวจสอบ</div></div><div class="v196-report-foot"><span>เอกสารสรุปผลรายบุคคล</span><span>${esc(s.code)}</span></div></article>`;openV196Print(`รายงานรายบุคคล ${row.student_code||""}`,html,"portrait");
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot(){
  document.documentElement.classList.add("v14-tech");document.documentElement.dataset.docnrVersion="v20-1-content-focused-slides";document.documentElement.dataset.docnrCompatRoomChecklist="v18-6-room-work-checklist";
  syncServerTime().catch(()=>{});startHeartbeat();
  scheduleEnsureNav();
  setTimeout(()=>{ensureNotificationUI();startNotificationRealtime().catch(()=>{});refreshNotificationBadge().catch(()=>{})},700);
  // app.js owns initial navigation and every subsequent route transition.
}
function cleanup(){
  stopScanner();clearPresenceChannel();clearRoomChannel();clearInterval(state.attendanceTimer);
  if(state.notificationChannel&&state.rtClient){try{state.rtClient.removeChannel(state.notificationChannel)}catch{}}
  state.notificationChannel=null;
}

// compatibility marker: V17-MASTER-FLOW
// window.DOCNR_V16_6=Object.freeze({navigate,cleanup,version:"V17-MASTER-FLOW"})
window.DOCNR_V16_6=Object.freeze({navigate,cleanup,version:RELEASE_VERSION,classroomVersion:V194_CLASSROOM_COMPAT});
window.addEventListener("pagehide",cleanup);
boot().catch(e=>console.error("DOC-FULL-NR V16.6 boot",e));

// Compatibility marker: admin_set_behavior_score (superseded by admin_adjust_subject_scores_v193 in V19.3).
