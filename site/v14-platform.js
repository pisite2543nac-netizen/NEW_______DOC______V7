import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF="thjscmfqunlaqxlievna";
const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;
const V14_VERSION="V14.1-FINAL-STABLE-LEARNING-PLATFORM";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const fmtDate=d=>d?new Date(d).toLocaleDateString("th-TH",{dateStyle:"medium"}):"-";
const safeName=s=>String(s||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-110);

const state={
  uid:null,profile:null,route:null,subjectId:null,serverOffset:0,
  heartbeatTimer:null,countdownTimer:null,navTimer:null,presenceChannel:null,
  scanner:null,scanBusy:false,lastScanToken:null,lastScanAt:0,currentAttendanceSession:null,
  rtClient:null
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
  const {data,error}=await client().from("profiles").select("id,username,full_name,role,active,class_name,student_code,avatar_path,phone,phone_verified_at,grade_level,room_label,seat_number,contact_email,department,major,last_seen_at").eq("id",id).maybeSingle();
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
    PHONE_NOT_VERIFIED:"เบอร์โทรศัพท์ยังไม่ได้รับการยืนยัน",PHONE_CHANGE_REQUIRES_VERIFICATION:"ต้องยืนยันเบอร์โทรด้วย OTP ก่อน",
    EXAM_NOT_OPEN:"ยังไม่ถึงเวลาเปิดสอบ",EXAM_CLOSED:"หมดเวลาเปิดสอบแล้ว",MAX_ATTEMPTS_REACHED:"ใช้สิทธิ์เข้าสอบครบแล้ว",
    EXAM_TIME_EXPIRED:"หมดเวลาทำข้อสอบแล้ว",NOT_ASSIGNED:"บัญชีนี้ไม่ได้รับมอบหมายข้อสอบ",ATTEMPT_FINALIZED:"ข้อสอบถูกส่งเรียบร้อยแล้ว"
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

function navBtn(route,label){const b=document.createElement("button");b.type="button";b.dataset.v14Route=route;b.textContent=label;b.className="v14-nav";return b}
async function ensureNav(){
  const nav=$("#sidebar .nav");if(!nav)return;
  const p=await getProfile();if(!p)return;
  let wanted;
  if(p.role==="admin"){
    wanted=[
      ["courses","🎓 รายวิชา / ปล่อยงาน"],["enrollments","✅ อนุมัติรายวิชา"],["profiles","🪪 โปรไฟล์นักศึกษา"],
      ["attendance","📷 เช็คชื่อ / หัวหน้าห้อง"],["presence","📡 สถานะออนไลน์"],["promotion","📈 เลื่อนชั้น / ปีการศึกษา"],["exam","🧪 ระบบสอบ"]
    ];
  }else{
    wanted=[["enroll","🎓 ลงทะเบียนรายวิชา"],["courses","📚 วิชาของฉัน"],["work","📋 ตารางสถานะงาน"],["attendance","📷 QR / การเข้าเรียน"],["exam","🧪 ระบบสอบ"]];
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
  const brand=$("#sidebar .brand .smalltext");if(brand&&brand.textContent!==`${p.role==="admin"?"ADMIN":"USER"} • V14.1 FINAL`)brand.textContent=`${p.role==="admin"?"ADMIN":"USER"} • V14.1 FINAL`;
  const ws=nav.querySelector('[data-route="worksheets"]');if(ws&&p.role==="admin")ws.remove();
  const mw=nav.querySelector('[data-route="myworks"]');if(mw&&p.role!=="admin")mw.remove();
}
function scheduleEnsureNav(){if(state.navTimer)return;state.navTimer=setTimeout(()=>{state.navTimer=null;ensureNav().catch(()=>{})},80)}
const shellObserver=new MutationObserver(scheduleEnsureNav);
shellObserver.observe($("#app")||document.body,{childList:true,subtree:true});

async function otpConfig(){try{const {data}=await client().rpc("get_phone_otp_config");return data||{enabled:false}}catch{return {enabled:false}}}
async function requirePhoneGate(route){
  const p=await getProfile();if(!p||p.role==="admin")return false;
  const cfg=await otpConfig();
  if(cfg?.enabled&&!p.phone_verified_at&&route!=="phone"){
    renderPhoneGate();return true;
  }
  return false;
}
async function navigate(route,arg=null){
  clearPresenceChannel();state.route=route;state.subjectId=null;heartbeat();
  const p=await getProfile(true);if(!p)return;
  if(await requirePhoneGate(route))return;
  $$("#sidebar .nav button").forEach(x=>x.classList.remove("active"));
  const b=$(`#sidebar .nav [data-v14-route="${route}"]`);if(b)b.classList.add("active");
  if(route==="exam"){window.open("./exam.html","_blank","noopener");return}
  const routes=p.role==="admin"?{
    dashboard:renderAdminDashboard,courses:()=>arg?renderAdminSubject(arg):renderAdminCourses,enrollments:renderEnrollmentAdmin,
    profiles:renderAdminProfiles,attendance:renderAttendance,presence:renderPresence,promotion:renderPromotion
  }:{dashboard:renderStudentDashboard,enroll:renderEnrollSubjects,courses:()=>arg?renderStudentCourse(arg):renderStudentCourses,work:renderWorkStatus,attendance:renderAttendance,presence:renderPresence,phone:renderPhoneGate};
  const fn=routes[route]||routes.dashboard;try{await fn()}catch(e){console.error("V14 route",route,e);if(content())content().innerHTML=`<div class="alert error"><b>เกิดข้อผิดพลาด</b><div>${esc(errorText(e))}</div><button class="btn" data-v14-retry="${esc(route)}">ลองใหม่</button></div>`}
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
  if(s?.status==="graded")return {key:"graded",label:"ตรวจคะแนนแล้ว",cls:"ok"};
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
  const c=client();const [pc,sc,wc,ec,oc,xc]=await Promise.all([
    c.from("profiles").select("id",{count:"exact",head:true}).eq("role","user").eq("active",true),
    c.from("subjects").select("id",{count:"exact",head:true}).eq("active",true).eq("subject_type","subject"),
    c.from("worksheets").select("id",{count:"exact",head:true}).contains("settings",{template_ready:true}),
    c.from("subject_enrollments").select("id",{count:"exact",head:true}).eq("status","pending"),
    c.from("user_presence").select("user_id,last_seen_at"),
    c.from("exams").select("id",{count:"exact",head:true})
  ]);
  const online=(oc.data||[]).filter(x=>x.last_seen_at&&new Date(x.last_seen_at).getTime()>=nowMs()-90000).length;
  const cfg=await otpConfig();
  content().innerHTML=`<section class="v14-page"><div class="v14-hero"><div><span class="v14-kicker">DOC-FULL-NR • ${V14_VERSION}</span><h1>ศูนย์ควบคุมการเรียนรู้</h1><p>วิทยาลัยเทคนิคนางรอง • ระบบรายวิชา ใบงาน เช็คชื่อ สอบ และเลื่อนชั้น</p></div><div class="v14-live"><i></i> Production Connected</div></div>
  <div class="v14-kpis"><div><span>นักศึกษาใช้งาน</span><b>${pc.count||0}</b></div><div><span>รายวิชา</span><b>${sc.count||0}</b></div><div><span>ใบงานสำเร็จรูป</span><b>${wc.count||0}</b><small>เป้าหมาย 198</small></div><div><span>รออนุมัติวิชา</span><b>${ec.count||0}</b></div><div><span>ออนไลน์ล่าสุด</span><b>${online}</b></div><div><span>ชุดข้อสอบ</span><b>${xc.count||0}</b></div></div>
  <div class="v14-action-grid">
    <button data-v14-route="courses"><span>🎓</span><b>รายวิชา / ปล่อยงาน</b><small>เลือก Paper/Digital หลายใบแล้วปล่อยพร้อมกัน</small></button>
    <button data-v14-route="enrollments"><span>✅</span><b>อนุมัติลงทะเบียนเรียน</b><small>ควบคุมว่าใครเรียนวิชาใด</small></button>
    <button data-v14-route="attendance"><span>📷</span><b>เช็คชื่อ QR</b><small>หัวหน้าห้อง / Admin ใช้กล้องสแกน</small></button>
    <button data-v14-route="presence"><span>📡</span><b>สถานะออนไลน์</b><small>ดูผู้ที่กำลังใช้งานแบบ Real-time</small></button>
    <button data-v14-route="profiles"><span>🪪</span><b>โปรไฟล์นักศึกษา</b><small>ข้อมูลส่วนตัวสำหรับ Admin เท่านั้น</small></button>
    <button data-v14-route="promotion"><span>📈</span><b>เลื่อนชั้น</b><small>ตรวจรายชื่อ → อนุมัติ → ดำเนินการ</small></button>
    <button data-v14-route="exam"><span>🧪</span><b>Exam Center</b><small>คลังข้อสอบ สอบ และผลสอบ</small></button>
  </div>
  <div class="card v14-system-strip"><div><b>OTP เบอร์โทรศัพท์</b><div class="muted">โค้ดรองรับการยืนยันจริงผ่าน Supabase Phone Auth</div></div><label class="v14-switch"><input id="v14-otp-toggle" type="checkbox" ${cfg?.enabled?"checked":""}><span></span><b>${cfg?.enabled?"บังคับ OTP":"ยังไม่บังคับ OTP"}</b></label></div>
  <div class="alert ${cfg?.enabled?"warn":""}"><b>หมายเหตุ OTP:</b> ก่อนเปิดบังคับ OTP ต้องตั้ง SMS Provider ใน Supabase Authentication ให้พร้อมก่อน หากยังไม่ได้ตั้งให้คงสวิตช์ปิดเพื่อไม่ล็อกนักศึกษาออกจากระบบ</div></section>`;
  $("#v14-otp-toggle")?.addEventListener("change",async e=>{if(e.target.checked&&!ask("ยืนยันว่าได้ตั้ง SMS Provider ใน Supabase Phone Auth เรียบร้อยแล้ว? หากยังไม่ได้ตั้ง นักศึกษาอาจยืนยัน OTP ไม่ได้")){e.target.checked=false;return}const {error}=await client().rpc("set_phone_otp_enforcement",{p_enabled:e.target.checked});if(error){toast(errorText(error),true);e.target.checked=!e.target.checked;return}toast("บันทึกการตั้งค่า OTP แล้ว");renderAdminDashboard()});
}
async function renderStudentDashboard(){
  setTitle("หน้าหลักการเรียน");busy("กำลังโหลดแดชบอร์ดของคุณ...");
  const p=await getProfile(),[courses,rows,summary,cfg,enrollments]=await Promise.all([approvedCourses(),studentWorkRows(),client().rpc("my_attendance_summary"),otpConfig(),enrollmentRowsMine()]);
  const sent=rows.filter(x=>["sent","late","graded"].includes(x.status.key)).length,pending=rows.filter(x=>["pending","draft","overdue"].includes(x.status.key)).length,pendingCourses=enrollments.filter(x=>x.status==="pending").length;
  const dueSoon=rows.filter(x=>!["sent","late","graded"].includes(x.status.key)).slice(0,5);
  content().innerHTML=`<section class="v14-page"><div class="v14-hero student"><div><span class="v14-kicker">SMART LEARNING DASHBOARD</span><h1>สวัสดี ${esc(p?.full_name||"")}</h1><p>${esc(p?.student_code||"")} • ${esc(p?.grade_level||"")}${esc(p?.room_label||"")} • ${esc(p?.major||"")}</p></div><div class="v14-live"><i></i> เชื่อมต่อระบบ</div></div>
  ${cfg?.enabled&&!p?.phone_verified_at?`<div class="alert warn"><b>ต้องยืนยันเบอร์โทรด้วย OTP</b> เพื่อใช้งานระบบเต็มรูปแบบ <button class="btn warn sm" data-v14-route="phone">ยืนยันตอนนี้</button></div>`:p?.phone_verified_at?`<div class="alert success">✅ เบอร์โทรศัพท์ได้รับการยืนยันแล้ว</div>`:""}
  <div class="v14-kpis"><div><span>วิชาที่อนุมัติแล้ว</span><b>${courses.length}</b></div><div><span>วิชารออนุมัติ</span><b>${pendingCourses}</b></div><div><span>งานทั้งหมด</span><b>${rows.length}</b></div><div><span>ส่งแล้ว/ตรวจแล้ว</span><b>${sent}</b></div><div><span>ต้องดำเนินการ</span><b>${pending}</b></div></div>
  <div class="v14-section-head"><div><h2>📚 รายวิชาของฉัน</h2><p>แสดงเฉพาะรายวิชาที่ Admin อนุมัติแล้ว</p></div><button class="btn" data-v14-route="enroll">ลงทะเบียนเพิ่ม</button></div>
  <div class="v14-course-grid">${courses.map(s=>{const cw=rows.filter(x=>x.w.subject_id===s.id),done=cw.filter(x=>["sent","late","graded"].includes(x.status.key)).length,pct=cw.length?Math.round(done*100/cw.length):0;return `<button class="v14-course-card" data-v14-open-course="${s.id}" style="--course:${esc(s.color_hex||"#22d3ee")}"><span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><small>งาน ${done}/${cw.length} • ความคืบหน้า ${pct}%</small><div class="v14-progress"><i style="width:${pct}%"></i></div><small>เปิดรายวิชา → ใบงาน + สไลด์</small></button>`}).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่ได้รับอนุมัติ • ไปที่ “ลงทะเบียนรายวิชา” เพื่อส่งคำขอ</div>`}</div>
  <div class="v14-section-head"><div><h2>⏱️ งานที่ใกล้กำหนด</h2><p>ระบบนับเวลาจาก Server</p></div><button class="btn" data-v14-route="work">ดูตารางทั้งหมด</button></div>
  <div class="v14-work-list">${dueSoon.map(workCard).join("")||`<div class="v14-empty">ยังไม่มีงานค้าง</div>`}</div>
  <div class="v14-section-head"><div><h2>📊 การเข้าเรียน</h2></div></div><div class="v14-mini-grid">${(summary.data||[]).map(x=>`<div class="card"><b>${esc(x.subject_code)} ${esc(x.subject_name)}</b><strong>${x.attendance_percent??0}%</strong><small>มา ${x.present_count} • สาย ${x.late_count} • ขาด ${x.absent_count}</small></div>`).join("")||`<div class="v14-empty">ยังไม่มีข้อมูลเช็คชื่อ</div>`}</div></section>`;
  startCountdowns();
}

// ---------------------------------------------------------------------------
// Subject enrollment
// ---------------------------------------------------------------------------
async function enrollmentRowsMine(){const {data,error}=await client().from("subject_enrollments").select("id,subject_id,status,requested_at,decided_at,note").eq("user_id",uid());if(error)throw error;return data||[]}
async function renderEnrollSubjects(){
  setTitle("ลงทะเบียนรายวิชา");busy("กำลังโหลดรายวิชา...");const [subjects,enrolls]=await Promise.all([allSubjects(),enrollmentRowsMine()]);const em=new Map(enrolls.map(x=>[x.subject_id,x]));
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">COURSE REGISTRATION</span><h1>ลงทะเบียนรายวิชา</h1><p>เลือกวิชาที่ต้องการเรียน แล้วรอ Admin อนุมัติ</p></div></div>
  <div class="v14-course-grid">${subjects.map(s=>{const e=em.get(s.id);const st=e?.status||"none";const labels={pending:"รออนุมัติ",approved:"อนุมัติแล้ว",rejected:"ไม่อนุมัติ",withdrawn:"ถอนวิชา"};return `<article class="v14-course-card static" style="--course:${esc(s.color_hex||"#22d3ee")}"><span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><small>${esc(s.description||`ภาคเรียน ${s.semester||"-"} / ${s.academic_year||"-"}`)}</small><div class="v14-card-footer"><span class="v14-status ${st}">${labels[st]||"ยังไม่ได้ลงทะเบียน"}</span>${st==="approved"||st==="pending"?`<button class="btn sm" data-v14-withdraw-course="${s.id}">ถอนคำขอ/ถอนวิชา</button>`:`<button class="btn primary sm" data-v14-request-course="${s.id}">ขอลงทะเบียนเรียน</button>`}</div></article>`}).join("")}</div></section>`;
}
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
  setTitle("รายวิชา / ปล่อยงาน");busy("กำลังโหลดรายวิชาและใบงานสำเร็จรูป...");const c=client();const [sr,wr,er]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,semester,academic_year,description").eq("active",true).eq("subject_type","subject").order("code"),
    c.from("worksheets").select("id,subject_id,mode,status,settings,open_at,due_at").order("created_at"),
    c.from("subject_enrollments").select("subject_id,status")
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(er.error)throw er.error;const ready=(wr.data||[]).filter(w=>w.settings?.template_ready===true);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">SUBJECT-FIRST CONTENT</span><h1>รายวิชา / ใบงาน / สไลด์</h1><p>เลือกวิชาก่อน ทุกใบงานและสื่อจะอยู่ในวิชาเดียวกัน</p></div><div class="v14-stat-pill">ใบงานสำเร็จรูป <b>${ready.length}</b></div></div><div class="card v14-filter"><input id="v14-course-q" class="input" placeholder="ค้นหารหัสวิชา / ชื่อวิชา"></div><div id="v14-admin-course-grid" class="v14-course-grid">${(sr.data||[]).map(s=>{const ws=ready.filter(w=>w.subject_id===s.id),paper=ws.filter(w=>w.mode==="paper").length,digital=ws.filter(w=>w.mode==="digital").length,learners=(er.data||[]).filter(e=>e.subject_id===s.id&&e.status==="approved").length;return `<button class="v14-course-card" data-v14-admin-course="${s.id}" data-search="${esc(`${s.code} ${s.name}`.toLowerCase())}" style="--course:${esc(s.color_hex||"#22d3ee")}"><span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><div class="v14-course-counts"><span>🖨️ ${paper}/5</span><span>💻 ${digital}/13</span><span>👥 ${learners}</span></div><small>เปิดเพื่อจัดใบงาน สไลด์ และปล่อยงาน</small></button>`}).join("")}</div></section>`;
  $("#v14-course-q").oninput=e=>{const q=e.target.value.trim().toLowerCase();$$('[data-v14-admin-course]').forEach(x=>x.hidden=q&&!x.dataset.search.includes(q))};
}
function wsSeq(w){const m=String(w.reference_code||"").match(/-([PD]\d{2})$/);return m?Number(m[1].slice(1)):Number(w.settings?.lesson_sequence||0)||0}
function wsCode(w){const m=String(w.reference_code||"").match(/-([PD]\d{2})$/);return m?m[1]:(w.mode==="paper"?"P":"D")}
async function renderAdminSubject(sid){
  state.subjectId=sid;state.route="courses";heartbeat();setTitle("จัดการรายวิชา");busy("กำลังโหลดชุดการเรียน...");const c=client();
  const [sr,wr,fr,er]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,description,semester,academic_year").eq("id",sid).single(),
    c.from("worksheets").select("*").eq("subject_id",sid).order("created_at"),
    c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,mime_type,size_bytes,created_at").eq("subject_id",sid).order("created_at"),
    c.from("subject_enrollments").select("id,status,user_id,profiles(full_name,student_code,grade_level,room_label)").eq("subject_id",sid)
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(fr.error)throw fr.error;if(er.error)throw er.error;
  const s=sr.data,ready=(wr.data||[]).filter(w=>w.settings?.template_ready===true),files=fr.data||[],approved=(er.data||[]).filter(e=>e.status==="approved");
  const renderGroup=(mode,label)=>{const list=ready.filter(w=>w.mode===mode).sort((a,b)=>wsSeq(a)-wsSeq(b));return `<section class="v14-ws-section"><div class="v14-section-head compact"><div><h2>${label}</h2><p>${list.length} ใบ • แยกจาก${mode==="paper"?"ใบงานอิเล็กทรอนิกส์":"ใบงานกระดาษ"}</p></div><button class="btn sm" data-v14-select-mode="${mode}">เลือกทั้งหมด</button></div><div class="v14-bundle-list">${list.map(w=>{const fs=files.filter(f=>f.worksheet_id===w.id||(!f.worksheet_id&&Number(f.sequence_no||0)===wsSeq(w)));return `<article class="v14-bundle" style="--course:${esc(s.color_hex||"#22d3ee")}"><label class="v14-select"><input type="checkbox" data-v14-wselect value="${w.id}"><span>${esc(wsCode(w))}</span></label><div class="v14-bundle-main"><div class="v14-badges"><span>${mode==="paper"?"ใบงานกระดาษ":"ใบงานดิจิทัล"}</span><span class="${w.status}">${w.status==="published"?"เผยแพร่แล้ว":"ฉบับร่าง"}</span></div><h3>${esc(w.title)}</h3><div class="v14-goal">🎯 ${esc(w.settings?.learning_goal||"เป้าหมายตามหน่วยการเรียน")}</div><div class="v14-meta">${w.open_at?`เปิด ${fmt(w.open_at)}`:"ยังไม่กำหนดเวลา"}${w.due_at?` • ส่ง ${fmt(w.due_at)}`:""}</div><div class="v14-actions"><button class="btn sm" data-v14-preview="${w.id}">👁 ดูตัวอย่างใบงาน</button><button class="btn sm" data-v14-upload="${w.id}" data-subject="${sid}" data-seq="${wsSeq(w)}">＋ เพิ่มสไลด์/สื่อ</button></div></div><div class="v14-media-pane"><b>📊 สไลด์ / สื่อประกอบ</b>${fs.length?fs.map(f=>`<button class="v14-file" data-v14-file="${esc(f.storage_path)}">${esc(f.original_name)}</button>`).join(""):`<div class="v14-media-empty">ยังไม่มีสื่อที่จับคู่</div>`}</div></article>`}).join("")}</div></section>`};
  content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับรายวิชา</button><div class="v14-course-hero" style="--course:${esc(s.color_hex||"#22d3ee")}"><div><span class="v14-kicker">${esc(s.code)}</span><h1>${esc(s.name)}</h1><p>${esc(s.description||"")}</p></div><div><b>${approved.length}</b><span>ผู้เรียนอนุมัติแล้ว</span></div></div>
  <div class="card v14-releasebar"><div><b>ปล่อยใบงานให้ผู้เรียนทั้งรายวิชา</b><div class="muted">ติ๊กได้กี่ใบก็ได้ ทั้งหมดจะส่งให้ผู้เรียนที่อนุมัติแล้ว ${approved.length} คนพร้อมกัน</div></div><button class="btn primary" id="v14-bulk-release">🚀 ปล่อยใบงานที่เลือก</button></div>
  ${renderGroup("paper","🖨️ ใบงานสำหรับพิมพ์ P01–P05")}${renderGroup("digital","💻 ใบงานอิเล็กทรอนิกส์ D01–D13")}</section>`;
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
  setTitle("วิชาของฉัน");busy("กำลังโหลดรายวิชาที่อนุมัติ...");const courses=await approvedCourses();
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">MY COURSES</span><h1>รายวิชาของฉัน</h1><p>เข้าแต่ละวิชาเพื่อดูสไลด์และใบงานที่ปล่อยแล้ว</p></div><button class="btn primary" data-v14-route="enroll">＋ ลงทะเบียนรายวิชา</button></div><div class="v14-course-grid">${courses.map(s=>`<button class="v14-course-card" data-v14-open-course="${s.id}" style="--course:${esc(s.color_hex||"#22d3ee")}"><span class="code">${esc(s.code)}</span><b>${esc(s.name)}</b><small>สถานะ: อนุมัติให้เรียนแล้ว</small></button>`).join("")||`<div class="v14-empty">ยังไม่มีรายวิชาที่ได้รับอนุมัติ</div>`}</div></section>`;
}
async function renderStudentCourse(sid){
  state.subjectId=sid;state.route="courses";heartbeat();setTitle("รายวิชาของฉัน");busy("กำลังโหลดบทเรียน...");const c=client();
  const [sr,wr,fr,subr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,description").eq("id",sid).single(),
    c.from("worksheets").select("id,subject_id,title,reference_code,mode,status,open_at,due_at,settings,subjects(id,code,name,color_hex)").eq("subject_id",sid).eq("status","published").order("open_at"),
    c.from("subject_files").select("id,worksheet_id,sequence_no,resource_kind,original_name,storage_path").eq("subject_id",sid).order("created_at"),
    c.from("submissions").select("worksheet_id,status,submitted_at,is_late,last_saved_at").eq("user_id",uid())
  ]);if(sr.error)throw sr.error;if(wr.error)throw wr.error;if(fr.error&&!String(fr.error.message).includes("permission"))throw fr.error;
  const s=sr.data,sm=new Map((subr.data||[]).map(x=>[x.worksheet_id,x])),works=wr.data||[],files=fr.data||[];
  const group=(mode,label)=>{const list=works.filter(w=>w.mode===mode);return `<section><div class="v14-section-head compact"><div><h2>${label}</h2><p>${list.length} งานที่ปล่อยแล้ว</p></div></div><div class="v14-work-list">${list.map(w=>{const st=workStatus(w,sm.get(w.id)),fs=files.filter(f=>f.worksheet_id===w.id||(!f.worksheet_id&&Number(f.sequence_no||0)===wsSeq(w)));return `<article class="v14-learning-set" style="--course:${esc(s.color_hex||"#22d3ee")}"><div class="v14-learning-content"><span class="v14-codebox">${esc(wsCode(w))}</span><div><h3>${esc(w.title)}</h3><div class="v14-goal">🎯 ${esc(w.settings?.learning_goal||"เป้าหมายตามหน่วยการเรียน")}</div><div class="v14-meta">เปิด ${fmt(w.open_at)} • ส่ง ${fmt(w.due_at)}</div>${!["sent","late","graded"].includes(st.key)&&w.due_at?`<b class="v14-countdown" data-v14-countdown="${esc(w.due_at)}"></b>`:""}</div></div><div class="v14-learning-media"><b>📊 สไลด์ / สื่อ</b>${fs.length?fs.map(f=>`<button class="v14-file" data-v14-file="${esc(f.storage_path)}">${esc(f.original_name)}</button>`).join(""):`<small>ยังไม่มีสื่อประกอบชุดนี้</small>`}</div><div class="v14-learning-actions"><span class="v14-status ${st.cls}">${esc(st.label)}</span><button class="btn primary" data-v14-open-work="${w.id}">${mode==="digital"?"เปิดทำใบงาน":"ดูใบงาน"}</button></div></article>`}).join("")||`<div class="v14-empty">ยังไม่มีใบงานประเภทนี้ที่ปล่อยให้คุณ</div>`}</div></section>`};
  content().innerHTML=`<section class="v14-page"><button class="btn ghost" data-v14-route="courses">← กลับรายวิชาของฉัน</button><div class="v14-course-hero" style="--course:${esc(s.color_hex||"#22d3ee")}"><div><span class="v14-kicker">${esc(s.code)}</span><h1>${esc(s.name)}</h1><p>${esc(s.description||"")}</p></div></div>${group("paper","🖨️ ใบงานสำหรับพิมพ์")}${group("digital","💻 ใบงานอิเล็กทรอนิกส์")}</section>`;startCountdowns();
}
async function renderWorkStatus(){
  setTitle("ตารางสถานะงาน");busy("กำลังตรวจงานทั้งหมด...");const rows=await studentWorkRows();const counts={sent:0,late:0,graded:0,draft:0,pending:0,upcoming:0,overdue:0};rows.forEach(x=>counts[x.status.key]++);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">WORK STATUS</span><h1>ตารางสถานะงาน</h1><p>เห็นทันทีว่างานไหนส่งแล้ว งานไหนยังค้าง และเหลือเวลาเท่าไร</p></div></div><div class="v14-kpis four"><div><span>ทั้งหมด</span><b>${rows.length}</b></div><div><span>ส่งแล้ว/ตรวจแล้ว</span><b>${counts.sent+counts.late+counts.graded}</b></div><div><span>กำลังทำ/ยังไม่ส่ง</span><b>${counts.draft+counts.pending}</b></div><div><span>เกินกำหนด</span><b>${counts.overdue}</b></div></div>
  <div class="card v14-filter"><input id="v14-work-q" class="input" placeholder="ค้นหาวิชา / ใบงาน"><select id="v14-work-type" class="input"><option value="">ทุกประเภท</option><option value="paper">ใบงานกระดาษ</option><option value="digital">ใบงานอิเล็กทรอนิกส์</option></select><select id="v14-work-status" class="input"><option value="">ทุกสถานะ</option><option value="pending">ยังไม่ส่ง</option><option value="draft">บันทึกร่าง</option><option value="sent">ส่งแล้ว</option><option value="late">ส่งช้า</option><option value="graded">ตรวจคะแนนแล้ว</option><option value="overdue">เกินกำหนด</option><option value="upcoming">ยังไม่เปิด</option></select></div><div id="v14-work-list" class="v14-work-list"></div></section>`;
  const draw=()=>{const q=$("#v14-work-q").value.trim().toLowerCase(),mode=$("#v14-work-type").value,st=$("#v14-work-status").value;const f=rows.filter(x=>(!q||`${x.w.title} ${x.w.subjects?.code} ${x.w.subjects?.name}`.toLowerCase().includes(q))&&(!mode||x.w.mode===mode)&&(!st||x.status.key===st));$("#v14-work-list").innerHTML=f.map(workCard).join("")||`<div class="v14-empty">ไม่พบงานตามตัวกรอง</div>`;startCountdowns()};draw();$("#v14-work-q").oninput=draw;$("#v14-work-type").onchange=draw;$("#v14-work-status").onchange=draw;
}

// ---------------------------------------------------------------------------
// Phone OTP
// ---------------------------------------------------------------------------
function normalizePhone(v){const s=String(v||"").replace(/[\s()-]/g,"");if(/^0\d{9}$/.test(s))return "+66"+s.slice(1);if(/^\+66\d{9}$/.test(s))return s;return null}
async function renderPhoneGate(){
  state.route="phone";setTitle("ยืนยันเบอร์โทร");const p=await getProfile(true),cfg=await otpConfig();
  content().innerHTML=`<section class="v14-page narrow"><div class="v14-hero"><div><span class="v14-kicker">PHONE VERIFICATION</span><h1>ยืนยันเบอร์โทรศัพท์ด้วย OTP</h1><p>ใช้ Supabase Phone Auth และรหัส OTP จริงจาก SMS</p></div></div><div class="card"><div class="alert ${cfg?.enabled?"warn":""}">${cfg?.enabled?"ระบบกำหนดให้ยืนยัน OTP ก่อนใช้งานเต็มรูปแบบ":"Admin ยังไม่ได้เปิดบังคับ OTP คุณสามารถยืนยันล่วงหน้าได้เมื่อ SMS Provider พร้อม"}</div><form id="v14-phone-send"><label class="field"><span>เบอร์โทรศัพท์</span><input class="input" name="phone" type="tel" value="${esc(p?.phone||"")}" placeholder="0812345678" required></label><button class="btn primary">ส่ง OTP ทาง SMS</button></form><form id="v14-phone-verify" hidden><label class="field"><span>รหัส OTP 6 หลัก</span><input class="input" name="token" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button class="btn green">ยืนยัน OTP</button></form><div id="v14-phone-msg"></div></div></section>`;
  let pendingPhone=null;
  $("#v14-phone-send").onsubmit=async e=>{e.preventDefault();const phone=normalizePhone(new FormData(e.target).get("phone"));if(!phone){toast("รูปแบบเบอร์โทรไม่ถูกต้อง",true);return}const ac=authClient(),s=readSession();const ss=await ac.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});if(ss.error){toast(errorText(ss.error),true);return}const r=await ac.auth.updateUser({phone});if(r.error){$("#v14-phone-msg").innerHTML=`<div class="alert error">${esc(errorText(r.error))}<br><small>หากยังไม่ได้ตั้ง SMS Provider ให้ Admin ตั้งค่าที่ Supabase Authentication ก่อน</small></div>`;return}pendingPhone=phone;$("#v14-phone-verify").hidden=false;$("#v14-phone-msg").innerHTML=`<div class="alert success">ส่ง OTP ไปยัง ${esc(phone)} แล้ว กรุณากรอกรหัส 6 หลัก</div>`};
  $("#v14-phone-verify").onsubmit=async e=>{e.preventDefault();if(!pendingPhone)return;const token=String(new FormData(e.target).get("token")||"").trim();const ac=authClient(),s=readSession();await ac.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});const vr=await ac.auth.verifyOtp({phone:pendingPhone,token,type:"phone_change"});if(vr.error){toast(errorText(vr.error),true);return}const sync=await client().rpc("sync_phone_verification");if(sync.error){toast(errorText(sync.error),true);return}await getProfile(true);toast("ยืนยันเบอร์โทรศัพท์สำเร็จ");navigate("dashboard")};
}

// ---------------------------------------------------------------------------
// Admin private profiles
// ---------------------------------------------------------------------------
async function renderAdminProfiles(){
  setTitle("โปรไฟล์นักศึกษา");busy("กำลังโหลดข้อมูลส่วนตัวสำหรับ Admin...");const {data,error}=await client().from("profiles").select("id,username,full_name,student_code,avatar_path,phone,phone_verified_at,grade_level,room_label,class_name,department,major,active,last_seen_at,created_at").eq("role","user").order("full_name");if(error)throw error;const rows=data||[];
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ADMIN ONLY • PRIVATE PROFILE</span><h1>โปรไฟล์นักศึกษา</h1><p>ข้อมูลหน้านี้มองเห็นโดย Admin เท่านั้น</p></div><div class="v14-stat-pill">${rows.length} คน</div></div><div class="card v14-filter"><input id="v14-profile-q" class="input" placeholder="ค้นหาชื่อ / เลขนักศึกษา / ห้อง / สาขา"></div><div id="v14-profile-grid" class="v14-profile-grid"></div></section>`;
  const draw=()=>{const q=$("#v14-profile-q").value.trim().toLowerCase();const f=rows.filter(p=>!q||`${p.full_name} ${p.student_code} ${p.class_name} ${p.department} ${p.major}`.toLowerCase().includes(q));$("#v14-profile-grid").innerHTML=f.map(p=>`<button class="v14-profile-card" data-v14-profile="${p.id}"><div class="v14-avatar-placeholder">${esc((p.full_name||"?").slice(0,1))}</div><div><b>${esc(p.full_name||"-")}</b><small>${esc(p.student_code||"")} • ${esc(p.grade_level||"")}${esc(p.room_label||"")}</small><small>${esc(p.major||"")}</small></div><span class="v14-status ${p.phone_verified_at?"approved":"pending"}">${p.phone_verified_at?"OTP ✓":"OTP -"}</span></button>`).join("")};draw();$("#v14-profile-q").oninput=draw;
}
async function showAdminProfile(id){
  const c=client();const [pr,er,sr,ar]=await Promise.all([
    c.from("profiles").select("*").eq("id",id).single(),
    c.from("subject_enrollments").select("status,requested_at,subjects(code,name)").eq("user_id",id),
    c.from("submissions").select("id,status,submitted_at,worksheet_id,worksheets(title,subjects(code,name))").eq("user_id",id).order("updated_at",{ascending:false}).limit(20),
    c.from("attendance_records").select("status,scanned_at,attendance_sessions(session_date,subjects(code,name))").eq("user_id",id).order("created_at",{ascending:false}).limit(20)
  ]);if(pr.error){toast(errorText(pr.error),true);return}const p=pr.data;let avatar=null;if(p.avatar_path){const r=await c.storage.from("avatars").createSignedUrl(p.avatar_path,600);avatar=r.data?.signedUrl||null}
  overlay(`<div class="v14-modal-head"><div><span class="v14-kicker">ADMIN PRIVATE PROFILE</span><h2>${esc(p.full_name||"-")}</h2><p>${esc(p.student_code||"")} • ${esc(p.class_name||"")}</p></div><button class="btn" data-v14-close>✕</button></div><div class="v14-profile-detail"><div>${avatar?`<img src="${avatar}" alt="รูปโปรไฟล์">`:`<div class="v14-big-avatar">${esc((p.full_name||"?")[0])}</div>`}</div><div class="v14-info-grid"><div><span>เบอร์โทร</span><b>${esc(p.phone||"-")}</b><small>${p.phone_verified_at?`ยืนยัน ${fmt(p.phone_verified_at)}`:"ยังไม่ยืนยัน OTP"}</small></div><div><span>ระดับ/ห้อง</span><b>${esc(p.grade_level||"")} ${esc(p.room_label||"")}</b></div><div><span>แผนก</span><b>${esc(p.department||"-")}</b></div><div><span>สาขา</span><b>${esc(p.major||"-")}</b></div><div><span>สถานะ</span><b>${p.active?"ใช้งาน":"ปิดใช้งาน"}</b></div><div><span>ออนไลน์ล่าสุด</span><b>${fmt(p.last_seen_at)}</b></div></div></div><h3>รายวิชา</h3><div class="v14-chip-list">${(er.data||[]).map(x=>`<span>${esc(x.subjects?.code||"")} ${esc(x.subjects?.name||"")} • ${esc(x.status)}</span>`).join("")||"-"}</div><h3>งานล่าสุด</h3><div class="v14-simple-list">${(sr.data||[]).map(x=>`<div><b>${esc(x.worksheets?.subjects?.code||"")} ${esc(x.worksheets?.title||"")}</b><span>${esc(x.status)} • ${fmt(x.submitted_at)}</span></div>`).join("")||"-"}</div><h3>เช็คชื่อล่าสุด</h3><div class="v14-simple-list">${(ar.data||[]).map(x=>`<div><b>${esc(x.attendance_sessions?.subjects?.code||"")} • ${fmtDate(x.attendance_sessions?.session_date)}</b><span>${esc(x.status)} • ${fmt(x.scanned_at)}</span></div>`).join("")||"-"}</div>`,true);
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
  setTitle("เช็คชื่อ / การเข้าเรียน");state.route="attendance";busy("กำลังโหลดระบบเช็คชื่อ...");const p=await getProfile();const c=client();
  const [qr,summary,leaderRooms]=await Promise.all([p.role!=="admin"?c.rpc("get_my_attendance_qr"):Promise.resolve({data:null}),p.role!=="admin"?c.rpc("my_attendance_summary"):Promise.resolve({data:[]}),p.role!=="admin"?c.rpc("my_leader_classrooms"):Promise.resolve({data:[]})]);
  const canScan=p.role==="admin"||(leaderRooms.data||[]).length>0;let rooms=[];if(p.role==="admin"){const rr=await c.from("classrooms").select("id,name,level,semester,academic_year").eq("active",true).order("name");rooms=rr.data||[]}else rooms=leaderRooms.data||[];
  const subjects=canScan?await allSubjects():[];
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">QR ATTENDANCE</span><h1>${canScan?"เช็คชื่อด้วย QR Code":"QR ประจำตัว / การเข้าเรียน"}</h1><p>ใช้ Server Time และบันทึก Audit Log ทุกการสแกน</p></div></div>
  ${p.role!=="admin"?`<div class="v14-attendance-grid"><div class="card v14-qr-card"><h2>QR ประจำตัวนักศึกษา</h2><div id="v14-my-qr"></div><small>QR นี้เป็น Token ไม่เปิดเผย user_id โดยตรง</small><button class="btn sm" id="v14-rotate-qr">ออก QR ใหม่</button></div><div class="card"><h2>สรุปการเข้าเรียน</h2>${(summary.data||[]).map(x=>`<div class="v14-att-row"><div><b>${esc(x.subject_code)} ${esc(x.subject_name)}</b><small>มา ${x.present_count} • สาย ${x.late_count} • ขาด ${x.absent_count}</small></div><strong>${x.attendance_percent??0}%</strong></div>`).join("")||`<div class="v14-empty">ยังไม่มีข้อมูลเช็คชื่อ</div>`}</div></div>`:""}
  ${canScan?`<div class="card v14-scan-panel"><div class="v14-section-head compact"><div><h2>📷 สแกนเช็คชื่อ</h2><p>การสแกนคนแรกจะเปิดรอบของวันนี้อัตโนมัติ</p></div><button class="btn red" id="v14-close-session" ${state.currentAttendanceSession?"":"disabled"}>ปิดรอบเช็คชื่อ</button></div><div class="v14-form-grid three"><label>ห้องเรียน<select class="input" id="v14-att-class"><option value="">เลือกห้อง</option>${rooms.map(r=>`<option value="${r.classroom_id||r.id}">${esc(r.classroom_name||r.name)}</option>`).join("")}</select></label><label>รายวิชา<select class="input" id="v14-att-subject"><option value="">เลือกรายวิชา</option>${subjects.map(s=>`<option value="${s.id}">${esc(s.code)} ${esc(s.name)}</option>`).join("")}</select></label><label>นาทีที่ถือว่าสาย<input class="input" id="v14-att-late" type="number" min="0" max="240" value="15"></label></div><div class="row end"><button class="btn" id="v14-att-summary-btn">📊 สรุป % การเข้าเรียน</button></div><div id="v14-att-summary-box"></div><div class="v14-camera-grid"><div><video id="v14-scan-video" playsinline muted></video><canvas id="v14-scan-canvas" hidden></canvas><div class="row"><button class="btn primary" id="v14-start-scan">เปิดกล้องสแกน</button><button class="btn" id="v14-stop-scan">หยุดกล้อง</button></div></div><div><form id="v14-manual-scan"><label class="field"><span>กรอก Token สำรอง</span><input class="input" name="token" placeholder="DOCNR-ATTEND:..." required></label><button class="btn">บันทึก Token</button></form><div id="v14-scan-result" class="v14-scan-results"></div></div></div></div>`:""}
  ${p.role==="admin"?`<div class="card v14-leader-admin"><h2>👑 แต่งตั้งหัวหน้าห้อง</h2><div class="row"><select id="v14-leader-class" class="input"><option value="">เลือกห้องเรียน</option>${rooms.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select><button id="v14-load-roster" class="btn">โหลดรายชื่อ</button></div><div id="v14-roster"></div></div>`:""}
  ${canScan?`<div class="card"><div class="row between"><h2>รอบเช็คชื่อล่าสุด</h2><button class="btn sm" id="v14-refresh-sessions">รีเฟรช</button></div><div id="v14-session-list"></div></div>`:""}</section>`;
  if(p.role!=="admin"&&qr.data?.payload&&window.QRCode){new QRCode($("#v14-my-qr"),{text:qr.data.payload,width:190,height:190});$("#v14-rotate-qr").onclick=async()=>{if(!ask("ออก QR ใหม่? QR เดิมจะใช้เช็คชื่อไม่ได้ทันที"))return;const r=await c.rpc("rotate_attendance_qr",{p_user_id:null});if(r.error){toast(errorText(r.error),true);return}renderAttendance()}}
  if(canScan){$("#v14-start-scan").onclick=startScanner;$("#v14-stop-scan").onclick=stopScanner;$("#v14-manual-scan").onsubmit=async e=>{e.preventDefault();await submitAttendanceToken(new FormData(e.target).get("token"))};$("#v14-close-session").onclick=closeAttendanceCurrent;$("#v14-refresh-sessions").onclick=loadAttendanceSessions;$("#v14-att-summary-btn").onclick=loadAttendanceSummary;loadAttendanceSessions()}
  if(p.role==="admin"){$("#v14-load-roster").onclick=loadLeaderRoster}
}
function parseAttendanceToken(raw){const s=String(raw||"").trim();const x=s.startsWith("DOCNR-ATTEND:")?s.slice(13):s;return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}
async function submitAttendanceToken(raw){
  const token=parseAttendanceToken(raw);if(!token){toast("QR/Token ไม่ถูกต้อง",true);return}
  const classId=$("#v14-att-class")?.value,subjectId=$("#v14-att-subject")?.value,late=Number($("#v14-att-late")?.value||15);if(!classId||!subjectId){toast("กรุณาเลือกห้องและรายวิชาก่อนสแกน",true);return}
  if(state.scanBusy)return;state.scanBusy=true;const {data,error}=await client().rpc("scan_attendance_qr",{p_classroom_id:classId,p_subject_id:subjectId,p_token:token,p_late_after_minutes:late});state.scanBusy=false;
  if(error){toast(errorText(error),true);return}state.currentAttendanceSession=data.session_id;const b=$("#v14-close-session");if(b)b.disabled=false;const box=$("#v14-scan-result");if(box)box.insertAdjacentHTML("afterbegin",`<div class="v14-scan-hit ${data.status}"><b>${esc(data.student_code||"")} ${esc(data.full_name||"")}</b><span>${data.status==="late"?"สาย":"มาเรียน"} • ${new Date().toLocaleTimeString("th-TH")}</span></div>`);toast(`เช็คชื่อ ${data.full_name||data.student_code} สำเร็จ`);loadAttendanceSessions();
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
async function closeAttendanceCurrent(){if(!state.currentAttendanceSession||!ask("ปิดรอบเช็คชื่อ? ผู้ที่ยังไม่ได้สแกนและอยู่ในวิชานี้จะถูกบันทึกเป็นขาด"))return;const r=await client().rpc("close_attendance_session",{p_session_id:state.currentAttendanceSession});if(r.error){toast(errorText(r.error),true);return}toast(`ปิดรอบแล้ว • เพิ่มขาด ${r.data?.absent_added||0} คน`);state.currentAttendanceSession=null;renderAttendance()}
async function loadAttendanceSessions(){const box=$("#v14-session-list");if(!box)return;const {data,error}=await client().from("attendance_sessions").select("id,session_date,started_at,closed_at,status,late_after_minutes,classrooms(name),subjects(code,name)").order("started_at",{ascending:false}).limit(20);if(error){box.innerHTML=`<div class="alert error">${esc(errorText(error))}</div>`;return}box.innerHTML=(data||[]).map(x=>`<button class="v14-session-row" data-v14-session="${x.id}"><div><b>${esc(x.subjects?.code||"")} ${esc(x.subjects?.name||"")}</b><small>${esc(x.classrooms?.name||"")} • ${fmt(x.started_at)}</small></div><span class="v14-status ${x.status==="open"?"approved":"muted"}">${x.status==="open"?"กำลังเช็คชื่อ":"ปิดแล้ว"}</span></button>`).join("")||`<div class="v14-empty">ยังไม่มีรอบเช็คชื่อ</div>`}
async function loadAttendanceSummary(){
  const classId=$("#v14-att-class")?.value,subjectId=$("#v14-att-subject")?.value,box=$("#v14-att-summary-box");
  if(!classId||!subjectId){toast("กรุณาเลือกห้องและรายวิชาก่อนดูสรุป",true);return}
  if(box)box.innerHTML='<div class="v14-loading-inline">กำลังสรุปการเข้าเรียน...</div>';
  const {data,error}=await client().rpc("attendance_subject_summary",{p_classroom_id:classId,p_subject_id:subjectId});
  if(error){if(box)box.innerHTML=`<div class="alert error">${esc(errorText(error))}</div>`;return}
  if(box)box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>นักศึกษา</th><th>ครั้งเรียน</th><th>มา</th><th>สาย</th><th>ขาด</th><th>ลา</th><th>% เข้าเรียน</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${x.total_sessions}</td><td>${x.present_count}</td><td>${x.late_count}</td><td>${x.absent_count}</td><td>${x.excused_count}</td><td><b>${x.attendance_percent??0}%</b></td></tr>`).join("")||`<tr><td colspan="8" class="empty">ยังไม่มีรอบเช็คชื่อที่ปิดแล้ว</td></tr>`}</tbody></table></div>`;
}
async function loadAttendanceRoster(sessionId){
  const [rr,p]=await Promise.all([client().rpc("attendance_session_roster",{p_session_id:sessionId}),getProfile()]);
  if(rr.error){toast(errorText(rr.error),true);return}const editable=p?.role==="admin";
  overlay(`<div class="v14-modal-head"><div><h2>รายชื่อการเข้าเรียน</h2><p>${editable?"Admin สามารถแก้สถานะได้ และระบบบันทึก Audit Log":"หัวหน้าห้องดูข้อมูลของห้องตนเอง"}</p></div><button class="btn" data-v14-close>✕</button></div><div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>สถานะ</th><th>เวลา</th></tr></thead><tbody>${(rr.data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${editable?`<select class="input" data-v14-att-status="${x.record_id}" data-session="${sessionId}"><option value="present" ${x.status==="present"?"selected":""}>มา</option><option value="late" ${x.status==="late"?"selected":""}>สาย</option><option value="absent" ${x.status==="absent"?"selected":""}>ขาด</option><option value="excused" ${x.status==="excused"?"selected":""}>ลา/มีเหตุผล</option></select>`:esc(x.status)}</td><td>${fmt(x.scanned_at)}</td></tr>`).join("")}</tbody></table></div>`,true)
}
async function loadLeaderRoster(){const cid=$("#v14-leader-class").value,box=$("#v14-roster");if(!cid){toast("เลือกห้องก่อน",true);return}box.innerHTML="กำลังโหลด...";const {data,error}=await client().rpc("admin_classroom_roster",{p_classroom_id:cid});if(error){box.innerHTML=`<div class="alert error">${esc(errorText(error))}</div>`;return}box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ระดับ</th><th>สิทธิ์</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${esc(x.grade_level||"")}${esc(x.room_label||"")}</td><td><button class="btn sm ${x.is_leader?"red":"green"}" data-v14-leader-user="${x.user_id}" data-class="${cid}" data-active="${x.is_leader?"false":"true"}">${x.is_leader?"ยกเลิกหัวหน้าห้อง":"แต่งตั้งหัวหน้าห้อง"}</button></td></tr>`).join("")}</tbody></table></div>`}

// ---------------------------------------------------------------------------
// Promotion Admin approval flow
// ---------------------------------------------------------------------------
async function renderPromotion(){
  setTitle("เลื่อนชั้น / ปีการศึกษา");busy("กำลังโหลดรายการเลื่อนชั้น...");const c=client();const {data,error}=await c.from("promotion_batches").select("*").order("created_at",{ascending:false}).limit(20);if(error)throw error;const batches=data||[];
  let current=batches[0]||null,items=[];if(current){const ir=await c.from("promotion_items").select("*").eq("batch_id",current.id).order("full_name");items=ir.data||[]}
  const years=await c.from("classrooms").select("academic_year").not("academic_year","is",null).order("academic_year",{ascending:false}).limit(1);const source=years.data?.[0]?.academic_year||"2569",target=String((Number(source)||2569)+1);
  content().innerHTML=`<section class="v14-page"><div class="v14-section-head"><div><span class="v14-kicker">ADMIN APPROVAL REQUIRED</span><h1>ระบบเลื่อนชั้น</h1><p>ไม่มีการเลื่อนอัตโนมัติโดยไม่อนุมัติ • เก็บประวัติเดิมทั้งหมด</p></div><button class="btn primary" id="v14-new-promotion">＋ เตรียมปีการศึกษาใหม่</button></div>${current?`<div class="card v14-promotion-head"><div><b>ชุดล่าสุด: ${esc(current.source_academic_year||"-")} → ${esc(current.target_academic_year)}</b><span class="v14-status ${current.status}">${esc(current.status)}</span><small>สร้าง ${fmt(current.created_at)}</small></div><div class="row">${current.status==="draft"?`<button class="btn green" id="v14-approve-promotion">อนุมัติรายการ</button>`:""}${current.status==="approved"?`<button class="btn primary" id="v14-apply-promotion">ดำเนินการเลื่อนชั้นจริง</button>`:""}${!["applied","cancelled"].includes(current.status)?`<button class="btn red" id="v14-cancel-promotion">ยกเลิกชุด</button>`:""}</div></div><div class="table-wrap"><table><thead><tr><th>รหัส</th><th>นักศึกษา</th><th>เดิม</th><th>ผลที่เสนอ</th><th>การตัดสินใจ</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.student_code||"")}</td><td><b>${esc(x.full_name||"")}</b></td><td>${esc(x.old_grade_level||"")}${esc(x.old_room_label||"")}</td><td>${esc(x.new_grade_level||"")} ${esc(x.new_room_label||"")}</td><td>${current.status==="draft"?`<select class="input" data-v14-promotion-item="${x.id}"><option value="promote" ${x.decision==="promote"?"selected":""}>เลื่อนชั้น</option><option value="hold" ${x.decision==="hold"?"selected":""}>คงชั้น</option><option value="graduate" ${x.decision==="graduate"?"selected":""}>จบการศึกษา</option></select>`:esc(x.decision)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="v14-empty">ยังไม่มีชุดเลื่อนชั้น</div>`}</section>`;
  $("#v14-new-promotion")?.addEventListener("click",()=>promotionCreateDialog(source,target));$("#v14-approve-promotion")?.addEventListener("click",async()=>{if(!ask("ยืนยันอนุมัติรายการเลื่อนชั้นนี้? หลังอนุมัติจะไม่สามารถแก้ผลรายคนได้"))return;const r=await c.rpc("approve_promotion_batch",{p_batch_id:current.id});if(r.error){toast(errorText(r.error),true);return}toast("อนุมัติชุดเลื่อนชั้นแล้ว");renderPromotion()});$("#v14-apply-promotion")?.addEventListener("click",async()=>{if(!ask("ยืนยันดำเนินการเลื่อนชั้นจริง? ระบบจะย้ายห้อง/ระดับตามรายการที่อนุมัติ"))return;const r=await c.rpc("apply_promotion_batch",{p_batch_id:current.id});if(r.error){toast(errorText(r.error),true);return}toast(`เลื่อนชั้นสำเร็จ ${r.data?.applied_count||0} คน`);renderPromotion()});$("#v14-cancel-promotion")?.addEventListener("click",async()=>{if(!ask("ยกเลิกชุดนี้?"))return;const r=await c.rpc("cancel_promotion_batch",{p_batch_id:current.id});if(r.error){toast(errorText(r.error),true);return}renderPromotion()});
}
function promotionCreateDialog(source,target){overlay(`<div class="v14-modal-head"><div><h2>เตรียมรายการเลื่อนชั้น</h2><p>ระบบสร้างรายการให้ตรวจ ก่อน Admin อนุมัติ</p></div><button class="btn" data-v14-close>✕</button></div><form id="v14-promo-form"><label class="field">ปีการศึกษาปัจจุบัน<input class="input" name="source" value="${esc(source)}"></label><label class="field">ปีการศึกษาใหม่<input class="input" name="target" value="${esc(target)}" required></label><label class="field">หมายเหตุ<textarea class="input" name="note"></textarea></label><div class="row end"><button class="btn primary">สร้างรายการตรวจสอบ</button></div></form>`);$("#v14-promo-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const r=await client().rpc("prepare_promotion_batch",{p_source_academic_year:String(f.get("source")||""),p_target_academic_year:String(f.get("target")||""),p_note:String(f.get("note")||"")||null});if(r.error){toast(errorText(r.error),true);return}closeOverlay();toast("สร้างรายการเลื่อนชั้นแล้ว กรุณาตรวจรายชื่อ");renderPromotion()}}

// ---------------------------------------------------------------------------
// Delegated interactions (single owner)
// ---------------------------------------------------------------------------
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a");if(!t)return;
  if(t.matches("[data-v14-request-course]")){const r=await client().rpc("request_subject_enrollment",{p_subject_id:t.dataset.v14RequestCourse});if(r.error)toast(errorText(r.error),true);else{toast("ส่งคำขอลงทะเบียนแล้ว");renderEnrollSubjects()}return}
  if(t.matches("[data-v14-withdraw-course]")){if(!ask("ยืนยันถอนคำขอ/ถอนรายวิชานี้? ประวัติงานที่ส่งแล้วจะยังคงอยู่"))return;const r=await client().rpc("withdraw_subject_enrollment",{p_subject_id:t.dataset.v14WithdrawCourse});if(r.error)toast(errorText(r.error),true);else{toast("ถอนรายวิชาแล้ว");renderEnrollSubjects()}return}
  if(t.matches("[data-v14-decide-enroll]")){const st=t.dataset.status;if(!ask(st==="approved"?"อนุมัติให้นักศึกษาคนนี้เรียนรายวิชานี้?":"ไม่อนุมัติคำขอนี้?"))return;const r=await client().rpc("decide_subject_enrollment",{p_enrollment_id:t.dataset.v14DecideEnroll,p_status:st,p_note:null});if(r.error)toast(errorText(r.error),true);else{toast(st==="approved"?"อนุมัติแล้ว":"บันทึกไม่อนุมัติแล้ว");renderEnrollmentAdmin()}return}
  if(t.matches("[data-v14-admin-course]")){navigate("courses",t.dataset.v14AdminCourse);return}
  if(t.matches("[data-v14-open-course]")){navigate("courses",t.dataset.v14OpenCourse);return}
  if(t.matches("[data-v14-preview]")){previewWorksheet(t.dataset.v14Preview);return}
  if(t.matches("[data-v14-upload]")){uploadSubjectFile(t.dataset.subject,t.dataset.v14Upload,t.dataset.seq);return}
  if(t.matches("[data-v14-file]")){openSubjectFile(t.dataset.v14File);return}
  if(t.matches("[data-v14-open-work]")){if(window.DOCNR_BASE?.openWorksheet)window.DOCNR_BASE.openWorksheet(t.dataset.v14OpenWork);else toast("ตัวเปิดใบงานหลักยังโหลดไม่เสร็จ กรุณารีเฟรชหน้า",true);return}
  if(t.matches("[data-v14-select-mode]")){const mode=t.dataset.v14SelectMode;const boxes=$$(`[data-v14-wselect]`).filter(x=>x.closest(".v14-ws-section")?.querySelector(`[data-v14-select-mode="${mode}"]`));const all=boxes.every(x=>x.checked);boxes.forEach(x=>x.checked=!all);t.textContent=all?"เลือกทั้งหมด":"ยกเลิกทั้งหมด";return}
  if(t.id==="v14-bulk-release"){releaseSelected(state.subjectId);return}
  if(t.matches("[data-v14-profile]")){showAdminProfile(t.dataset.v14Profile);return}
  if(t.matches("[data-v14-session]")){loadAttendanceRoster(t.dataset.v14Session);return}
  if(t.matches("[data-v14-leader-user]")){const active=t.dataset.active==="true",r=await client().rpc("set_classroom_leader",{p_classroom_id:t.dataset.class,p_user_id:t.dataset.v14LeaderUser,p_active:active});if(r.error)toast(errorText(r.error),true);else{toast(active?"แต่งตั้งหัวหน้าห้องแล้ว":"ยกเลิกหัวหน้าห้องแล้ว");loadLeaderRoster()}return}
},false);

document.addEventListener("change",async e=>{
  const t=e.target;
  if(t.matches("[data-v14-promotion-item]")){const r=await client().rpc("set_promotion_item_decision",{p_item_id:t.dataset.v14PromotionItem,p_decision:t.value});if(r.error){toast(errorText(r.error),true);renderPromotion()}else toast("บันทึกการตัดสินใจแล้ว");return}
  if(t.matches("[data-v14-att-status]")){const note=prompt("หมายเหตุการแก้สถานะ (ไม่บังคับ)","")||null;const r=await client().rpc("set_attendance_record_status",{p_record_id:t.dataset.v14AttStatus,p_status:t.value,p_note:note});if(r.error){toast(errorText(r.error),true);loadAttendanceRoster(t.dataset.session);return}toast("แก้สถานะการเข้าเรียนแล้ว");loadAttendanceRoster(t.dataset.session)}
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot(){
  document.documentElement.classList.add("v14-tech");document.documentElement.dataset.docnrVersion="v14.1";
  await syncServerTime();startHeartbeat();scheduleEnsureNav();
  setTimeout(async()=>{const p=await getProfile(true);if(!p)return;await ensureNav();const active=$("#sidebar .nav [data-route].active");if(active?.dataset.route==="dashboard"||!active)navigate("dashboard")},700);
}

window.DOCNR_V14=Object.freeze({navigate,version:V14_VERSION});
window.addEventListener("pagehide",()=>{stopScanner();clearPresenceChannel()});
boot().catch(e=>console.error("DOC-FULL-NR V14 boot",e));
