import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF="thjscmfqunlaqxlievna";
const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;
const V15_VERSION="V16.5-COURSE-CODE-BIRTHDATE-HALF-CREDIT";

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
  notificationChannel:null,notificationReady:false,notificationUid:null,attendanceTimer:null,attendanceFinalizeNotice:false,attendanceAutoClosing:false
};

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return null;
    const s=JSON.parse(raw);return s?.access_token&&s?.user?.id?s:null;
  }catch{return null}
}
function uid(){return readSession()?.user?.id||null}
function client(){
  const s=readSession();
  return createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}
  });
}
function authClient(){
  return createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function realtimeClient(){
  const s=readSession();
  if(!s)return null;
  if(state.rtClient&&state.uid===s.user.id)return state.rtClient;
  const c=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{await c.realtime.setAuth(s.access_token)}catch{}
  state.rtClient=c;return c;
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
function errorText(err){
  const raw=String(err?.message||err?.details||err?.error_description||err||"เกิดข้อผิดพลาด");
  const map={
    ADMIN_REQUIRED:"ต้องใช้บัญชี Admin",ACTIVE_USER_REQUIRED:"บัญชีนี้ยังไม่พร้อมใช้งาน",NOT_ALLOWED:"ไม่มีสิทธิ์ดำเนินการ",
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
  const bar=$(".topbar .row:last-child");if(!bar||$("#v161-notification-button"))return;
  const b=document.createElement("button");b.type="button";b.id="v161-notification-button";b.className="btn sm v161-notify-btn";
  b.innerHTML=`🔔<span id="v161-notification-count" hidden>0</span>`;b.title="การแจ้งเตือน";bar.insertBefore(b,bar.firstChild);
  b.onclick=showNotificationPanel;
}
async function showNotificationPanel(){
  $("#v161-notification-panel")?.remove();
  const {data,error}=await client().from("app_notifications").select("id,type,title,message,metadata,read_at,created_at").eq("user_id",uid()).order("created_at",{ascending:false}).limit(40);
  if(error){toast(errorText(error),true);return}
  const panel=document.createElement("aside");panel.id="v161-notification-panel";panel.className="v161-notification-panel";
  panel.innerHTML=`<div class="v161-notification-head"><div><b>🔔 การแจ้งเตือน</b><small>ข้อมูลจากระบบแบบ Real-time</small></div><button class="btn sm" id="v161-notification-close">✕</button></div>
    <div class="v161-notification-list">${(data||[]).map(n=>`<button class="v161-notification-item ${n.read_at?"":"unread"}" data-v161-notification="${n.id}">
      <b>${esc(n.title)}</b><span>${esc(n.message)}</span><small>${notificationTime(n.metadata,n.created_at)}</small>
    </button>`).join("")||`<div class="v14-empty">ยังไม่มีการแจ้งเตือน</div>`}</div>`;
  document.body.appendChild(panel);$("#v161-notification-close").onclick=()=>panel.remove();
  const unread=(data||[]).filter(n=>!n.read_at);
  await Promise.all(unread.map(n=>client().rpc("mark_notification_read",{p_notification_id:n.id}).catch(()=>null)));
  refreshNotificationBadge();
}
async function startNotificationRealtime(){
  const currentUid=uid();if(!currentUid)return;
  if(state.notificationReady&&state.notificationUid===currentUid){ensureNotificationUI();return}
  state.notificationReady=true;state.notificationUid=currentUid;ensureNotificationUI();await refreshNotificationBadge();
  const rt=await realtimeClient();if(!rt)return;
  if(state.notificationChannel)try{rt.removeChannel(state.notificationChannel)}catch{}
  state.notificationChannel=rt.channel(`app-notifications-${currentUid}-${Date.now()}`)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"app_notifications",filter:`user_id=eq.${currentUid}`},payload=>{
      const n=payload.new||{};refreshNotificationBadge();
      toast(`${n.title||"แจ้งเตือน"} • ${n.message||""}`);
      if(state.route==="attendance"){
        const banner=$("#v161-latest-checkin");
        if(banner&&n.type==="attendance_checked")banner.innerHTML=`<b>✅ ${esc(n.title||"เช็คชื่อแล้ว")}</b><span>${esc(n.message||"")}</span><small>${notificationTime(n.metadata,n.created_at)}</small>`;
      }
    }).subscribe();
}
function navBtn(route,label){const b=document.createElement("button");b.type="button";b.dataset.v14Route=route;b.className="v14-nav nav-card-btn";const parts=String(label||"").trim().split(/\s+/),icon=/^[^\p{L}\p{N}]/u.test(parts[0]||"")?parts.shift():"•";b.innerHTML=`<span class="nav-card-icon">${esc(icon)}</span><span>${esc(parts.join(" ")||label)}</span>`;return b}
async function ensureNav(){
  const nav=$("#sidebar .nav");if(!nav)return;
  const p=await getProfile();if(!p)return;
  let wanted;
  if(p.role==="admin"){
    wanted=[
      ["accounts","🧑‍🎓 คำขอบัญชี"],["courses","🏫 ห้องเรียนรายวิชา"],["enrollments","✅ อนุมัติรายวิชา"],["profiles","🪪 โปรไฟล์นักศึกษา"],
      ["attendance","📷 เช็คชื่อ / หัวหน้าห้อง"],["presence","📡 สถานะออนไลน์"],["promotion","📈 เลื่อนชั้น / ปีการศึกษา"],["exam","🧪 ระบบสอบ"]
    ];
  }else{
    wanted=[["enroll","🎓 ลงทะเบียนรายวิชา"],["courses","🏫 ห้องเรียนของฉัน"],["work","📋 ตารางสถานะงาน"],["history","🗓️ ประวัติการศึกษา"],["attendance","📷 QR / การเข้าเรียน"],["exam","🧪 ระบบสอบ"]];
    try{const {data}=await client().rpc("my_leader_classrooms");if((data||[]).length)wanted.splice(4,0,["presence","📡 สถานะห้องเรียน"])}catch{}
  }
  if(!nav.querySelector("[data-v14-divider]")){
    const d=document.createElement("div");d.dataset.v14Divider="1";d.className="v14-nav-divider";d.textContent="SMART LEARNING";
    const before=nav.querySelector('[data-route="profile"]');before?nav.insertBefore(d,before):nav.appendChild(d);
  }
  const before=nav.querySelector('[data-route="profile"]');
  const keep=new Set(wanted.map(x=>x[0]));
  $$('[data-v14-route]',nav).forEach(x=>{if(!keep.has(x.dataset.v14Route))x.remove()});
  for(const [r,l] of wanted){let b=nav.querySelector(`[data-v14-route="${r}"]`);if(!b){b=navBtn(r,l);before?nav.insertBefore(b,before):nav.appendChild(b)}else if(b.textContent!==l)b.textContent=l}
  const brand=$("#sidebar .brand .smalltext");if(brand&&brand.textContent!==`${p.role==="admin"?"ADMIN":"USER"} • V16 FINAL`)brand.textContent=`${p.role==="admin"?"ADMIN":"USER"} • V16 FINAL`;
  const ws=nav.querySelector('[data-route="worksheets"]');if(ws&&p.role==="admin")ws.remove();
  const mw=nav.querySelector('[data-route="myworks"]');if(mw&&p.role!=="admin")mw.remove();
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
  $$("#sidebar .nav button").forEach(x=>x.classList.remove("active"));
  const b=$(`#sidebar .nav [data-v14-route="${route}"]`);if(b)b.classList.add("active");
  if(route==="exam"){window.open("./exam.html","_blank","noopener");return}
  const routes=p.role==="admin"?{
    dashboard:renderAdminDashboard,accounts:renderAccountApprovals,courses:()=>arg?renderAdminSubject(arg):renderAdminCourses,enrollments:renderEnrollmentAdmin,
    profiles:renderAdminProfiles,attendance:renderAttendance,presence:renderPresence,promotion:renderPromotion
  }:{dashboard:renderStudentDashboard,enroll:renderEnrollSubjects,courses:()=>arg?renderStudentCourse(arg):renderStudentCourses,work:renderWorkStatus,history:renderAcademicHistory,attendance:renderAttendance,presence:renderPresence};
  const fn=routes[route]||routes.dashboard;try{await fn()}catch(e){console.error("V15 route",route,e);if(content())content().innerHTML=`<div class="alert error"><b>เกิดข้อผิดพลาด</b><div>${esc(errorText(e))}</div><button class="btn" data-v14-retry="${esc(route)}">ลองใหม่</button></div>`}
}

document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");if(!t)return;
  const custom=t.closest("[data-v14-route]");
  if(custom){e.preventDefault();e.stopImmediatePropagation();await navigate(custom.dataset.v14Route);return}
  const retry=t.closest("[data-v14-retry]");if(retry){e.preventDefault();navigate(retry.dataset.v14Retry);return}
  const base=t.closest("[data-route]");
  if(base){const p=await getProfile();const r=base.dataset.route;
    if(r==="dashboard"){e.preventDefault();e.stopImmediatePropagation();navigate("dashboard");return}
    if(p?.role==="admin"&&r==="worksheets"){e.preventDefault();e.stopImmediatePropagation();navigate("courses");return}
    if(p?.role!=="admin"&&r==="myworks"){e.preventDefault();e.stopImmediatePropagation();navigate("courses");return}
    state.route=`base:${r}`;heartbeat();
  }
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
    c.from("submissions").select("worksheet_id,status,submitted_at,confirmed_at,is_late,last_saved_at,attempt_count").eq("user_id",id).in("worksheet_id",ids)
  ]);if(wr.error)throw wr.error;if(sr.error)throw sr.error;
  const sm=new Map();for(const s of sr.data||[]){const old=sm.get(s.worksheet_id);if(!old||new Date(s.updated_at||s.last_saved_at||s.submitted_at||0)>=new Date(old.updated_at||old.last_saved_at||old.submitted_at||0))sm.set(s.worksheet_id,s)}
  return (wr.data||[]).map(w=>({w,s:sm.get(w.id)||null,status:workStatus(w,sm.get(w.id)||null)})).sort((x,y)=>(new Date(x.w.due_at||"9999-12-31")-new Date(y.w.due_at||"9999-12-31")));
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
function workCard(row){const {w,status}=row;return `<article class="v14-work-card" style="--course:${esc(w.subjects?.color_hex||"#22d3ee")}">
  <div class="v14-work-main"><div class="v14-course-chip">${esc(w.subjects?.code||"")} ${esc(w.subjects?.name||"")}</div><h3>${esc(w.title)}</h3>
  <div class="v14-meta">${w.mode==="paper"?"🖨️ ใบงานกระดาษ":"💻 ใบงานอิเล็กทรอนิกส์"} • ส่ง ${fmt(w.due_at)}</div></div>
  <div class="v14-work-side"><span class="v14-status ${status.cls}">${esc(status.label)}</span>${!["sent","late","graded"].includes(status.key)&&w.due_at?`<b class="v14-countdown" data-v14-countdown="${esc(w.due_at)}"></b>`:""}
  <button class="btn primary" data-v14-open-work="${w.id}">${w.mode==="digital"?"เปิดทำใบงาน":"ดูใบงาน"}</button></div></article>`}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------
async function renderAdminDashboard(){
  setTitle("ศูนย์ควบคุม");busy("กำลังสรุประบบ...");
  const c=client();const [pc,ac,sc,wc,ec,oc,xc]=await Promise.all([
    c.from("profiles").select("id",{count:"exact",head:true}).eq("role","user").eq("active",true).eq("approval_status","approved"),
    c.from("profiles").select("id",{count:"exact",head:true}).eq("role","user").eq("approval_status","pending"),
    c.from("subjects").select("id",{count:"exact",head:true}).eq("active",true).eq("subject_type","subject"),
    c.from("worksheets").select("id",{count:"exact",head:true}).contains("settings",{template_ready:true}),
    c.from("subject_enrollments").select("id",{count:"exact",head:true}).eq("status","pending"),
    c.from("user_presence").select("user_id,last_seen_at"),
    c.from("exams").select("id",{count:"exact",head:true})
  ]);
  const online=(oc.data||[]).filter(x=>x.last_seen_at&&new Date(x.last_seen_at).getTime()>=nowMs()-90000).length;
  content().innerHTML=`<section class="v14-page"><div class="v14-hero"><div><span class="v14-kicker">DOC-FULL-NR • ${V15_VERSION}</span><h1>ศูนย์ควบคุมการเรียนรู้</h1><p>วิทยาลัยเทคนิคนางรอง • ระบบรายวิชา ใบงาน เช็คชื่อ สอบ และเลื่อนชั้น</p></div><div class="v14-live"><i></i> Production Connected</div></div>
  <div class="v14-kpis"><div><span>นักศึกษาใช้งาน</span><b>${pc.count||0}</b></div><div><span>รออนุมัติบัญชี</span><b>${ac.count||0}</b></div><div><span>รายวิชา</span><b>${sc.count||0}</b></div><div><span>ใบงานสำเร็จรูป</span><b>${wc.count||0}</b><small>ต้องคง 198</small></div><div><span>รออนุมัติวิชา</span><b>${ec.count||0}</b></div><div><span>ออนไลน์ล่าสุด</span><b>${online}</b></div><div><span>ชุดข้อสอบ</span><b>${xc.count||0}</b></div></div>
  <div class="v14-action-grid v161-menu-grid">
    <button data-v14-route="accounts"><span>🧑‍🎓</span><b>อนุมัติบัญชี</b><small>ตรวจคำขอบัญชีนักศึกษาก่อนเปิดสิทธิ์ใช้งาน</small></button>
    <button data-v14-route="courses"><span>🎓</span><b>ห้องเรียนรายวิชา</b><small>นักศึกษา ใบงาน สื่อ คะแนน และเครื่องมืออยู่ในห้องเดียวกัน</small></button>
    <button data-v14-route="enrollments"><span>✅</span><b>อนุมัติลงทะเบียนเรียน</b><small>กำหนดว่านักศึกษาคนใดเป็นสมาชิกวิชาใด</small></button>
    <button data-v14-route="attendance"><span>📷</span><b>เช็คชื่อ / หัวหน้าห้อง</b><small>QR 15 นาที • สรุปยอด • ลา/สาย • Real-time</small></button>
    <button data-v14-route="presence"><span>📡</span><b>สถานะออนไลน์</b><small>ดูผู้ใช้งานที่กำลังออนไลน์แบบ Real-time</small></button>
    <button data-v14-route="profiles"><span>🪪</span><b>โปรไฟล์นักศึกษา</b><small>ข้อมูลทางการศึกษาและข้อมูลส่วนตัวสำหรับ Admin</small></button>
    <button data-v14-route="promotion"><span>📈</span><b>เลื่อนชั้น</b><small>ตรวจรายชื่อ อนุมัติ และเก็บประวัติการศึกษา</small></button>
    <button data-v14-route="exam"><span>🧪</span><b>Exam Center</b><small>คลังข้อสอบ สอบกลาง/ปลายภาค และผลสอบ</small></button>
    <button data-v16-base-route="users"><span>👥</span><b>ผู้ใช้งาน</b><small>จัดการบัญชีและข้อมูลนักศึกษาโดย Admin</small></button>
    <button data-v16-base-route="grading"><span>📝</span><b>ตรวจงาน</b><small>ตรวจ Submission ให้คะแนนและสถานะงาน</small></button>
    <button data-v16-base-route="overrides"><span>⏳</span><b>สิทธิ์ส่งเพิ่ม</b><small>ขยายเวลาหรือเพิ่มสิทธิ์ส่งงานรายบุคคล</small></button>
    <button data-v16-base-route="reports"><span>📊</span><b>รายงาน</b><small>ดูรายงานผลและ Export สำหรับ Admin</small></button>
    <button data-v16-base-route="audit"><span>🧾</span><b>Audit Log</b><small>ตรวจประวัติการดำเนินการสำคัญของระบบ</small></button>
    <button data-v16-base-route="system"><span>⚙️</span><b>ตั้งค่าระบบ</b><small>สถานะระบบ การลงทะเบียน และการตั้งค่าหลัก</small></button>
  </div>
  <div class="card v14-system-strip"><div><b>เบอร์โทรศัพท์นักศึกษา</b><div class="muted">บันทึกเป็นข้อมูลติดต่อในโปรไฟล์เท่านั้น • ไม่ใช้ OTP และไม่บังคับยืนยัน SMS</div></div><span class="v14-status approved">Profile only</span></div></section>`;
}
async function renderStudentDashboard(){return renderCourseRegistrationHome()}
function courseEnrollmentState(enroll){return enroll?.status||"none"}
function courseStatusLabel(st){return st==="approved"?"กำลังเรียน":st==="pending"?"รออนุมัติ":st==="rejected"?"เคยไม่อนุมัติ":st==="withdrawn"?"ถอนแล้ว":"เปิดรับสมัคร"}
async function renderCourseRegistrationHome(){
  setTitle("ลงทะเบียนเรียน");busy("กำลังโหลดรายวิชาที่เปิดรับ...");
  const c=client(),p=await getProfile();
  const [subjects,enrolls,works]=await Promise.all([allSubjects(),enrollmentRowsMine(),studentWorkRows().catch(()=>[])]);
  const em=new Map(enrolls.map(x=>[x.subject_id,x])),approved=enrolls.filter(x=>x.status==="approved").length;
  content().innerHTML=`<section class="v14-page v165-enrollment-home">
    <div class="v165-course-home-head"><div><span class="v14-kicker">COURSE REGISTRATION</span><h1>เลือกลงทะเบียนเรียน</h1><p>สวัสดี ${esc(p?.full_name||"")} • เลือกรายวิชาแล้วกรอกรหัสเข้าห้องที่ได้รับจาก Admin</p></div><div class="v165-my-course-count"><b>${approved}</b><span>วิชาที่กำลังเรียน</span></div></div>
    <div class="card v165-course-search"><input id="v165-course-q" class="input" placeholder="🔎 ค้นหารหัสวิชา / ชื่อวิชา"><div class="v165-course-tabs"><button class="active" data-v165-course-filter="all">ทั้งหมด</button><button data-v165-course-filter="available">เปิดรับสมัคร</button><button data-v165-course-filter="approved">กำลังเรียน</button><button data-v165-course-filter="pending">รออนุมัติ</button></div></div>
    <div class="v165-course-gallery" id="v165-course-gallery">${subjects.map((s,i)=>{const e=em.get(s.id),st=courseEnrollmentState(e),cw=works.filter(x=>x.w?.subject_id===s.id),done=cw.filter(x=>["sent","late","graded"].includes(x.status?.key)).length,total=cw.length;return `<article class="v165-course-tile" data-v165-course-card data-search="${esc(`${s.code} ${s.name}`.toLowerCase())}" data-status="${esc(st)}"><div class="v165-course-cover" style="--course:${esc(s.color_hex||["#79a8c7","#7aa895","#a48db3","#b49c72"][i%4])}"><span>📘</span><small>${esc(s.code)}</small></div><div class="v165-course-body"><div class="v165-course-badges"><span>${courseStatusLabel(st)}</span>${s.semester?`<span>ภาค ${esc(s.semester)}</span>`:""}</div><h3>${esc(s.name)}</h3><p>${esc(s.description||`ปีการศึกษา ${s.academic_year||"-"}`)}</p>${st==="approved"?`<div class="v165-progress-note">งานที่ดำเนินการ ${done}/${total}</div>`:""}<div class="v165-course-actions">${st==="approved"?`<button class="btn primary" data-v14-open-course="${s.id}">เข้าเรียน</button>`:`<button class="btn primary" data-v165-join-course="${s.id}" data-course-code="${esc(s.code)}" data-course-name="${esc(s.name)}">ใส่รหัสเข้าร่วม</button>`}</div></div></article>`}).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่เปิดรับ</div>`}</div>
    <div class="v165-enroll-help"><span>🔐</span><div><b>รหัสเข้าห้องเรียนรับจาก Admin/ครูผู้สอน</b><p>เมื่อกรอกรหัสถูกต้อง ระบบจะเพิ่มคุณเป็นสมาชิกห้องเรียนรายวิชานั้นทันที และรับใบงานที่เผยแพร่แล้วโดยอัตโนมัติ</p></div></div>
  </section>`;
  let filter="all";const draw=()=>{const q=$("#v165-course-q")?.value.trim().toLowerCase()||"";$$("[data-v165-course-card]").forEach(card=>{const st=card.dataset.status,matchFilter=filter==="all"||(filter==="available"&&st!=="approved"&&st!=="pending")||st===filter;card.hidden=!(matchFilter&&(!q||card.dataset.search.includes(q)))})};$("#v165-course-q").oninput=draw;$$("[data-v165-course-filter]").forEach(b=>b.onclick=()=>{$$("[data-v165-course-filter]").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.v165CourseFilter;draw()});
}
async function showJoinCourseDialog(subjectId,code,name){
  overlay(`<div class="v14-modal-head"><div><span class="v14-kicker">JOIN COURSE</span><h2>เข้าร่วม ${esc(code)} ${esc(name)}</h2><p>กรอกรหัสที่ได้รับจาก Admin</p></div><button class="btn" data-v14-close>✕</button></div><form id="v165-join-form"><label class="field"><span>รหัสเข้าห้องเรียน</span><input class="input v165-code-input" name="code" autocomplete="off" maxlength="12" placeholder="เช่น A1B2C3" required></label><div class="alert">รหัสนี้ใช้เฉพาะการเข้าร่วมรายวิชา ไม่ใช่รหัสผ่านบัญชี</div><div class="row end"><button type="button" class="btn" data-v14-close>ยกเลิก</button><button class="btn primary">ยืนยันเข้าร่วม</button></div></form>`);
  $("#v165-join-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),joinCode=String(f.get("code")||"").trim().toUpperCase(),btn=e.submitter;if(joinCode.length<4){toast("กรุณากรอกรหัสเข้าห้องเรียน",true);return}btn.disabled=true;btn.textContent="กำลังตรวจรหัส...";const {data,error}=await client().rpc("join_subject_with_code",{p_subject_id:subjectId,p_code:joinCode});if(error){btn.disabled=false;btn.textContent="ยืนยันเข้าร่วม";toast(String(error.message||"").includes("JOIN_CODE_INVALID")?"รหัสเข้าห้องเรียนไม่ถูกต้อง":errorText(error),true);return}closeOverlay();toast(`เข้าร่วม ${data?.subject_code||code} แล้ว`);renderCourseRegistrationHome()};
}

// ---------------------------------------------------------------------------
// Subject enrollment
// ---------------------------------------------------------------------------
async function enrollmentRowsMine(){const {data,error}=await client().from("subject_enrollments").select("id,subject_id,status,requested_at,decided_at,note").eq("user_id",uid());if(error)throw error;return data||[]}
async function renderEnrollSubjects(){return renderCourseRegistrationHome()}

async function renderEnrollmentAdmin(){
  setTitle("อนุมัติรายวิชา");busy("กำลังโหลดคำขอลงทะเบียน...");const {data,error}=await client().from("subject_enrollments").select("id,subject_id,user_id,status,requested_at,decided_at,note,subjects(code,name),profiles(full_name,student_code,grade_level,room_label,class_name)").order("requested_at",{ascending:false});if(error)throw error;const rows=data||[];
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ADMIN APPROVAL</span><h1>อนุมัติการลงทะเบียนรายวิชา</h1><p>ผู้เรียนจะได้รับใบงานและข้อสอบของวิชานั้นหลังอนุมัติ</p></div><div class="v14-stat-pill">รออนุมัติ <b>${rows.filter(x=>x.status==="pending").length}</b></div></div>
  <div class="card v14-filter"><select id="v14-enroll-filter" class="input"><option value="">ทุกสถานะ</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ไม่อนุมัติ</option><option value="withdrawn">ถอน</option></select><input id="v14-enroll-q" class="input" placeholder="ค้นหาชื่อ / รหัส / วิชา"></div>
  <div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>รายวิชา</th><th>วันที่ขอ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody id="v14-enroll-body"></tbody></table></div></section>`;
  const draw=()=>{const st=$("#v14-enroll-filter").value,q=$("#v14-enroll-q").value.trim().toLowerCase();const f=rows.filter(x=>(!st||x.status===st)&&(!q||`${x.profiles?.full_name} ${x.profiles?.student_code} ${x.subjects?.code} ${x.subjects?.name}`.toLowerCase().includes(q)));$("#v14-enroll-body").innerHTML=f.map(x=>`<tr><td><b>${esc(x.profiles?.full_name||"-")}</b><div class="muted smalltext">${esc(x.profiles?.student_code||"")} • ${esc(x.profiles?.grade_level||"")}${esc(x.profiles?.room_label||"")}</div></td><td><b>${esc(x.subjects?.code||"")}</b> ${esc(x.subjects?.name||"")}</td><td>${fmt(x.requested_at)}</td><td><span class="v14-status ${x.status}">${x.status==="pending"?"รออนุมัติ":x.status==="approved"?"อนุมัติแล้ว":x.status==="rejected"?"ไม่อนุมัติ":"ถอน"}</span></td><td>${x.status!=="approved"?`<button class="btn green sm" data-v14-decide-enroll="${x.id}" data-status="approved">อนุมัติ</button>`:""} ${x.status!=="rejected"?`<button class="btn red sm" data-v14-decide-enroll="${x.id}" data-status="rejected">ไม่อนุมัติ</button>`:""}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">ไม่พบรายการ</td></tr>`};draw();$("#v14-enroll-filter").onchange=draw;$("#v14-enroll-q").oninput=draw;
}

// ---------------------------------------------------------------------------
// Admin subject-first bundle / release
// ---------------------------------------------------------------------------
async function renderAdminCourses(){
  setTitle("ห้องเรียนรายวิชา");busy("กำลังโหลดห้องเรียนรายวิชาและใบงานสำเร็จรูป...");const c=client();const [sr,wr,er,xr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,semester,academic_year,description").eq("active",true).eq("subject_type","subject").order("code"),
    c.from("worksheets").select("id,subject_id,mode,status,settings,open_at,due_at").order("created_at"),
    c.from("subject_enrollments").select("subject_id,status"),
    c.from("exams").select("id,subject_id,status")
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(er.error)throw er.error;const ready=(wr.data||[]).filter(w=>w.settings?.template_ready===true);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">SUBJECT = CLASSROOM</span><h1>ห้องเรียนรายวิชา</h1><p>แต่ละรายวิชาเป็นห้องเรียนหนึ่งห้อง ใช้ชื่อ/รหัสชุดเดียวกัน นักศึกษาที่อนุมัติคือสมาชิกห้อง และใบงานสำเร็จรูปของวิชานั้นจะแสดงอยู่ภายในห้องโดยตรง</p></div><div class="v14-stat-pill">ใบงานสำเร็จรูป <b>${ready.length}</b></div></div>
  <div class="card v15-room-note"><b>โครงสร้างห้องเรียนรายวิชา</b><span>รายวิชา → สมาชิกนักศึกษา → ใบงานสำเร็จรูป → สไลด์/สื่อ → ปล่อยงาน → ระบบสอบ</span></div>
  <div class="card v14-filter"><input id="v14-course-q" class="input" placeholder="ค้นหารหัสวิชา / ชื่อห้องเรียน"></div>
  <div id="v14-admin-course-grid" class="v14-course-grid">${(sr.data||[]).map(s=>{const ws=ready.filter(w=>w.subject_id===s.id),paper=ws.filter(w=>w.mode==="paper").length,digital=ws.filter(w=>w.mode==="digital").length,learners=(er.data||[]).filter(e=>e.subject_id===s.id&&e.status==="approved").length,published=(wr.data||[]).filter(w=>w.subject_id===s.id&&w.status==="published").length,examCount=(xr.data||[]).filter(x=>x.subject_id===s.id).length;return `<button class="v14-course-card v15-room-card" data-v14-admin-course="${s.id}" data-search="${esc(`${s.code} ${s.name}`.toLowerCase())}" style="--course:${esc(s.color_hex||"#22d3ee")}"><span class="v15-room-label">🏫 ห้องเรียน</span><span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><div class="v14-course-counts"><span>👥 ${learners} คน</span><span>📚 ${paper+digital} ใบ</span><span>🚀 ${published} ปล่อยแล้ว</span><span>🧪 ${examCount} ชุดสอบ</span></div><small>เปิดห้อง → รายชื่อนักศึกษา • ใบงาน • สื่อ • ระบบสอบ</small></button>`}).join("")}</div></section>`;
  $("#v14-course-q").oninput=e=>{const q=e.target.value.trim().toLowerCase();$$('[data-v14-admin-course]').forEach(x=>x.hidden=q&&!x.dataset.search.includes(q))};
}
function wsSeq(w){const m=String(w.reference_code||"").match(/-([PD]\d{2})$/);return m?Number(m[1].slice(1)):Number(w.settings?.lesson_sequence||0)||0}
function wsCode(w){const m=String(w.reference_code||"").match(/-([PD]\d{2})$/);return m?m[1]:(w.mode==="paper"?"P":"D")}
function subjectRoomName(s){return `${s?.code||""} ${s?.name||""}`.trim()}
function openSubjectExam(subjectId){window.open(`./exam.html?subject=${encodeURIComponent(subjectId||"")}&from=room`,"_blank","noopener")}
async function renderAdminSubject(sid){
  state.subjectId=sid;state.route="courses";heartbeat();setTitle("ห้องเรียนรายวิชา");busy("กำลังเปิดห้องเรียนและชุดใบงาน...");const c=client();
  const [sr,wr,fr,er,xr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,description,semester,academic_year").eq("id",sid).single(),
    c.from("worksheets").select("*").eq("subject_id",sid).order("created_at"),
    c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,mime_type,size_bytes,created_at").eq("subject_id",sid).order("created_at"),
    c.from("subject_enrollments").select("id,status,user_id,requested_at,profiles(full_name,student_code,grade_level,room_label,class_name)").eq("subject_id",sid),
    c.from("exams").select("id,title,status,open_at,due_at").eq("subject_id",sid).order("created_at",{ascending:false})
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(fr.error)throw fr.error;if(er.error)throw er.error;
  const s=sr.data,allWorks=wr.data||[],ready=allWorks.filter(w=>w.settings?.template_ready===true),files=fr.data||[],approved=(er.data||[]).filter(e=>e.status==="approved"),pending=(er.data||[]).filter(e=>e.status==="pending"),exams=xr.data||[];const joinCodeR=await c.rpc("admin_subject_join_code",{p_subject_id:sid,p_new_code:null});const joinCode=joinCodeR.data?.join_code||"------";
  const renderGroup=(mode,label)=>{const list=ready.filter(w=>w.mode===mode).sort((a,b)=>wsSeq(a)-wsSeq(b));return `<section class="v14-ws-section"><div class="v14-section-head compact"><div><h2>${label}</h2><p>${list.length} ใบ • ใบงานสำเร็จรูปของห้องนี้ ใช้เลือกและกำหนดปล่อยงานได้ทันที</p></div><button class="btn sm" data-v14-select-mode="${mode}">เลือกทั้งหมด</button></div><div class="v14-bundle-list">${list.map(w=>{const fs=files.filter(f=>f.worksheet_id===w.id||(!f.worksheet_id&&Number(f.sequence_no||0)===wsSeq(w)));return `<article class="v14-bundle" style="--course:${esc(s.color_hex||"#22d3ee")}"><label class="v14-select"><input type="checkbox" data-v14-wselect value="${w.id}"><span>${esc(wsCode(w))}</span></label><div class="v14-bundle-main"><div class="v14-badges"><span>${mode==="paper"?"ใบงานกระดาษ":"ใบงานดิจิทัล"}</span><span class="${w.status}">${w.status==="published"?"เผยแพร่แล้ว":"พร้อมกำหนดใช้"}</span></div><h3>${esc(w.title)}</h3><div class="v14-goal">🎯 ${esc(w.settings?.learning_goal||"เป้าหมายตามหน่วยการเรียน")}</div><div class="v14-meta">${w.open_at?`เปิด ${fmt(w.open_at)}`:"ยังไม่กำหนดเวลา"}${w.due_at?` • ส่ง ${fmt(w.due_at)}`:""}</div><div class="v14-actions"><button class="btn sm" data-v14-preview="${w.id}">👁 ดูตัวอย่างใบงาน</button><button class="btn sm" data-v14-upload="${w.id}" data-subject="${sid}" data-seq="${wsSeq(w)}">＋ เพิ่มสไลด์/สื่อ</button></div></div><div class="v14-media-pane"><b>📊 สไลด์ / สื่อประกอบ</b>${fs.length?fs.map(f=>`<button class="v14-file" data-v14-file="${esc(f.storage_path)}">${esc(f.original_name)}</button>`).join(""):`<div class="v14-media-empty">ยังไม่มีสื่อที่จับคู่</div>`}</div></article>`}).join("")||`<div class="v14-empty">ยังไม่มีใบงานสำเร็จรูปประเภทนี้</div>`}</div></section>`};
  const roster=approved.sort((a,b)=>String(a.profiles?.student_code||"").localeCompare(String(b.profiles?.student_code||""))).map((e,i)=>`<tr><td>${i+1}</td><td><b>${esc(e.profiles?.student_code||"-")}</b></td><td>${esc(e.profiles?.full_name||"-")}</td><td>${esc(`${e.profiles?.grade_level||""}${e.profiles?.room_label||""}`||e.profiles?.class_name||"-")}</td><td><span class="v14-status approved">สมาชิกห้อง</span></td></tr>`).join("");
  const published=allWorks.filter(w=>w.status==="published").length;
  content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับห้องเรียนรายวิชา</button>
  <div class="v14-course-hero v15-room-hero" style="--course:${esc(s.color_hex||"#22d3ee")}"><div><span class="v14-kicker">🏫 ห้องเรียน • ${esc(s.code)}</span><h1>${esc(s.name)}</h1><p>${esc(s.description||"")}</p><small>ชื่อห้องเรียนใช้ข้อมูลเดียวกับรายวิชา จึงไม่เกิดชื่อซ้ำหรือชื่อไม่ตรงกัน</small></div><div class="v15-room-hero-stats"><b>${approved.length}</b><span>นักศึกษาในห้อง</span><small>${pending.length} คำขอรออนุมัติ</small></div></div>
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
  <div class="card v14-releasebar" id="v15-room-ready"><div><b>📚 ใบงานสำเร็จรูปประจำห้องเรียน</b><div class="muted">เลือกใบงานจากห้องนี้ได้หลายใบ แล้วกำหนดวัน/เวลาเพื่อแจกให้นักศึกษาสมาชิกห้อง ${approved.length} คนพร้อมกัน</div></div><button class="btn primary" id="v14-bulk-release">🚀 ปล่อยใบงานที่เลือก</button></div>
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
async function releaseSelected(sid){
  const ids=$$('[data-v14-wselect]:checked').map(x=>x.value);if(!ids.length){toast("กรุณาติ๊กเลือกใบงานอย่างน้อย 1 ใบ",true);return}
  const start=new Date(nowMs()),due=new Date(nowMs()+7*86400000);
  overlay(`<div class="v14-modal-head"><div><span class="v14-kicker">BULK RELEASE</span><h2>ปล่อยใบงาน ${ids.length} ใบพร้อมกัน</h2><p>ผู้เรียนที่ได้รับอนุมัติในรายวิชาจะได้รับทุกใบที่เลือก</p></div><button class="btn" data-v14-close>✕</button></div><form id="v14-release-form"><div class="v14-form-grid"><label>วัน/เวลาเปิด<input class="input" name="open" type="datetime-local" value="${localInputValue(start)}" required></label><label>กำหนดส่ง<input class="input" name="due" type="datetime-local" value="${localInputValue(due)}" required></label><label>จำนวนครั้ง<input class="input" name="attempts" type="number" min="1" max="20" value="1" required></label></div><div class="v14-checks"><label><input name="late" type="checkbox"> อนุญาตส่งช้า</label><label><input name="resubmit" type="checkbox"> อนุญาตส่งซ้ำ</label></div><div class="alert">เลือกไว้ <b>${ids.length}</b> ใบ • การปล่อยงานจะบันทึก Audit Log</div><div class="row end"><button type="button" class="btn" data-v14-close>ยกเลิก</button><button class="btn primary">ยืนยันปล่อยงาน</button></div></form>`);
  $("#v14-release-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),open=new Date(String(f.get("open"))),dueAt=new Date(String(f.get("due")));if(!(dueAt>open)){toast("กำหนดส่งต้องอยู่หลังเวลาเปิด",true);return}const btn=e.submitter;btn.disabled=true;btn.textContent="กำลังปล่อยงาน...";const {data,error}=await client().rpc("publish_subject_worksheets",{p_subject_id:sid,p_worksheet_ids:ids,p_open_at:open.toISOString(),p_due_at:dueAt.toISOString(),p_allow_late:f.get("late")==="on",p_allow_resubmit:f.get("resubmit")==="on",p_max_attempts:Number(f.get("attempts")||1)});if(error){btn.disabled=false;btn.textContent="ยืนยันปล่อยงาน";toast(errorText(error),true);return}closeOverlay();toast(`ปล่อย ${data?.worksheet_count||ids.length} ใบ ให้ผู้เรียน ${data?.approved_learners??0} คนแล้ว`);renderAdminSubject(sid)};
}
async function uploadSubjectFile(subjectId,worksheetId,seq){
  const input=document.createElement("input");input.type="file";input.accept=".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.mp4";input.multiple=true;
  input.onchange=async()=>{for(const file of [...input.files]){if(file.size>50*1024*1024){toast(`${file.name} เกิน 50MB`,true);continue}const path=`${subjectId}/${worksheetId}/${Date.now()}-${safeName(file.name)}`;const c=client();const up=await c.storage.from("subject-files").upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error){toast(errorText(up.error),true);continue}const ins=await c.from("subject_files").insert({subject_id:subjectId,worksheet_id:worksheetId,resource_kind:"slide",sequence_no:Number(seq)||null,storage_path:path,original_name:file.name,mime_type:file.type||null,size_bytes:file.size,created_by:uid()});if(ins.error){await c.storage.from("subject-files").remove([path]);toast(errorText(ins.error),true);continue}toast(`อัปโหลด ${file.name} แล้ว`)}renderAdminSubject(subjectId)};input.click();
}
async function openSubjectFile(path){const {data,error}=await client().storage.from("subject-files").createSignedUrl(path,600);if(error||!data?.signedUrl){toast(errorText(error||"เปิดไฟล์ไม่ได้"),true);return}window.open(data.signedUrl,"_blank","noopener")}

// ---------------------------------------------------------------------------
// Student courses / work status
// ---------------------------------------------------------------------------
async function renderStudentCourses(){
  setTitle("ห้องเรียนของฉัน");busy("กำลังโหลดห้องเรียนรายวิชาที่อนุมัติ...");const courses=await approvedCourses();
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">MY SUBJECT ROOMS</span><h1>ห้องเรียนของฉัน</h1><p>แต่ละรายวิชาเป็นห้องเรียนของคุณ ภายในมีใบงาน สไลด์ สื่อ และทางเข้าสู่ระบบสอบของวิชานั้น</p></div><button class="btn primary" data-v14-route="enroll">＋ ลงทะเบียนรายวิชา</button></div><div class="v14-course-grid">${courses.map(s=>`<button class="v14-course-card" data-v14-open-course="${s.id}" style="--course:${esc(s.color_hex||"#22d3ee")}"><span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><small>สมาชิกห้องเรียน • เปิดดูใบงาน/สื่อ/ข้อสอบ</small></button>`).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่ได้รับอนุมัติ</div>`}</div></section>`;
}
async function renderStudentCourse(sid){
  state.subjectId=sid;state.route="courses";heartbeat();setTitle("ห้องเรียนของฉัน");busy("กำลังเปิดห้องเรียนรายวิชา...");const c=client();
  const [sr,wr,fr,subr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,description").eq("id",sid).single(),
    c.from("worksheets").select("id,subject_id,title,reference_code,mode,status,open_at,due_at,settings,subjects(id,code,name,color_hex)").eq("subject_id",sid).eq("status","published").order("open_at"),
    c.from("subject_files").select("id,worksheet_id,sequence_no,resource_kind,original_name,storage_path").eq("subject_id",sid).order("created_at"),
    c.from("submissions").select("worksheet_id,status,submitted_at,is_late,last_saved_at").eq("user_id",uid())
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(fr.error&&!String(fr.error.message).includes("permission"))throw fr.error;
  const s=sr.data,sm=new Map((subr.data||[]).map(x=>[x.worksheet_id,x])),works=wr.data||[],files=fr.data||[];
  const group=(mode,label)=>{const list=works.filter(w=>w.mode===mode);return `<section><div class="v14-section-head compact"><div><h2>${label}</h2><p>${list.length} งานที่ปล่อยแล้ว</p></div></div><div class="v14-work-list">${list.map(w=>{const st=workStatus(w,sm.get(w.id)),fs=files.filter(f=>f.worksheet_id===w.id||(!f.worksheet_id&&Number(f.sequence_no||0)===wsSeq(w)));return `<article class="v14-learning-set" style="--course:${esc(s.color_hex||"#22d3ee")}"><div class="v14-learning-content"><span class="v14-codebox">${esc(wsCode(w))}</span><div><h3>${esc(w.title)}</h3><div class="v14-goal">🎯 ${esc(w.settings?.learning_goal||"เป้าหมายตามหน่วยการเรียน")}</div><div class="v14-meta">เปิด ${fmt(w.open_at)} • ส่ง ${fmt(w.due_at)}</div>${!["sent","late","graded"].includes(st.key)&&w.due_at?`<b class="v14-countdown" data-v14-countdown="${esc(w.due_at)}"></b>`:""}</div></div><div class="v14-learning-media"><b>📊 สไลด์ / สื่อ</b>${fs.length?fs.map(f=>`<button class="v14-file" data-v14-file="${esc(f.storage_path)}">${esc(f.original_name)}</button>`).join(""):`<small>ยังไม่มีสื่อประกอบชุดนี้</small>`}</div><div class="v14-learning-actions"><span class="v14-status ${st.cls}">${esc(st.label)}</span><button class="btn primary" data-v14-open-work="${w.id}">${mode==="digital"?"เปิดทำใบงาน":"ดูใบงาน"}</button></div></article>`}).join("")||`<div class="v14-empty">ยังไม่มีใบงานประเภทนี้ที่ปล่อยให้คุณ</div>`}</div></section>`};
  content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับห้องเรียนของฉัน</button><div class="v14-course-hero v15-room-hero" style="--course:${esc(s.color_hex||"#22d3ee")}"><div><span class="v14-kicker">🏫 ห้องเรียน • ${esc(s.code)}</span><h1>${esc(s.name)}</h1><p>${esc(s.description||"")}</p></div><div><button class="btn primary" data-v15-room-exam="${sid}">🧪 ข้อสอบรายวิชานี้</button></div></div>${group("paper","🖨️ ใบงานสำหรับพิมพ์")}${group("digital","💻 ใบงานอิเล็กทรอนิกส์")}</section>`;startCountdowns();subscribeSubjectRoom(sid,"student").catch(()=>{});
}
async function renderWorkStatus(){
  setTitle("ตารางสถานะงาน");busy("กำลังตรวจงานทั้งหมด...");const rows=await studentWorkRows();const counts={sent:0,late:0,graded:0,draft:0,pending:0,upcoming:0,overdue:0};rows.forEach(x=>counts[x.status.key]++);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">WORK STATUS</span><h1>ตารางสถานะงาน</h1><p>เห็นทันทีว่างานไหนส่งแล้ว งานไหนยังค้าง และเหลือเวลาเท่าไร</p></div></div><div class="v14-kpis four"><div><span>ทั้งหมด</span><b>${rows.length}</b></div><div><span>ส่งแล้ว/ตรวจแล้ว</span><b>${counts.sent+counts.late+counts.graded}</b></div><div><span>กำลังทำ/ยังไม่ส่ง</span><b>${counts.draft+counts.pending}</b></div><div><span>เกินกำหนด</span><b>${counts.overdue}</b></div></div>
  <div class="card v14-filter"><input id="v14-work-q" class="input" placeholder="ค้นหาวิชา / ใบงาน"><select id="v14-work-type" class="input"><option value="">ทุกประเภท</option><option value="paper">ใบงานกระดาษ</option><option value="digital">ใบงานอิเล็กทรอนิกส์</option></select><select id="v14-work-status" class="input"><option value="">ทุกสถานะ</option><option value="pending">ยังไม่ส่ง</option><option value="draft">บันทึกร่าง</option><option value="sent">ส่งแล้ว</option><option value="late">ส่งช้า</option><option value="graded">ตรวจแล้ว</option><option value="overdue">เกินกำหนด</option><option value="upcoming">ยังไม่เปิด</option></select></div><div id="v14-work-list" class="v14-work-list"></div></section>`;
  const draw=()=>{const q=$("#v14-work-q").value.trim().toLowerCase(),mode=$("#v14-work-type").value,st=$("#v14-work-status").value;const f=rows.filter(x=>(!q||`${x.w.title} ${x.w.subjects?.code} ${x.w.subjects?.name}`.toLowerCase().includes(q))&&(!mode||x.w.mode===mode)&&(!st||x.status.key===st));$("#v14-work-list").innerHTML=f.map(workCard).join("")||`<div class="v14-empty">ไม่พบงานตามตัวกรอง</div>`;startCountdowns()};draw();$("#v14-work-q").oninput=draw;$("#v14-work-type").onchange=draw;$("#v14-work-status").onchange=draw;
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
    c.from("worksheet_assignments").select("worksheet_id,worksheets(id,title,mode,subject_id,subjects(code,name))").eq("user_id",id),
    c.from("submissions").select("id,status,submitted_at,is_late,worksheet_id,worksheets(title,subjects(code,name))").eq("user_id",id).order("updated_at",{ascending:false}),
    c.from("attendance_records").select("status,scanned_at,attendance_sessions(session_date,subject_id,subjects(code,name))").eq("user_id",id).order("created_at",{ascending:false})
  ]);
  if(pr.error){toast(errorText(pr.error),true);return}
  const p=pr.data,assignments=assignR.data||[],subs=subR.data||[],atts=attR.data||[];
  const assigned=[...new Set(assignments.map(x=>x.worksheet_id).filter(Boolean))],completedSet=new Set(subs.filter(x=>["submitted","confirmed","graded"].includes(x.status)).map(x=>x.worksheet_id)),completed=assigned.filter(x=>completedSet.has(x)).length;
  const workRate=assigned.length?Math.round(completed*1000/assigned.length)/10:0;
  const counts={present:0,late:0,absent:0,excused:0};atts.forEach(x=>{if(counts[x.status]!==undefined)counts[x.status]++});
  const attDen=counts.present+counts.late+counts.absent,attRate=attDen?Math.round((counts.present+counts.late)*1000/attDen)/10:0;
  const latestSubs=subs.slice(0,20),latestAtt=atts.slice(0,20);
  const subjectWork={};
  assignments.forEach(a=>{const s=a.worksheets?.subjects,code=s?.code||"-";if(!subjectWork[code])subjectWork[code]={name:s?.name||"",assigned:new Set(),done:new Set()};subjectWork[code].assigned.add(a.worksheet_id)});
  subs.forEach(s=>{const code=s.worksheets?.subjects?.code||"-";if(subjectWork[code]&&["submitted","confirmed","graded"].includes(s.status))subjectWork[code].done.add(s.worksheet_id)});
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
  const {data,error}=await client().rpc("scan_attendance_qr",{p_classroom_id:classId,p_subject_id:subjectId,p_token:token,p_late_after_minutes:15});state.scanBusy=false;
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
  if(box)box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>นักศึกษา</th><th>ครั้งเรียน</th><th>มา</th><th>สาย</th><th>ขาด</th><th>ลา</th><th>% เข้าเรียน</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${x.total_sessions}</td><td>${x.present_count}</td><td>${x.late_count}</td><td>${x.absent_count}</td><td>${x.excused_count}</td><td><b>${x.attendance_percent??0}%</b></td></tr>`).join("")||`<tr><td colspan="8" class="empty">ยังไม่มีรอบเช็คชื่อที่สรุปแล้ว</td></tr>`}</tbody></table></div>`;
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
    total:scoreText(x.total_score)
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
  const colgroup=`<colgroup><col style="width:6%"><col style="width:14%"><col style="width:26%"><col style="width:18%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"></colgroup>`;
  return `${style}<table class="report v162-grade-report-table">${colgroup}
    <tr class="title"><td colspan="9">ภาคเรียนที่ ${excelEsc(sem)} ปีการศึกษา ${excelEsc(year)}</td></tr>
    <tr class="subtitle"><td colspan="9">รหัสวิชา : ${excelEsc(subject.code||"")} : ${excelEsc(subject.name||"")}</td></tr>
    <tr class="space"><td colspan="9"></td></tr>
    <tr><th>ลำดับ</th><th>รหัสนักเรียนนักศึกษา</th><th>ชื่อ-สกุล</th><th>กลุ่มเรียน</th><th>จิตพิสัย(${scoreText(cfg.behavior_points||20)})</th><th>ภาระงาน(${scoreText(cfg.work_points||40)})</th><th>กลางภาค(${scoreText(cfg.midterm_points||20)})</th><th>ปลายภาค(${scoreText(cfg.final_points||20)})</th><th>รวม(100)</th></tr>
    ${data.map(x=>`<tr><td class="c">${x.no}</td><td class="c code">${excelEsc(x.code)}</td><td>${excelEsc(x.name)}</td><td class="group">${excelEsc(x.group)}</td><td class="c">${x.behavior}</td><td class="c">${x.work}</td><td class="c">${x.mid}</td><td class="c">${x.final}</td><td class="c"><b>${x.total}</b></td></tr>`).join("")}
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
  const wr=await c.from("worksheets").select("id,title,reference_code,mode,status,due_at").eq("subject_id",sid).order("reference_code",{ascending:true});
  if(wr.error)throw wr.error;
  const works=wr.data||[];
  if(!works.length)return {works:[],assignments:[],submissions:[]};
  const ids=works.map(x=>x.id);
  const [ar,sr]=await Promise.all([
    c.from("worksheet_assignments").select("worksheet_id,user_id,assigned_at").in("worksheet_id",ids),
    c.from("submissions").select("worksheet_id,user_id,status,is_late,submitted_at,confirmed_at").in("worksheet_id",ids)
  ]);
  if(ar.error)throw ar.error;if(sr.error)throw sr.error;
  const assignedIds=new Set((ar.data||[]).map(x=>x.worksheet_id));
  return {works:works.filter(x=>assignedIds.has(x.id)),assignments:ar.data||[],submissions:sr.data||[]};
}
function renderWorkDetailTable(rows,detail){
  const works=detail.works||[],assign=detail.assignments||[],subs=detail.submissions||[];
  if(!works.length)return `<div class="v14-empty">ยังไม่มีใบงานที่มอบหมายจริงในรายวิชานี้</div>`;
  const assigned=new Set(assign.map(x=>`${x.user_id}:${x.worksheet_id}`));
  const subMap=new Map(subs.map(x=>[`${x.user_id}:${x.worksheet_id}`,x]));
  const head=works.map(w=>`<th title="${esc(w.title||"")}"><span class="v162-work-code">${esc(w.reference_code||w.title||"งาน")}</span><small>${w.mode==="paper"?"Paper":"Digital"}</small></th>`).join("");
  const body=rows.map((x,i)=>`<tr><td class="sticky c">${i+1}</td><td class="sticky2"><b>${esc(x.student_code||"")}</b><small>${esc(x.full_name||"")}</small></td>${works.map(w=>{
    const key=`${x.user_id}:${w.id}`;
    if(!assigned.has(key))return `<td class="v162-work-na">—</td>`;
    const st=detailStatus(subMap.get(key));
    return `<td><span class="v162-work-status ${st.cls}">${st.label}</span></td>`;
  }).join("")}</tr>`).join("");
  return `<div class="v162-detail-note">ส่วนนี้แสดงเฉพาะในหน้า Admin และ <b>ไม่ถูกนำไปพิมพ์หรือดาวน์โหลดในรายงานสรุป</b></div>
  <div class="v162-work-matrix"><table><thead><tr><th class="sticky">#</th><th class="sticky2">นักศึกษา</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
async function renderSubjectGradebook(sid){
  clearRoomChannel();state.subjectId=sid;state.route="courses";setTitle("สรุปคะแนนรายวิชา");busy("กำลังคำนวณคะแนนจากข้อมูลจริง...");
  const c=client();
  const [sr,gr,cr,er,detail]=await Promise.all([
    c.from("subjects").select("id,code,name,academic_year,semester").eq("id",sid).single(),
    c.rpc("admin_subject_gradebook",{p_subject_id:sid}),
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
    <td><b>${x.completed_work_count}/${x.assigned_work_count}</b><small>${Number(x.work_score||0).toFixed(2)}/${Number(x.work_points||40)}</small></td>
    <td><button class="v16-score-edit" data-v16-behavior="${x.user_id}" data-score="${Number(x.behavior_score||0)}">${Number(x.behavior_score||0).toFixed(2)}/${Number(x.behavior_points||20)}</button></td>
    <td>${Number(x.midterm_score||0).toFixed(2)}/${Number(x.midterm_points||20)}</td>
    <td>${Number(x.final_score||0).toFixed(2)}/${Number(x.final_points||20)}</td>
    <td><strong>${Number(x.total_score||0).toFixed(2)}</strong></td>
  </tr>`).join("");
  content().innerHTML=`<section class="v14-page v16-gradebook-page">
    <div class="v16-no-print"><button class="btn ghost" data-v14-admin-course="${sid}">← กลับห้องเรียน</button></div>
    <div class="v16-print-head v16-no-print"><img src="./icons/icon-192.png" alt=""><div><span>วิทยาลัยเทคนิคนางรอง</span><h1>สรุปผลคะแนนรายวิชา</h1><p>${esc(subject.code)} ${esc(subject.name)} • ปีการศึกษา ${esc(subject.academic_year||"-")} ภาคเรียน ${esc(subject.semester||"-")}</p></div></div>
    <div class="v16-summary-kpis v16-no-print"><div><span>นักศึกษา</span><b>${rows.length}</b></div><div><span>ส่งงานครบ</span><b>${fullWork}</b></div><div><span>คะแนนเฉลี่ย</span><b>${avg.toFixed(2)}</b></div><div><span>คะแนนเต็ม</span><b>100</b></div></div>
    <div class="v16-grade-rules v16-no-print"><b>เกณฑ์คะแนน</b><span>งาน ${cfg.work_points} • จิตพิสัย ${cfg.behavior_points} • สอบกลางภาค ${cfg.midterm_points} • สอบปลายภาค ${cfg.final_points}</span><small>คะแนนงานคิดจากจำนวนงานที่ครูมอบหมายจริง หากสั่ง 13 งานและส่งครบ 13 งาน = คะแนนงานเต็ม ${cfg.work_points}</small></div>
    <div class="v16-grade-actions v16-no-print">
      <button class="btn" id="v16-grade-settings">⚙️ ตั้งค่าองค์ประกอบคะแนน</button>
      <button class="btn" id="v162-grade-excel">⬇️ ดาวน์โหลด Excel</button>
      <button class="btn primary" id="v16-grade-print">🖨️ พิมพ์สรุปคะแนน</button>
      <span class="v16-live-pill"><i></i> Real-time</span>
    </div>

    <div class="table-wrap v16-grade-table v16-no-print"><table><thead><tr><th>#</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ห้อง</th><th>งาน ${cfg.work_points}</th><th>จิตพิสัย ${cfg.behavior_points}</th><th>กลางภาค ${cfg.midterm_points}</th><th>ปลายภาค ${cfg.final_points}</th><th>รวม 100</th></tr></thead><tbody>${body||`<tr><td colspan="9" class="empty">ยังไม่มีนักศึกษาที่อนุมัติในห้องเรียนนี้</td></tr>`}</tbody></table></div>

    <section class="v162-web-work-details v16-no-print">
      <div class="v162-detail-head"><div><span>ADMIN ONLY</span><h2>รายละเอียดงานที่นำมาคิดคะแนน</h2><p>ดูว่านักศึกษาแต่ละคนได้รับงานใด ส่งแล้ว/ส่งช้า/ยังไม่ส่งอย่างไร รายละเอียดนี้ไม่แสดงในรายงานที่พิมพ์หรือดาวน์โหลด</p></div><div class="v162-detail-kpi">งานที่ถูกมอบหมาย <b>${detail.works.length}</b> รายการ</div></div>
      ${renderWorkDetailTable(rows,detail)}
    </section>

    <div class="v162-print-only v162-grade-print-sheet">${gradeSummaryTableHtml(subject,rows,cfg,false)}</div>
  </section>`;
  $("#v16-grade-print").onclick=()=>window.print();
  $("#v162-grade-excel").onclick=()=>exportGradeSummaryExcel(subject,rows,cfg);
  $("#v16-grade-settings").onclick=()=>gradeSettingsDialog(sid,cfg,exams);
  $$("[data-v16-behavior]").forEach(b=>b.onclick=async()=>{
    const max=Number(cfg.behavior_points||20);
    const val=prompt(`คะแนนจิตพิสัย 0–${max}`,String(b.dataset.score||max));if(val===null)return;
    const score=Number(val);if(!Number.isFinite(score)||score<0||score>max){toast(`คะแนนต้องอยู่ระหว่าง 0–${max}`,true);return}
    const note=prompt("หมายเหตุ (ไม่บังคับ)","")||null;
    const r=await c.rpc("admin_set_behavior_score",{p_subject_id:sid,p_user_id:b.dataset.v16Behavior,p_score:score,p_note:note});
    if(r.error){toast(errorText(r.error),true);return}toast("บันทึกคะแนนจิตพิสัยแล้ว");renderSubjectGradebook(sid);
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
  overlay(`<div class="v14-modal-head"><div><h2>ตั้งค่าองค์ประกอบคะแนน</h2><p>ค่าแนะนำและค่าเริ่มต้นคือ 40 / 20 / 20 / 20 รวม 100 คะแนน</p></div><button class="btn" data-v14-close>✕</button></div>
  <form id="v16-grade-settings-form" class="v16-form-stack">
    <div class="v14-form-grid">
      <label>งาน<input class="input" name="work" type="number" min="0" max="100" step=".01" value="${cfg.work_points??40}"></label>
      <label>จิตพิสัย<input class="input" name="behavior" type="number" min="0" max="100" step=".01" value="${cfg.behavior_points??20}"></label>
      <label>กลางภาค<input class="input" name="midterm" type="number" min="0" max="100" step=".01" value="${cfg.midterm_points??20}"></label>
      <label>ปลายภาค<input class="input" name="final" type="number" min="0" max="100" step=".01" value="${cfg.final_points??20}"></label>
    </div>
    <label>คะแนนจิตพิสัยเริ่มต้น<input class="input" name="defaultBehavior" type="number" min="0" max="20" step=".01" value="${cfg.default_behavior_score??20}"></label>
    <label>ชุดสอบกลางภาค<select class="input" name="midExam"><option value="">เลือกอัตโนมัติจากชุดล่าสุด</option>${mids.map(x=>`<option value="${x.id}" ${x.id===cfg.midterm_exam_id?"selected":""}>${esc(x.title)}</option>`).join("")}</select></label>
    <label>ชุดสอบปลายภาค<select class="input" name="finalExam"><option value="">เลือกอัตโนมัติจากชุดล่าสุด</option>${finals.map(x=>`<option value="${x.id}" ${x.id===cfg.final_exam_id?"selected":""}>${esc(x.title)}</option>`).join("")}</select></label>
    <div class="row end"><button class="btn primary">บันทึก</button></div>
  </form>`);
  $("#v16-grade-settings-form").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),vals=["work","behavior","midterm","final"].map(k=>Number(f.get(k)));if(Math.abs(vals.reduce((a,b)=>a+b,0)-100)>.001){toast("องค์ประกอบคะแนนต้องรวม 100",true);return}
    const r=await client().rpc("admin_set_subject_grade_settings",{p_subject_id:sid,p_work_points:vals[0],p_behavior_points:vals[1],p_midterm_points:vals[2],p_final_points:vals[3],p_default_behavior_score:Number(f.get("defaultBehavior")||20),p_midterm_exam_id:String(f.get("midExam")||"")||null,p_final_exam_id:String(f.get("finalExam")||"")||null});
    if(r.error){toast(errorText(r.error),true);return}closeOverlay();toast("บันทึกเกณฑ์คะแนนแล้ว");renderSubjectGradebook(sid);
  };
}

// ---------------------------------------------------------------------------
// V16 Full-sheet paper scan / barcode verification / evidence copy
// ---------------------------------------------------------------------------
async function renderPaperScanCenter(sid){
  clearRoomChannel();state.subjectId=sid;state.route="courses";setTitle("สแกนสำเนาใบงาน");busy("กำลังเปิดศูนย์สแกนเอกสาร...");
  const c=client(),[sr,rr]=await Promise.all([c.from("subjects").select("id,code,name").eq("id",sid).single(),c.rpc("admin_subject_paper_scans",{p_subject_id:sid})]);if(sr.error)throw sr.error;
  const subject=sr.data,recent=rr.data||[];
  content().innerHTML=`<section class="v14-page v16-scan-page">
    <button class="btn ghost" data-v14-admin-course="${sid}">← กลับห้องเรียน</button>
    <div class="v14-section-head"><div><span class="v14-kicker">FULL-SHEET EVIDENCE SCAN</span><h1>📄 สแกนใบงานทั้งแผ่น</h1><p>${esc(subject.code)} ${esc(subject.name)} • เก็บภาพสำเนาทั้งหน้า แล้วตรวจ Barcode/QR กับข้อมูล Server</p></div><span class="v16-live-pill"><i></i> Real-time</span></div>
    <div class="v16-scan-grid">
      <div class="card v16-camera-card"><div class="v16-paper-frame"><video id="v16-paper-video" playsinline muted></video><div class="v16-paper-guide"><span>วางใบงานให้เห็นครบทั้ง 4 มุม</span></div></div><canvas id="v16-paper-canvas" hidden></canvas>
        <div class="row wrap"><button class="btn primary" id="v16-camera-start">เปิดกล้อง</button><button class="btn" id="v16-camera-stop">หยุดกล้อง</button><button class="btn green" id="v16-capture" disabled>📸 ถ่ายสำเนาทั้งแผ่น</button></div>
        <div class="v16-scan-help">ระบบพยายามอ่าน Barcode/QR จากภาพกล้องอัตโนมัติ หากอุปกรณ์ไม่รองรับ สามารถกรอกรหัสที่ช่องด้านขวาได้</div>
      </div>
      <div class="card"><h2>ตรวจรหัสใบงาน</h2><form id="v16-token-form"><label class="field">Barcode / QR Token<input id="v16-token" class="input" name="token" autocomplete="off" required placeholder="สแกนหรือกรอกรหัส"></label><button class="btn" type="submit">ตรวจข้อมูลจาก Server</button></form><div id="v16-token-info" class="v16-token-info"><div class="v14-empty">ยังไม่ได้อ่านรหัส</div></div></div>
    </div>
    <div class="v14-section-head compact"><div><h2>สำเนาที่สแกนล่าสุด</h2><p>ภาพต้นฉบับเก็บใน Private Storage และ Admin เปิดดูได้จากรายการนี้</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>เวลา</th><th>นักศึกษา</th><th>ใบงาน</th><th>สถานะ</th><th>สำเนา</th></tr></thead><tbody>${recent.map(x=>`<tr><td>${fmt(x.scanned_at)}</td><td><b>${esc(x.student_code||"")}</b><div>${esc(x.full_name||"")}</div></td><td>${esc(x.reference_code||"")} ${esc(x.worksheet_title||"")}</td><td><span class="v14-status ${x.scan_status==="accepted"?"approved":"pending"}">${esc(x.scan_status)}</span></td><td><button class="btn sm" data-v16-view-scan="${esc(x.storage_path)}">เปิดภาพ</button></td></tr>`).join("")||`<tr><td colspan="5" class="empty">ยังไม่มีสำเนาที่สแกน</td></tr>`}</tbody></table></div>
  </section>`;
  let stream=null,current=null,lastCode="",detecting=false;
  const video=$("#v16-paper-video"),tokenInput=$("#v16-token"),capture=$("#v16-capture");
  const stop=()=>{detecting=false;if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}video.srcObject=null;capture.disabled=true};
  const lookup=async token=>{
    const clean=String(token||"").trim();if(!clean)return null;
    const tr=await c.from("paper_tokens").select("id,worksheet_id,user_id,token,used_at,expires_at,revoked_at,code_kind,last_verified_at").eq("token",clean).maybeSingle();
    if(tr.error||!tr.data){current=null;$("#v16-token-info").innerHTML=`<div class="alert error">ไม่พบ Barcode/QR นี้ในระบบ</div>`;capture.disabled=true;return null}
    const t=tr.data,[wr,pr]=await Promise.all([c.from("worksheets").select("id,title,reference_code,subject_id,due_at,status").eq("id",t.worksheet_id).single(),c.from("profiles").select("id,full_name,student_code,class_name").eq("id",t.user_id).single()]);
    if(wr.error||wr.data.subject_id!==sid){current=null;$("#v16-token-info").innerHTML=`<div class="alert error">รหัสนี้ไม่ใช่ใบงานของห้องเรียนรายวิชานี้</div>`;capture.disabled=true;return null}
    const now=nowMs(),expired=!!t.expires_at&&now>new Date(t.expires_at).getTime(),revoked=!!t.revoked_at;
    current={token:t,worksheet:wr.data,profile:pr.data,expired,revoked};
    $("#v16-token-info").innerHTML=`<div class="v16-token-result ${revoked||expired?"warn":"ok"}"><b>${revoked?"รหัสถูกยกเลิก":expired?"รหัสหมดอายุ":"รหัสใช้งานได้"}</b><span>${esc(pr.data?.student_code||"")} • ${esc(pr.data?.full_name||"")}</span><span>${esc(wr.data.reference_code||"")} • ${esc(wr.data.title)}</span><small>หมดอายุ ${fmt(t.expires_at)} • ใช้งานก่อนหน้า ${fmt(t.used_at)}</small></div>`;
    capture.disabled=!stream||revoked;return current;
  };
  $("#v16-token-form").onsubmit=e=>{e.preventDefault();lookup(tokenInput.value)};
  $("#v16-camera-start").onclick=async()=>{
    if(!navigator.mediaDevices?.getUserMedia){toast("อุปกรณ์นี้ไม่รองรับกล้องผ่าน Browser",true);return}
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});video.srcObject=stream;await video.play();capture.disabled=!current||current.revoked;detecting=true;
      if("BarcodeDetector" in window){const detector=new BarcodeDetector({formats:["qr_code","code_128","code_39","ean_13","ean_8"]});const loop=async()=>{if(!detecting)return;try{const codes=await detector.detect(video);const raw=codes?.[0]?.rawValue||"";if(raw&&raw!==lastCode){lastCode=raw;let parsed=raw;if(raw.includes("token=")){try{parsed=new URL(raw,location.href).searchParams.get("token")||raw}catch{const m=raw.match(/[?&]token=([^&]+)/);parsed=m?decodeURIComponent(m[1]):raw}}tokenInput.value=parsed;await lookup(tokenInput.value)}}catch{}requestAnimationFrame(loop)};loop()}
    }catch(e){toast("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตสิทธิ์กล้อง",true)}
  };
  $("#v16-camera-stop").onclick=stop;
  capture.onclick=async()=>{
    if(!stream||!current)return;if(current.expired&&!ask("Barcode/QR หมดอายุแล้ว ต้องการรับเอกสารและบันทึกเป็น “หมดอายุแต่รับไว้” หรือไม่?"))return;
    capture.disabled=true;capture.textContent="กำลังบันทึกสำเนา...";
    const canvas=$("#v16-paper-canvas");canvas.width=video.videoWidth||1920;canvas.height=video.videoHeight||1080;canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height);
    const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.9));if(!blob){toast("ถ่ายภาพไม่สำเร็จ",true);capture.disabled=false;return}
    const path=`${current.token.user_id}/paper-scans/${current.worksheet.id}/${Date.now()}.jpg`;
    const up=await c.storage.from("submissions").upload(path,blob,{contentType:"image/jpeg",upsert:false});
    if(up.error){toast(errorText(up.error),true);capture.disabled=false;capture.textContent="📸 ถ่ายสำเนาทั้งแผ่น";return}
    const rr=await c.rpc("admin_record_paper_scan",{p_token:current.token.token,p_storage_path:path,p_original_name:`${current.worksheet.reference_code||current.worksheet.id}.jpg`,p_mime_type:"image/jpeg",p_size_bytes:blob.size,p_barcode_format:current.token.code_kind||"barcode",p_accept_expired:current.expired,p_metadata:{capture:"full_sheet_camera",device:deviceLabel()}});
    if(rr.error){await c.storage.from("submissions").remove([path]);toast(errorText(rr.error),true);capture.disabled=false;capture.textContent="📸 ถ่ายสำเนาทั้งแผ่น";return}
    toast("บันทึกสำเนาทั้งแผ่นและยืนยันใบงานแล้ว");stop();renderPaperScanCenter(sid);
  };
  const rt=await realtimeClient();if(rt){state.roomChannel=rt.channel(`paper-scan-${sid}-${Date.now()}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"paper_scans"},()=>{clearTimeout(state.roomRefreshTimer);state.roomRefreshTimer=setTimeout(()=>{if(state.subjectId===sid&&!stream)renderPaperScanCenter(sid).catch(()=>{})},900)}).subscribe()}
}
async function openPaperScanCopy(path){
  const r=await client().storage.from("submissions").createSignedUrl(path,300);if(r.error){toast(errorText(r.error),true);return}window.open(r.data.signedUrl,"_blank","noopener");
}

// ---------------------------------------------------------------------------
// Delegated interactions (single owner)
// ---------------------------------------------------------------------------
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");if(!t)return;
  if(t.matches("[data-v16-base-route]")){const b=$(`#sidebar .nav [data-route="${t.dataset.v16BaseRoute}"]`);if(b){b.click()}else toast("เมนูนี้ยังโหลดไม่เสร็จ กรุณารีเฟรชหน้า",true);return}
  if(t.matches("[data-v161-notification]")){client().rpc("mark_notification_read",{p_notification_id:t.dataset.v161Notification});return}
  if(t.matches("[data-v15-account]")){await decideAccount(t.dataset.v15Account,t.dataset.accountStatus);return}
  if(t.matches("[data-v165-join-course]")){showJoinCourseDialog(t.dataset.v165JoinCourse,t.dataset.courseCode||"",t.dataset.courseName||"");return}
  if(t.matches("[data-v165-copy-code]")){try{await navigator.clipboard.writeText(t.dataset.v165CopyCode||"");toast("คัดลอกรหัสเข้าห้องเรียนแล้ว")}catch{toast("คัดลอกรหัสไม่สำเร็จ",true)}return}
  if(t.matches("[data-v165-change-code]")){const sid=t.dataset.v165ChangeCode,custom=prompt("ตั้งรหัสใหม่ 4–12 ตัว (A-Z/0-9)\nกด Cancel เพื่อยกเลิก\nเว้นว่างแล้วกด OK เพื่อสุ่มรหัสใหม่","");if(custom===null)return;const r=custom.trim()?await client().rpc("admin_subject_join_code",{p_subject_id:sid,p_new_code:custom.trim()}):await client().rpc("admin_regenerate_subject_join_code",{p_subject_id:sid});if(r.error){toast(errorText(r.error),true);return}toast("เปลี่ยนรหัสเข้าห้องเรียนแล้ว");renderAdminSubject(sid);return}
  if(t.matches("[data-v14-request-course]")){const r=await client().rpc("request_subject_enrollment",{p_subject_id:t.dataset.v14RequestCourse});if(r.error)toast(errorText(r.error),true);else{toast("ส่งคำขอลงทะเบียนแล้ว");renderEnrollSubjects()}return}
  if(t.matches("[data-v14-withdraw-course]")){if(!ask("ยืนยันถอนคำขอ/ถอนรายวิชานี้? ประวัติงานที่ส่งแล้วจะยังคงอยู่"))return;const r=await client().rpc("withdraw_subject_enrollment",{p_subject_id:t.dataset.v14WithdrawCourse});if(r.error)toast(errorText(r.error),true);else{toast("ถอนรายวิชาแล้ว");renderEnrollSubjects()}return}
  if(t.matches("[data-v14-decide-enroll]")){const st=t.dataset.status;if(!ask(st==="approved"?"อนุมัติให้นักศึกษาคนนี้เรียนรายวิชานี้?":"ไม่อนุมัติคำขอนี้?"))return;const r=await client().rpc("decide_subject_enrollment",{p_enrollment_id:t.dataset.v14DecideEnroll,p_status:st,p_note:null});if(r.error)toast(errorText(r.error),true);else{toast(st==="approved"?"อนุมัติแล้ว":"บันทึกไม่อนุมัติแล้ว");renderEnrollmentAdmin()}return}
  if(t.matches("[data-v14-admin-course]")){navigate("courses",t.dataset.v14AdminCourse);return}
  if(t.matches("[data-v14-open-course]")){navigate("courses",t.dataset.v14OpenCourse);return}
  if(t.matches("[data-v14-preview]")){previewWorksheet(t.dataset.v14Preview);return}
  if(t.matches("[data-v14-upload]")){uploadSubjectFile(t.dataset.subject,t.dataset.v14Upload,t.dataset.seq);return}
  if(t.matches("[data-v14-file]")){openSubjectFile(t.dataset.v14File);return}
  if(t.matches("[data-v15-room-exam]")){openSubjectExam(t.dataset.v15RoomExam);return}
  if(t.matches("[data-v16-gradebook]")){renderSubjectGradebook(t.dataset.v16Gradebook);return}
  if(t.matches("[data-v16-paper-scan]")){renderPaperScanCenter(t.dataset.v16PaperScan);return}
  if(t.matches("[data-v16-view-scan]")){openPaperScanCopy(t.dataset.v16ViewScan);return}
  if(t.matches("[data-v15-jump]")){document.querySelector(t.dataset.v15Jump)?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(t.matches("[data-v14-open-work]")){if(window.DOCNR_BASE?.openWorksheet)window.DOCNR_BASE.openWorksheet(t.dataset.v14OpenWork);else toast("ตัวเปิดใบงานหลักยังโหลดไม่เสร็จ กรุณารีเฟรชหน้า",true);return}
  if(t.matches("[data-v14-select-mode]")){const mode=t.dataset.v14SelectMode;const boxes=$$(`[data-v14-wselect]`).filter(x=>x.closest(".v14-ws-section")?.querySelector(`[data-v14-select-mode="${mode}"]`));const all=boxes.every(x=>x.checked);boxes.forEach(x=>x.checked=!all);t.textContent=all?"เลือกทั้งหมด":"ยกเลิกทั้งหมด";return}
  if(t.id==="v14-bulk-release"){releaseSelected(state.subjectId);return}
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
// Boot
// ---------------------------------------------------------------------------
async function boot(){
  document.documentElement.classList.add("v14-tech");document.documentElement.dataset.docnrVersion="v16.5";
  await syncServerTime();startHeartbeat();scheduleEnsureNav();setTimeout(()=>{ensureNotificationUI();startNotificationRealtime().catch(()=>{})},900);
  setTimeout(async()=>{const p=await getProfile(true);if(!p)return;if(p.role!=="admin"&&(!p.active||p.approval_status!=="approved"))return;await ensureNav();const active=$("#sidebar .nav [data-route].active");if(active?.dataset.route==="dashboard"||!active)navigate("dashboard")},700);
}

window.DOCNR_V16_5=Object.freeze({navigate,version:V15_VERSION});
window.addEventListener("pagehide",()=>{stopScanner();clearPresenceChannel();clearRoomChannel();clearInterval(state.attendanceTimer);if(state.notificationChannel&&state.rtClient){try{state.rtClient.removeChannel(state.notificationChannel)}catch{}}});
boot().catch(e=>console.error("DOC-FULL-NR V16.5 boot",e));
