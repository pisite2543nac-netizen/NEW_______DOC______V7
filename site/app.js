import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

const S={
  session:null, profile:null, route:"dashboard", installPrompt:null,
  editor:null, pendingWorksheet:new URLSearchParams(location.search).get("worksheet"),
  autosaveTimer:null
};

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const uid=()=>S.session?.user?.id||null;
const isAdmin=()=>S.profile?.role==="admin";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeName=s=>String(s||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120);
const dtLocal=d=>d?new Date(new Date(d).getTime()-new Date(d).getTimezoneOffset()*60000).toISOString().slice(0,16):"";

function toast(msg,type=""){
  const e=$("#toast"); if(!e)return;
  e.textContent=msg; e.className="toast show"+(type?" "+type:"");
  clearTimeout(toast.t); toast.t=setTimeout(()=>{e.className="toast"},3300);
}
function friendlyError(err){
  const m=String(err?.message||err||"เกิดข้อผิดพลาด");
  const map={
    ADMIN_REQUIRED:"ต้องเป็นผู้ดูแลระบบ",
    AUTH_REQUIRED:"กรุณาเข้าสู่ระบบใหม่",
    INVALID_SCHEDULE:"กรุณากำหนดเวลาเปิดและกำหนดส่งให้ถูกต้อง",
    NO_TARGETS:"ยังไม่มีผู้เรียนเป้าหมาย กรุณาสร้างผู้เรียน/กำหนดห้องก่อน Publish",
    NOT_ASSIGNED:"ใบงานนี้ไม่ได้มอบหมายให้บัญชีนี้",
    WORKSHEET_UNAVAILABLE:"ใบงานนี้ยังไม่เปิดให้ใช้งาน",
    NOT_OPEN:"ยังไม่ถึงเวลาเปิดทำใบงาน",
    DEADLINE_PASSED:"พ้นกำหนดส่งแล้ว",
    ALREADY_SUBMITTED:"งานนี้ส่งแล้ว",
    ATTEMPT_LIMIT:"ส่งงานครบจำนวนครั้งที่กำหนดแล้ว",
    WRONG_MODE:"รูปแบบใบงานไม่ตรงกับวิธีส่ง",
    INVALID_CODE:"รหัสงานกระดาษไม่ถูกต้อง",
    ROLE_CHANGE_NOT_ALLOWED:"ไม่อนุญาตให้เปลี่ยนสิทธิ์ด้วยบัญชีผู้ใช้ทั่วไป"
  };
  for(const [k,v] of Object.entries(map))if(m.includes(k))return v;
  return m;
}
function modal(html,{wide=false}={}){
  closeModal();
  document.body.insertAdjacentHTML("beforeend",`<div class="modal-bg" id="modalbg"><div class="modal ${wide?"wide":""}">${html}</div></div>`);
  $$("[data-close]",$("#modalbg")).forEach(b=>b.onclick=closeModal);
}
function closeModal(){ clearTimeout(S.autosaveTimer); $("#modalbg")?.remove(); }
function ask(msg){return confirm(msg)}

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();S.installPrompt=e;if(S.session)renderShell()});
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(console.warn);

async function loadProfile(retries=8){
  if(!uid())return null;
  for(let i=0;i<retries;i++){
    const {data,error}=await sb.from("profiles").select("*").eq("id",uid()).maybeSingle();
    if(data){S.profile=data;return data}
    if(error)console.warn(error);
    await sleep(250);
  }
  S.profile=null; return null;
}
async function init(){
  const {data}=await sb.auth.getSession();
  S.session=data.session;
  if(S.session)await loadProfile();

  sb.auth.onAuthStateChange((_event,session)=>{
    S.session=session;
    setTimeout(async()=>{
      if(session)await loadProfile(); else S.profile=null;
      render();
    },0);
  });
  render();
}
function render(){S.session?renderShell():renderAuth()}

function renderAuth(){
  $("#app").innerHTML=`<div class="auth-wrap"><div class="auth-card">
    <div class="brand"><div class="logo">NR</div><div><h2>DOC-FULL-NR</h2><div class="muted">Smart Worksheet • Universal PWA</div></div></div>
    <div class="alert" style="margin-top:18px"><b>ระบบจริงเชื่อม Supabase แล้ว</b><div class="smalltext">ฐานข้อมูล • Auth • Storage • Security RLS</div></div>
    <div id="authmsg"></div>
    <form id="login">
      <div class="field"><label>อีเมล</label><input name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label>รหัสผ่าน</label><input name="password" type="password" autocomplete="current-password" required minlength="8"></div>
      <button class="btn primary w100" id="loginbtn">เข้าสู่ระบบ</button>
    </form>
    <div class="row center" style="margin-top:14px"><button id="show-signup" class="btn sm ghost">สมัครผู้ใช้ใหม่</button><button id="forgot" class="btn sm ghost">ลืมรหัสผ่าน</button></div>
  </div></div>`;

  $("#login").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target), btn=$("#loginbtn");
    btn.disabled=true; btn.textContent="กำลังเข้าสู่ระบบ...";
    const {error}=await sb.auth.signInWithPassword({email:String(f.get("email")).trim(),password:String(f.get("password"))});
    if(error){$("#authmsg").innerHTML=`<div class="alert error">${esc(friendlyError(error))}</div>`;btn.disabled=false;btn.textContent="เข้าสู่ระบบ"}
  };
  $("#show-signup").onclick=signupDialog;
  $("#forgot").onclick=async()=>{
    const email=prompt("กรอกอีเมลสำหรับรีเซ็ตรหัสผ่าน");
    if(!email)return;
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("?")[0]});
    toast(error?friendlyError(error):"ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว",error?"error":"");
  };
}
function signupDialog(){
  modal(`<div class="modal-header"><div><h3>สมัครผู้ใช้</h3><div class="muted">บัญชีแรกสามารถตั้งเป็น Admin คนแรกได้หลัง Login</div></div><button class="btn sm" data-close>✕</button></div>
  <form id="signup">
    <div class="field"><label>ชื่อ-สกุล</label><input name="full_name" required></div>
    <div class="field"><label>อีเมล</label><input name="email" type="email" required></div>
    <div class="field"><label>รหัสผ่าน (อย่างน้อย 8 ตัว)</label><input name="password" type="password" minlength="8" required></div>
    <div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">สมัคร</button></div>
  </form>`);
  $("#signup").onsubmit=async e=>{
    e.preventDefault(); const f=new FormData(e.target);
    const {data,error}=await sb.auth.signUp({
      email:String(f.get("email")).trim(),
      password:String(f.get("password")),
      options:{data:{full_name:String(f.get("full_name")).trim()}}
    });
    if(error)return toast(friendlyError(error),"error");
    closeModal();
    toast(data.session?"สมัครและเข้าสู่ระบบแล้ว":"สมัครแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชี");
  };
}

function navItems(){
  return isAdmin()
    ? [["dashboard","แดชบอร์ด"],["users","ผู้ใช้งาน"],["classrooms","ห้องเรียน"],["subjects","รายวิชา"],["worksheets","ใบงาน"],["grading","ตรวจงาน"],["reports","รายงาน"],["audit","Audit log"],["profile","โปรไฟล์"]]
    : [["dashboard","หน้าหลัก"],["myworks","ใบงานของฉัน"],["scan","ยืนยันงานกระดาษ"],["profile","โปรไฟล์"]];
}
function installGuide(){
  if(S.installPrompt){
    S.installPrompt.prompt();
    S.installPrompt.userChoice.finally(()=>{S.installPrompt=null});
    return;
  }
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  modal(`<div class="modal-header"><div><h3>ติดตั้ง DOC-FULL-NR</h3><div class="muted">ใช้งานเหมือนแอปบนอุปกรณ์ของคุณ</div></div><button class="btn sm" data-close>✕</button></div>
    <div class="help-steps">
      ${ios?`<div><div><b>เปิดด้วย Safari</b><p class="muted">ใช้ Safari เพื่อเพิ่มแอปบน iPhone/iPad</p></div></div><div><div><b>กด Share</b><p class="muted">เลือก “Add to Home Screen / เพิ่มไปยังหน้าจอโฮม”</p></div></div>`:
      `<div><div><b>Chrome / Edge</b><p class="muted">เปิดเมนูเบราว์เซอร์ แล้วเลือก Install app / ติดตั้งแอป</p></div></div><div><div><b>Android</b><p class="muted">เลือก Add to Home screen หรือ Install app</p></div></div>`}
      <div><div><b>ข้อมูลเดียวกันทุกเครื่อง</b><p class="muted">เข้าสู่ระบบด้วยบัญชีเดิม ข้อมูลจะมาจาก Supabase ชุดเดียวกัน</p></div></div>
    </div>`);
}
function renderShell(){
  const items=navItems();
  if(!items.some(x=>x[0]===S.route))S.route="dashboard";
  $("#app").innerHTML=`<div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="logo">NR</div><div><b>DOC-FULL-NR</b><div class="smalltext" style="color:#94a3b8">${isAdmin()?"ADMIN":"USER"} • V7 FINAL</div></div></div>
      <nav class="nav">${items.map(x=>`<button data-route="${x[0]}" class="${S.route===x[0]?"active":""}">${x[1]}</button>`).join("")}</nav>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="row"><button class="btn mobile-menu" id="menubtn">☰</button><b id="pagetitle"></b></div>
        <div class="row">
          <button class="btn install sm" id="install">ติดตั้งแอป</button>
          <span class="muted user-name">${esc(S.profile?.full_name||S.session?.user?.email||"")}</span>
          <button class="btn sm" id="logout">ออกจากระบบ</button>
        </div>
      </header>
      <section class="content" id="content"><div class="card">กำลังโหลด...</div></section>
    </main>
  </div>`;

  $$("[data-route]").forEach(b=>b.onclick=()=>{S.route=b.dataset.route;$("#sidebar")?.classList.remove("open");renderShell()});
  $("#logout").onclick=()=>sb.auth.signOut();
  $("#menubtn").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#install").onclick=installGuide;
  route();

  if(S.pendingWorksheet&&!isAdmin()){
    const id=S.pendingWorksheet; S.pendingWorksheet=null;
    setTimeout(()=>openWorksheet(id),250);
  }
}
async function route(){
  const title=Object.fromEntries(navItems())[S.route]||"";
  $("#pagetitle").textContent=title;
  const f={dashboard,users,classrooms,subjects,worksheets,grading,reports,audit,profile,myworks,scan}[S.route]||dashboard;
  try{await f()}catch(e){
    console.error(e);
    $("#content").innerHTML=`<div class="alert error"><b>เกิดข้อผิดพลาด</b><div>${esc(friendlyError(e))}</div></div>`;
  }
}

async function dashboard(){
  if(isAdmin()){
    const [u,w,s,sub,c]=await Promise.all([
      sb.from("profiles").select("*",{count:"exact",head:true}),
      sb.from("worksheets").select("*",{count:"exact",head:true}),
      sb.from("subjects").select("*",{count:"exact",head:true}),
      sb.from("submissions").select("*",{count:"exact",head:true}),
      sb.from("classrooms").select("*",{count:"exact",head:true})
    ]);
    const healthy=![u.error,w.error,s.error,sub.error,c.error].some(Boolean);
    $("#content").innerHTML=`<div class="section-head"><div><h1>แดชบอร์ด</h1><div class="muted">DOC-FULL-NR Smart Worksheet • Production</div></div><span class="badge ${healthy?"green":"red"}"><span class="status-dot"></span>&nbsp; ${healthy?"Supabase พร้อมใช้งาน":"ตรวจการเชื่อมต่อ"}</span></div>
      <div class="grid">
        <div class="card stat"><div class="muted">ผู้ใช้</div><div class="n">${u.count||0}</div></div>
        <div class="card stat"><div class="muted">ห้องเรียน</div><div class="n">${c.count||0}</div></div>
        <div class="card stat"><div class="muted">รายวิชา</div><div class="n">${s.count||0}</div></div>
        <div class="card stat"><div class="muted">ใบงาน</div><div class="n">${w.count||0}</div></div>
      </div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h3>งานที่ส่งทั้งหมด</h3><div class="stat"><div class="n">${sub.count||0}</div></div><p class="muted">Digital / Paper รวมกัน</p></div>
        <div class="card"><h3>ลำดับเริ่มใช้งานจริง</h3><div class="help-steps"><div><div>สร้างห้องเรียน</div></div><div><div>สร้างผู้เรียนและกำหนดห้อง</div></div><div><div>เปิดใบงานตั้งเวลาแล้ว Publish</div></div><div><div>ผู้เรียนส่ง → Admin ตรวจ → Report</div></div></div></div>
      </div>`;
  }else{
    const {data,error}=await sb.from("worksheets").select("id,title,due_at,mode,subjects(code,name)").eq("status","published").order("created_at",{ascending:false}).limit(12);
    if(error)throw error;
    $("#content").innerHTML=`<div class="section-head"><div><h1>หน้าหลัก</h1><div class="muted">ใบงานที่ได้รับมอบหมาย</div></div></div>
      <div class="card"><h3>ใบงานล่าสุด</h3>${(data||[]).length?(data||[]).map(w=>worksheetMiniCard(w)).join(""):`<div class="empty">ยังไม่มีใบงานที่เผยแพร่ให้บัญชีนี้</div>`}</div>`;
    $$("[data-open]").forEach(b=>b.onclick=()=>openWorksheet(b.dataset.open));
  }
}
function worksheetMiniCard(w,status=""){
  return `<div class="q-card"><div class="row between"><div><b>${esc(w.title)}</b><div class="muted">${esc(w.subjects?.code||"")} ${esc(w.subjects?.name||"")} • ${esc(w.mode||"")} • กำหนด ${fmt(w.due_at)}</div></div>${status?`<span class="badge ${status==="submitted"||status==="confirmed"||status==="graded"?"green":"gray"}">${esc(status)}</span>`:""}</div><div style="margin-top:8px"><button class="btn primary sm" data-open="${w.id}">${status==="submitted"||status==="confirmed"||status==="graded"?"ดูงาน":"เปิดทำใบงาน"}</button></div></div>`;
}

async function classrooms(){
  const {data,error}=await sb.from("classrooms").select("*").order("created_at",{ascending:false}); if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>ห้องเรียน</h1><div class="muted">จัดกลุ่มผู้เรียนเพื่อมอบหมายใบงาน</div></div><button class="btn primary" id="addroom">+ เพิ่มห้อง</button></div>
    <div class="table-wrap"><table><thead><tr><th>ชื่อห้อง</th><th>ระดับ</th><th>ภาคเรียน/ปี</th><th>สถานะ</th><th></th></tr></thead><tbody>
    ${(data||[]).map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.level||"-")}</td><td>${esc(x.semester||"-")} / ${esc(x.academic_year||"-")}</td><td><span class="badge ${x.active?"green":"gray"}">${x.active?"ใช้งาน":"ปิด"}</span></td><td><div class="row"><button class="btn sm" data-room-edit="${x.id}">แก้ไข</button><button class="btn sm ${x.active?"red":"green"}" data-room-toggle="${x.id}" data-active="${x.active}">${x.active?"ปิด":"เปิด"}</button></div></td></tr>`).join("")||`<tr><td colspan="5" class="empty">ยังไม่มีห้องเรียน</td></tr>`}
    </tbody></table></div>`;
  $("#addroom").onclick=()=>roomDialog();
  $$("[data-room-edit]").forEach(b=>b.onclick=()=>roomDialog(b.dataset.roomEdit));
  $$("[data-room-toggle]").forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=="true";const {error}=await sb.from("classrooms").update({active}).eq("id",b.dataset.roomToggle);if(error)return toast(friendlyError(error),"error");toast("อัปเดตสถานะแล้ว");classrooms()});
}
async function roomDialog(id=null){
  let x={name:"",level:"",semester:"",academic_year:"",description:""};
  if(id){const r=await sb.from("classrooms").select("*").eq("id",id).single();if(r.error)return toast(friendlyError(r.error),"error");x=r.data}
  modal(`<div class="modal-header"><div><h3>${id?"แก้ไข":"เพิ่ม"}ห้องเรียน</h3></div><button class="btn sm" data-close>✕</button></div>
    <form id="roomform"><div class="form-grid">
      <div class="field"><label>ชื่อห้อง</label><input name="name" value="${esc(x.name)}" required></div>
      <div class="field"><label>ระดับชั้น</label><input name="level" value="${esc(x.level||"")}"></div>
      <div class="field"><label>ภาคเรียน</label><input name="semester" value="${esc(x.semester||"")}"></div>
      <div class="field"><label>ปีการศึกษา</label><input name="academic_year" value="${esc(x.academic_year||"")}"></div>
      <div class="field span2"><label>รายละเอียด</label><textarea name="description">${esc(x.description||"")}</textarea></div>
    </div><div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>`);
  $("#roomform").onsubmit=async e=>{
    e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
    const r=id?await sb.from("classrooms").update(f).eq("id",id):await sb.from("classrooms").insert(f);
    if(r.error)return toast(friendlyError(r.error),"error");
    closeModal();toast("บันทึกห้องเรียนแล้ว");classrooms();
  };
}

async function subjects(){
  const {data,error}=await sb.from("subjects").select("*").order("code");if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>รายวิชา</h1><div class="muted">มีข้อมูลตั้งต้น 13 รายวิชา</div></div><button class="btn primary" id="addsub">+ เพิ่มรายวิชา</button></div>
    <div class="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อวิชา</th><th>ประเภท</th><th>สถานะ</th><th></th></tr></thead><tbody>
    ${(data||[]).map(x=>`<tr><td><b>${esc(x.code)}</b></td><td>${esc(x.name)}</td><td>${esc(x.subject_type||"subject")}</td><td><span class="badge ${x.active?"green":"gray"}">${x.active?"ใช้งาน":"ปิด"}</span></td><td><div class="row"><button class="btn sm" data-sub-edit="${x.id}">แก้ไข</button><button class="btn sm ${x.active?"red":"green"}" data-sub-toggle="${x.id}" data-active="${x.active}">${x.active?"ปิด":"เปิด"}</button></div></td></tr>`).join("")}
    </tbody></table></div>`;
  $("#addsub").onclick=()=>subjectDialog();
  $$("[data-sub-edit]").forEach(b=>b.onclick=()=>subjectDialog(b.dataset.subEdit));
  $$("[data-sub-toggle]").forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=="true";const {error}=await sb.from("subjects").update({active}).eq("id",b.dataset.subToggle);if(error)return toast(friendlyError(error),"error");subjects()});
}
async function subjectDialog(id=null){
  let x={code:"",name:"",description:"",subject_type:"subject",semester:"",academic_year:""};
  if(id){const r=await sb.from("subjects").select("*").eq("id",id).single();if(r.error)return toast(friendlyError(r.error),"error");x=r.data}
  modal(`<div class="modal-header"><div><h3>${id?"แก้ไข":"เพิ่ม"}รายวิชา</h3></div><button class="btn sm" data-close>✕</button></div><form id="subform"><div class="form-grid">
    <div class="field"><label>รหัสวิชา</label><input name="code" value="${esc(x.code)}" required></div>
    <div class="field"><label>ชื่อวิชา</label><input name="name" value="${esc(x.name)}" required></div>
    <div class="field"><label>ประเภท</label><select name="subject_type"><option value="subject" ${x.subject_type==="subject"?"selected":""}>รายวิชา</option><option value="activity" ${x.subject_type==="activity"?"selected":""}>กิจกรรม</option></select></div>
    <div class="field"><label>ภาคเรียน</label><input name="semester" value="${esc(x.semester||"")}"></div>
    <div class="field"><label>ปีการศึกษา</label><input name="academic_year" value="${esc(x.academic_year||"")}"></div>
    <div class="field span2"><label>คำอธิบาย</label><textarea name="description">${esc(x.description||"")}</textarea></div>
    </div><div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>`);
  $("#subform").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const r=id?await sb.from("subjects").update(f).eq("id",id):await sb.from("subjects").insert(f);if(r.error)return toast(friendlyError(r.error),"error");closeModal();toast("บันทึกรายวิชาแล้ว");subjects()};
}

async function users(){
  const [{data:items,error},{data:rooms}]=await Promise.all([sb.from("profiles").select("*").order("created_at",{ascending:false}),sb.from("classrooms").select("*").eq("active",true).order("name")]);if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>ผู้ใช้งาน</h1><div class="muted">สร้างบัญชีและกำหนดห้องเรียน</div></div><button class="btn primary" id="createuser">+ สร้างผู้ใช้</button></div>
    <div class="toolbar"><input class="input" id="usersearch" placeholder="ค้นหาชื่อ / รหัส / ห้อง"></div>
    <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>รหัส</th><th>ห้อง</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr></thead><tbody id="userbody"></tbody></table></div>`;
  const renderRows=(q="")=>{
    const z=q.trim().toLowerCase();
    $("#userbody").innerHTML=(items||[]).filter(x=>!z||[x.full_name,x.username,x.student_code,x.class_name].some(v=>String(v||"").toLowerCase().includes(z))).map(x=>`<tr>
      <td><b>${esc(x.full_name||"-")}</b></td><td>${esc(x.username||"-")}</td><td>${esc(x.student_code||"-")}</td><td>${esc(x.class_name||"-")}</td>
      <td><span class="badge ${x.role==="admin"?"warn":""}">${esc(x.role)}</span></td><td><span class="badge ${x.active?"green":"red"}">${x.active?"ใช้งาน":"ปิด"}</span></td>
      <td><div class="row"><button class="btn sm" data-room-user="${x.id}">กำหนดห้อง</button>${x.id!==uid()?`<button class="btn sm ${x.active?"red":"green"}" data-user-toggle="${x.id}" data-active="${x.active}">${x.active?"ปิดบัญชี":"เปิดบัญชี"}</button>`:""}</div></td>
    </tr>`).join("")||`<tr><td colspan="7" class="empty">ไม่พบผู้ใช้</td></tr>`;
    $$("[data-room-user]").forEach(b=>b.onclick=()=>assignUserRoom(b.dataset.roomUser,items.find(x=>x.id===b.dataset.roomUser),rooms||[]));
    $$("[data-user-toggle]").forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=="true";const {error}=await sb.from("profiles").update({active}).eq("id",b.dataset.userToggle);if(error)return toast(friendlyError(error),"error");toast("อัปเดตบัญชีแล้ว");users()});
  };
  renderRows();$("#usersearch").oninput=e=>renderRows(e.target.value);
  $("#createuser").onclick=()=>createUserDialog(rooms||[]);
}
function createUserDialog(rooms){
  modal(`<div class="modal-header"><div><h3>สร้างผู้ใช้</h3><div class="muted">ระบบจะสร้าง Supabase Auth และ Profile พร้อมกัน</div></div><button class="btn sm" data-close>✕</button></div>
    <form id="cu"><div class="form-grid">
      <div class="field"><label>ชื่อ-สกุล</label><input name="full_name" required></div>
      <div class="field"><label>ชื่อผู้ใช้</label><input name="username" required></div>
      <div class="field"><label>อีเมล (ไม่บังคับ)</label><input name="email" type="email" placeholder="เว้นว่างได้"></div>
      <div class="field"><label>รหัสนักศึกษา</label><input name="student_code"></div>
      <div class="field"><label>ห้องเรียน</label><select name="classroom_id"><option value="">ยังไม่กำหนด</option>${rooms.map(r=>`<option value="${r.id}" data-name="${esc(r.name)}">${esc(r.name)}</option>`).join("")}</select></div>
      <div class="field"><label>รหัสผ่านเริ่มต้น</label><input name="password" type="password" minlength="8" required></div>
      <div class="field"><label>สิทธิ์</label><select name="role"><option value="user">user</option><option value="admin">admin</option></select></div>
    </div><div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">สร้างบัญชี</button></div></form>`,{wide:true});
  $("#cu").onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target);const roomId=String(f.get("classroom_id")||"");const room=rooms.find(r=>r.id===roomId);
    const body={full_name:f.get("full_name"),username:f.get("username"),email:f.get("email"),student_code:f.get("student_code"),class_name:room?.name||null,password:f.get("password"),role:f.get("role")};
    const {data,error}=await sb.functions.invoke("admin-create-user",{body});
    if(error||data?.error)return toast(friendlyError(data?.error||error),"error");
    if(roomId&&data?.id){
      const m=await sb.from("classroom_memberships").upsert({classroom_id:roomId,user_id:data.id,active:true},{onConflict:"classroom_id,user_id"});
      if(m.error)toast("สร้างผู้ใช้แล้ว แต่กำหนดห้องไม่สำเร็จ: "+friendlyError(m.error),"error");
    }
    closeModal();toast("สร้างผู้ใช้สำเร็จ");users();
  };
}
async function assignUserRoom(userId,user,rooms){
  const {data:memberships}=await sb.from("classroom_memberships").select("*").eq("user_id",userId).eq("active",true);
  const current=memberships?.[0]?.classroom_id||"";
  modal(`<div class="modal-header"><div><h3>กำหนดห้องเรียน</h3><div class="muted">${esc(user?.full_name||user?.username||"")}</div></div><button class="btn sm" data-close>✕</button></div>
    <form id="assignroom"><div class="field"><label>ห้องเรียน</label><select name="room"><option value="">ไม่กำหนด</option>${rooms.map(r=>`<option value="${r.id}" ${current===r.id?"selected":""}>${esc(r.name)}</option>`).join("")}</select></div>
    <div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>`);
  $("#assignroom").onsubmit=async e=>{
    e.preventDefault();const roomId=String(new FormData(e.target).get("room")||"");
    if(memberships?.length)await sb.from("classroom_memberships").update({active:false}).eq("user_id",userId);
    const room=rooms.find(r=>r.id===roomId);
    if(roomId){const r=await sb.from("classroom_memberships").upsert({classroom_id:roomId,user_id:userId,active:true},{onConflict:"classroom_id,user_id"});if(r.error)return toast(friendlyError(r.error),"error")}
    const p=await sb.from("profiles").update({class_name:room?.name||null}).eq("id",userId);if(p.error)return toast(friendlyError(p.error),"error");
    closeModal();toast("กำหนดห้องแล้ว");users();
  };
}

async function worksheets(){
  const {data,error}=await sb.from("worksheets").select("*,subjects(code,name),classrooms(name)").order("created_at",{ascending:false});if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>ใบงาน</h1><div class="muted">Digital / Paper • ตั้งเวลา • Publish • QR</div></div><button class="btn primary" id="addw">+ สร้างใบงาน</button></div>
    <div class="toolbar"><input id="wssearch" class="input" placeholder="ค้นหาชื่อใบงาน / วิชา"><select id="wsstatus" class="input" style="max-width:180px"><option value="">ทุกสถานะ</option><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>ใบงาน</th><th>วิชา/ห้อง</th><th>รูปแบบ</th><th>สถานะ</th><th>เวลา</th><th>จัดการ</th></tr></thead><tbody id="wsbody"></tbody></table></div>`;
  const draw=()=>{
    const q=$("#wssearch").value.toLowerCase(),st=$("#wsstatus").value;
    const rows=(data||[]).filter(w=>(!q||[w.title,w.subjects?.code,w.subjects?.name].some(v=>String(v||"").toLowerCase().includes(q)))&&(!st||w.status===st));
    $("#wsbody").innerHTML=rows.map(w=>`<tr><td><b>${esc(w.title)}</b><div class="smalltext muted">${esc(w.description||"")}</div></td>
      <td>${esc(w.subjects?.code||"-")} ${esc(w.subjects?.name||"")}<div class="smalltext muted">${esc(w.classrooms?.name||"ทุก/ตามการมอบหมาย")}</div></td>
      <td><span class="badge">${esc(w.mode)}</span></td><td><span class="badge ${w.status==="published"?"green":w.status==="archived"?"gray":"warn"}">${esc(w.status)}</span></td>
      <td><div class="smalltext">เปิด: ${fmt(w.open_at)}</div><div class="smalltext">ส่ง: ${fmt(w.due_at)}</div></td>
      <td><div class="row"><button class="btn sm" data-edit="${w.id}">แก้ไข</button><button class="btn sm ${w.status==="published"?"warn":"green"}" data-pub="${w.id}">${w.status==="published"?"ยกเลิก Publish":"Publish"}</button><button class="btn sm" data-print="${w.id}">พิมพ์/QR</button>${w.mode==="paper"?`<button class="btn sm" data-token="${w.id}">รหัสกระดาษ</button>`:""}<button class="btn sm red" data-archive="${w.id}">Archive</button></div></td></tr>`).join("")||`<tr><td colspan="6" class="empty">ไม่พบใบงาน</td></tr>`;
    $$("[data-edit]").forEach(b=>b.onclick=()=>worksheetEditor(b.dataset.edit));
    $$("[data-pub]").forEach(b=>b.onclick=()=>togglePublish(b.dataset.pub,data.find(x=>x.id===b.dataset.pub)));
    $$("[data-print]").forEach(b=>b.onclick=()=>printWorksheet(b.dataset.print));
    $$("[data-token]").forEach(b=>b.onclick=()=>paperTokensDialog(b.dataset.token));
    $$("[data-archive]").forEach(b=>b.onclick=async()=>{if(!ask("ย้ายใบงานนี้ไป Archived?"))return;const {error}=await sb.from("worksheets").update({status:"archived",archived_at:new Date().toISOString()}).eq("id",b.dataset.archive);if(error)return toast(friendlyError(error),"error");worksheets()});
  };
  draw();$("#wssearch").oninput=draw;$("#wsstatus").onchange=draw;$("#addw").onclick=()=>worksheetEditor();
}
async function togglePublish(id,w){
  if(w?.status==="published"){
    const {error}=await sb.from("worksheets").update({status:"draft",published_at:null}).eq("id",id);
    if(error)return toast(friendlyError(error),"error");toast("ยกเลิกการเผยแพร่แล้ว");return worksheets();
  }
  if(!w?.open_at||!w?.due_at)return toast("กรุณาแก้ไขใบงานและกำหนดเวลาเปิด/กำหนดส่งก่อน Publish","error");
  const {error}=await sb.rpc("publish_worksheet",{p_worksheet_id:id,p_classroom_ids:w.classroom_id?[w.classroom_id]:[],p_user_ids:[]});
  if(error)return toast(friendlyError(error),"error");
  toast("Publish และมอบหมายใบงานสำเร็จ");worksheets();
}

function newQuestion(type="text"){
  return {id:"q"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type,text:"",points:1,required:true,options:type==="choice"?["ตัวเลือก 1","ตัวเลือก 2"]:[]};
}
async function worksheetEditor(id=null){
  const [{data:subs},{data:rooms}]=await Promise.all([sb.from("subjects").select("*").eq("active",true).order("code"),sb.from("classrooms").select("*").eq("active",true).order("name")]);
  let w={title:"",description:"",instructions:"",subject_id:"",classroom_id:"",mode:"digital",status:"draft",open_at:"",due_at:"",allow_draft:true,allow_late:false,allow_resubmit:false,max_attempts:1,copy_paste_allowed:true,questions:[newQuestion()]};
  let key={answer_key:{},rubric:{}};
  if(id){
    const [wr,kr]=await Promise.all([sb.from("worksheets").select("*").eq("id",id).single(),sb.from("worksheet_answer_keys").select("*").eq("worksheet_id",id).maybeSingle()]);
    if(wr.error)return toast(friendlyError(wr.error),"error");w=wr.data;if(kr.data)key=kr.data;
  }
  S.editor={id,w,questions:Array.isArray(w.questions)&&w.questions.length?w.questions.map(q=>({...q,options:[...(q.options||[])]})):[newQuestion()],answer_key:{...(key.answer_key||{})},rubric:key.rubric||{}};
  modal(`<div class="modal-header"><div><h2>${id?"แก้ไข":"สร้าง"}ใบงาน</h2><div class="muted">เฉลย/Rubric แยกเก็บในตาราง Admin-only</div></div><button class="btn sm" data-close>✕</button></div>
    <form id="wf">
      <div class="form-grid">
        <div class="field span2"><label>ชื่อใบงาน</label><input name="title" value="${esc(w.title||"")}" required></div>
        <div class="field"><label>รายวิชา</label><select name="subject_id" required><option value="">เลือก</option>${(subs||[]).map(x=>`<option value="${x.id}" ${w.subject_id===x.id?"selected":""}>${esc(x.code)} ${esc(x.name)}</option>`).join("")}</select></div>
        <div class="field"><label>ห้องเรียนเป้าหมาย</label><select name="classroom_id"><option value="">ผู้ใช้ทั้งหมด/กำหนดภายหลัง</option>${(rooms||[]).map(x=>`<option value="${x.id}" ${w.classroom_id===x.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div>
        <div class="field"><label>รูปแบบ</label><select name="mode"><option value="digital" ${w.mode==="digital"?"selected":""}>Digital</option><option value="paper" ${w.mode==="paper"?"selected":""}>Paper</option></select></div>
        <div class="field"><label>จำนวนครั้งสูงสุด</label><input name="max_attempts" type="number" min="1" value="${Number(w.max_attempts||1)}"></div>
        <div class="field"><label>เวลาเปิดทำ</label><input name="open_at" type="datetime-local" value="${dtLocal(w.open_at)}"></div>
        <div class="field"><label>กำหนดส่ง</label><input name="due_at" type="datetime-local" value="${dtLocal(w.due_at)}"></div>
        <div class="field span2"><label>คำอธิบาย</label><textarea name="description">${esc(w.description||"")}</textarea></div>
        <div class="field span2"><label>คำชี้แจง</label><textarea name="instructions">${esc(w.instructions||"")}</textarea></div>
      </div>
      <div class="divider"></div>
      <div class="row between"><div><h3>คำถาม</h3><div class="muted smalltext">เพิ่ม/ลบ/เปลี่ยนชนิดได้ ไม่ต้องเขียน JSON</div></div><button type="button" class="btn primary sm" id="addq">+ เพิ่มคำถาม</button></div>
      <div id="questionbuilder" class="question-builder"></div>
      <div class="field"><label>Rubric (JSON — ไม่บังคับ)</label><textarea class="code" name="rubric">${esc(JSON.stringify(S.editor.rubric||{},null,2))}</textarea></div>
      <div class="checks"><label><input type="checkbox" name="allow_draft" ${w.allow_draft?"checked":""}> บันทึกร่าง</label><label><input type="checkbox" name="allow_late" ${w.allow_late?"checked":""}> ส่งช้าได้</label><label><input type="checkbox" name="allow_resubmit" ${w.allow_resubmit?"checked":""}> ส่งซ้ำได้</label><label><input type="checkbox" name="copy_paste_allowed" ${w.copy_paste_allowed?"checked":""}> Copy/Paste</label></div>
      <div class="field"><label>ไฟล์ประกอบใบงาน (ไม่บังคับ, สูงสุด 20MB)</label><input id="worksheetfile" type="file"></div>
      <div class="row end"><button type="button" class="btn" data-close>ยกเลิก</button><button class="btn primary">บันทึกใบงาน</button></div>
    </form>`,{wide:true});
  renderQuestionBuilder();
  $("#addq").onclick=()=>{S.editor.questions.push(newQuestion());renderQuestionBuilder()};
  $("#wf").onsubmit=saveWorksheetEditor;
}
function renderQuestionBuilder(){
  const root=$("#questionbuilder");if(!root||!S.editor)return;
  root.innerHTML=S.editor.questions.map((q,i)=>`<div class="q-card" data-qcard="${q.id}">
    <div class="row between"><b>ข้อ ${i+1}</b><button type="button" class="btn sm red" data-qdel="${q.id}">ลบ</button></div>
    <div class="question-row">
      <div class="field"><label>คำถาม</label><input data-qtext="${q.id}" value="${esc(q.text||"")}" placeholder="พิมพ์คำถาม"></div>
      <div class="field"><label>ชนิด</label><select data-qtype="${q.id}"><option value="text" ${q.type==="text"?"selected":""}>คำตอบสั้น</option><option value="textarea" ${q.type==="textarea"?"selected":""}>คำตอบยาว</option><option value="choice" ${q.type==="choice"?"selected":""}>ตัวเลือก</option></select></div>
      <div class="field"><label>คะแนน</label><input data-qpoints="${q.id}" type="number" min="0" step="0.5" value="${Number(q.points||0)}"></div>
    </div>
    ${q.type==="choice"?`<div class="field"><label>ตัวเลือก (1 บรรทัดต่อ 1 ตัวเลือก)</label><textarea data-qopts="${q.id}">${esc((q.options||[]).join("\n"))}</textarea></div>`:""}
    <div class="form-grid"><div class="field"><label>เฉลย (Admin เท่านั้น)</label><input data-qanswer="${q.id}" value="${esc(S.editor.answer_key[q.id]??"")}"></div><div class="field"><label>การตอบ</label><select data-qrequired="${q.id}"><option value="1" ${q.required!==false?"selected":""}>บังคับตอบ</option><option value="0" ${q.required===false?"selected":""}>ไม่บังคับ</option></select></div></div>
  </div>`).join("");
  $$("[data-qdel]",root).forEach(b=>b.onclick=()=>{if(S.editor.questions.length<=1)return toast("ต้องมีอย่างน้อย 1 คำถาม","error");S.editor.questions=S.editor.questions.filter(q=>q.id!==b.dataset.qdel);delete S.editor.answer_key[b.dataset.qdel];renderQuestionBuilder()});
  $$("[data-qtext]",root).forEach(x=>x.oninput=e=>S.editor.questions.find(q=>q.id===x.dataset.qtext).text=e.target.value);
  $$("[data-qpoints]",root).forEach(x=>x.oninput=e=>S.editor.questions.find(q=>q.id===x.dataset.qpoints).points=Number(e.target.value||0));
  $$("[data-qrequired]",root).forEach(x=>x.onchange=e=>S.editor.questions.find(q=>q.id===x.dataset.qrequired).required=e.target.value==="1");
  $$("[data-qanswer]",root).forEach(x=>x.oninput=e=>S.editor.answer_key[x.dataset.qanswer]=e.target.value);
  $$("[data-qopts]",root).forEach(x=>x.oninput=e=>S.editor.questions.find(q=>q.id===x.dataset.qopts).options=e.target.value.split("\n").map(s=>s.trim()).filter(Boolean));
  $$("[data-qtype]",root).forEach(x=>x.onchange=e=>{const q=S.editor.questions.find(q=>q.id===x.dataset.qtype);q.type=e.target.value;if(q.type==="choice"&&(!q.options||!q.options.length))q.options=["ตัวเลือก 1","ตัวเลือก 2"];renderQuestionBuilder()});
}
async function saveWorksheetEditor(e){
  e.preventDefault();const f=new FormData(e.target),ed=S.editor;
  const open=f.get("open_at")?new Date(String(f.get("open_at"))):null,due=f.get("due_at")?new Date(String(f.get("due_at"))):null;
  if(open&&due&&due<=open)return toast("กำหนดส่งต้องอยู่หลังเวลาเปิดทำ","error");
  if(ed.questions.some(q=>!String(q.text||"").trim()))return toast("กรุณากรอกข้อความคำถามให้ครบ","error");
  let rubric={};try{rubric=JSON.parse(String(f.get("rubric")||"{}"))}catch{return toast("Rubric JSON ไม่ถูกต้อง","error")}
  const payload={
    title:String(f.get("title")).trim(),subject_id:f.get("subject_id")||null,classroom_id:f.get("classroom_id")||null,
    mode:f.get("mode"),description:f.get("description")||null,instructions:f.get("instructions")||null,
    open_at:open?open.toISOString():null,due_at:due?due.toISOString():null,questions:ed.questions,
    allow_draft:f.get("allow_draft")==="on",allow_late:f.get("allow_late")==="on",allow_resubmit:f.get("allow_resubmit")==="on",
    copy_paste_allowed:f.get("copy_paste_allowed")==="on",max_attempts:Math.max(1,Number(f.get("max_attempts")||1))
  };
  let wid=ed.id;
  if(wid){const r=await sb.from("worksheets").update(payload).eq("id",wid);if(r.error)return toast(friendlyError(r.error),"error")}
  else{const r=await sb.from("worksheets").insert({...payload,created_by:uid()}).select().single();if(r.error)return toast(friendlyError(r.error),"error");wid=r.data.id}
  const kr=await sb.from("worksheet_answer_keys").upsert({worksheet_id:wid,answer_key:ed.answer_key,rubric,updated_by:uid()});if(kr.error)return toast(friendlyError(kr.error),"error");
  const file=$("#worksheetfile")?.files?.[0];
  if(file){
    if(file.size>20*1024*1024)return toast("ไฟล์เกิน 20MB ใบงานถูกบันทึกแล้ว แต่ไฟล์ยังไม่อัปโหลด","error");
    const path=`${wid}/${Date.now()}-${safeName(file.name)}`;
    const up=await sb.storage.from("worksheet-files").upload(path,file,{upsert:false});if(up.error)return toast("บันทึกใบงานแล้ว แต่ไฟล์อัปโหลดไม่สำเร็จ: "+friendlyError(up.error),"error");
    const wr=await sb.from("worksheets").select("attachment_paths").eq("id",wid).single();
    const paths=[...(wr.data?.attachment_paths||[]),path];
    await sb.from("worksheets").update({attachment_paths:paths}).eq("id",wid);
  }
  closeModal();toast("บันทึกใบงานสำเร็จ");worksheets();
}

async function myworks(){
  const [{data:ws,error},{data:subs}]=await Promise.all([
    sb.from("worksheets").select("id,title,instructions,due_at,open_at,mode,subjects(code,name)").eq("status","published").order("due_at"),
    sb.from("submissions").select("worksheet_id,status,submitted_at,confirmed_at").eq("user_id",uid())
  ]);if(error)throw error;
  const sm=new Map((subs||[]).map(x=>[x.worksheet_id,x]));
  $("#content").innerHTML=`<div class="section-head"><div><h1>ใบงานของฉัน</h1><div class="muted">เฉพาะใบงานที่ได้รับมอบหมาย</div></div></div>
    ${(ws||[]).length?(ws||[]).map(w=>worksheetMiniCard(w,sm.get(w.id)?.status||"ยังไม่ส่ง")).join(""):`<div class="card empty">ยังไม่มีใบงานที่ได้รับมอบหมาย</div>`}`;
  $$("[data-open]").forEach(b=>b.onclick=()=>openWorksheet(b.dataset.open));
}
async function signedLinks(bucket,paths){
  const out=[];for(const p of paths||[]){const r=await sb.storage.from(bucket).createSignedUrl(p,3600);if(!r.error&&r.data?.signedUrl)out.push({path:p,url:r.data.signedUrl})}return out;
}
function questionInput(q,i,val=""){
  const name=`q_${q.id}`,req=q.required!==false?"required":"";
  if(q.type==="choice")return`<div class="q-card"><div class="q-title">${i+1}. ${esc(q.text)} <span class="muted">(${Number(q.points||0)} คะแนน)</span></div><div class="choice-list">${(q.options||[]).map(o=>`<label><input type="radio" name="${name}" value="${esc(o)}" ${String(val)===String(o)?"checked":""} ${req}> ${esc(o)}</label>`).join("")}</div></div>`;
  if(q.type==="textarea")return`<div class="q-card"><div class="q-title">${i+1}. ${esc(q.text)} <span class="muted">(${Number(q.points||0)} คะแนน)</span></div><textarea name="${name}" class="input" style="min-height:110px" ${req}>${esc(val)}</textarea></div>`;
  return`<div class="q-card"><div class="q-title">${i+1}. ${esc(q.text)} <span class="muted">(${Number(q.points||0)} คะแนน)</span></div><input name="${name}" class="input" value="${esc(val)}" ${req}></div>`;
}
async function openWorksheet(id){
  const [{data:w,error},{data:old}]=await Promise.all([
    sb.from("worksheets").select("*,subjects(code,name)").eq("id",id).single(),
    sb.from("submissions").select("*").eq("worksheet_id",id).eq("user_id",uid()).maybeSingle()
  ]);if(error)return toast(friendlyError(error),"error");
  const locked=old&&["submitted","confirmed","graded"].includes(old.status);
  const files=await signedLinks("worksheet-files",w.attachment_paths||[]);
  const now=Date.now(),openAt=w.open_at?new Date(w.open_at).getTime():null,dueAt=w.due_at?new Date(w.due_at).getTime():null;
  const notOpen=openAt&&now<openAt;
  modal(`<div class="modal-header"><div><h2>${esc(w.title)}</h2><div class="muted">${esc(w.subjects?.code||"")} ${esc(w.subjects?.name||"")} • ${esc(w.mode)} • กำหนด ${fmt(w.due_at)}</div></div><button class="btn sm" data-close>✕</button></div>
    ${notOpen?`<div class="alert warn">ยังไม่ถึงเวลาเปิดทำ: ${fmt(w.open_at)}</div>`:""}
    ${locked?`<div class="alert success">สถานะ: ${esc(old.status)} ${old.submitted_at?`• ส่ง ${fmt(old.submitted_at)}`:""}</div>`:""}
    <p>${esc(w.instructions||"")}</p>
    ${files.length?`<div class="file-list"><b>ไฟล์ประกอบ</b>${files.map((f,i)=>`<div class="file-chip"><span>ไฟล์ ${i+1}</span><a class="btn sm" href="${f.url}" target="_blank" rel="noopener">เปิดไฟล์</a></div>`).join("")}</div>`:""}
    <form id="ans">${(w.questions||[]).map((q,i)=>questionInput(q,i,old?.answers?.[q.id])).join("")}
      ${w.mode==="digital"?`<div class="field"><label>แนบไฟล์คำตอบ (ไม่บังคับ, สูงสุด 20MB)</label><input id="attach" type="file" ${locked||notOpen?"disabled":""}></div>
      <div class="autosave" id="autosave">${w.allow_draft&&!locked?"ระบบจะบันทึกร่างอัตโนมัติเมื่อพิมพ์":" "}</div>
      <div class="row end"><button type="button" class="btn" data-close>ปิด</button><button class="btn" name="action" value="draft" ${locked||notOpen||!w.allow_draft?"disabled":""}>บันทึกร่าง</button><button class="btn green" name="action" value="submit" ${locked||notOpen?"disabled":""}>ส่งงาน</button></div>`:
      `<div class="alert">ใบงานนี้เป็นแบบกระดาษ ให้ใช้เมนู “ยืนยันงานกระดาษ” และกรอกรหัสบนเอกสาร</div><div class="row end"><button type="button" class="btn" data-close>ปิด</button></div>`}
    </form>`,{wide:true});
  if(w.mode!=="digital"||locked||notOpen)return;
  const form=$("#ans");
  const collect=()=>{const f=new FormData(form),answers={};for(const q of w.questions||[])answers[q.id]=f.get("q_"+q.id)??"";return answers};
  const autosave=async()=>{
    if(!w.allow_draft)return;
    const r=await sb.rpc("save_worksheet_draft",{p_worksheet_id:id,p_answers:collect(),p_attachment_paths:old?.attachment_paths||[]});
    const st=$("#autosave");if(st)st.textContent=r.error?"บันทึกร่างอัตโนมัติไม่สำเร็จ":"บันทึกร่างล่าสุด "+new Date().toLocaleTimeString("th-TH");
  };
  form.oninput=()=>{if(!w.allow_draft)return;clearTimeout(S.autosaveTimer);S.autosaveTimer=setTimeout(autosave,1400)};
  form.onsubmit=async e=>{
    e.preventDefault();clearTimeout(S.autosaveTimer);
    const action=e.submitter?.value||"draft",answers=collect();
    let paths=[...(old?.attachment_paths||[])],file=$("#attach")?.files?.[0];
    if(file){
      if(file.size>20*1024*1024)return toast("ไฟล์เกิน 20MB","error");
      const path=`${uid()}/${id}/${Date.now()}-${safeName(file.name)}`;
      const up=await sb.storage.from("submissions").upload(path,file,{upsert:false});if(up.error)return toast(friendlyError(up.error),"error");paths.push(path);
    }
    const rpc=action==="submit"?"finalize_digital_submission":"save_worksheet_draft";
    const r=await sb.rpc(rpc,{p_worksheet_id:id,p_answers:answers,p_attachment_paths:paths});
    if(r.error)return toast(friendlyError(r.error),"error");
    toast(action==="submit"?"ส่งงานสำเร็จ":"บันทึกร่างแล้ว");closeModal();myworks();
  };
}

async function scan(){
  $("#content").innerHTML=`<div class="section-head"><div><h1>ยืนยันงานกระดาษ</h1><div class="muted">กรอกรหัส Token ที่ได้รับจากครู</div></div></div>
    <div class="card" style="max-width:650px"><form id="scanform"><div class="field"><label>รหัสงานกระดาษ</label><input name="token" placeholder="วางรหัส Token" required></div><button class="btn green">ยืนยันการส่งงานกระดาษ</button></form><div id="scanmsg"></div></div>`;
  $("#scanform").onsubmit=async e=>{e.preventDefault();const token=String(new FormData(e.target).get("token")).trim();const {data,error}=await sb.rpc("confirm_paper_submission",{p_token:token});$("#scanmsg").innerHTML=error?`<div class="alert error">${esc(friendlyError(error))}</div>`:`<div class="alert success">ยืนยันสำเร็จ เวลา ${fmt(data?.confirmed_at||new Date())}</div>`};
}

async function grading(){
  const {data,error}=await sb.from("submissions").select("*,profiles(full_name,student_code,class_name),worksheets(title,questions)").in("status",["submitted","confirmed","graded"]).order("updated_at",{ascending:false});if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>ตรวจงาน</h1><div class="muted">คะแนนและความคิดเห็นเก็บในตาราง Admin-only</div></div></div>
    <div class="table-wrap"><table><thead><tr><th>ผู้เรียน</th><th>ใบงาน</th><th>ส่งเมื่อ</th><th>สถานะ</th><th></th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><b>${esc(x.profiles?.full_name||"-")}</b><div class="muted smalltext">${esc(x.profiles?.student_code||"")} ${esc(x.profiles?.class_name||"")}</div></td><td>${esc(x.worksheets?.title||"-")}</td><td>${fmt(x.submitted_at||x.confirmed_at)}</td><td><span class="badge ${x.status==="graded"?"green":"warn"}">${esc(x.status)}</span></td><td><button class="btn primary sm" data-grade="${x.id}">ตรวจ</button></td></tr>`).join("")||`<tr><td colspan="5" class="empty">ยังไม่มีงานที่ส่ง</td></tr>`}</tbody></table></div>`;
  $$("[data-grade]").forEach(b=>b.onclick=()=>gradeDialog(b.dataset.grade));
}
async function gradeDialog(id){
  const sr=await sb.from("submissions").select("*,profiles(full_name,student_code),worksheets(*)").eq("id",id).single();if(sr.error)return toast(friendlyError(sr.error),"error");
  const s=sr.data;
  const [kr,gr,links]=await Promise.all([sb.from("worksheet_answer_keys").select("*").eq("worksheet_id",s.worksheet_id).maybeSingle(),sb.from("submission_grades").select("*").eq("submission_id",id).maybeSingle(),signedLinks("submissions",s.attachment_paths||[])]);
  const k=kr.data||{},g=gr.data;
  let auto=0,max=0;
  for(const q of s.worksheets?.questions||[]){max+=Number(q.points||0);const a=k.answer_key?.[q.id];if(a!==undefined&&String(a).trim()!==""&&String(s.answers?.[q.id]??"").trim().toLowerCase()===String(a).trim().toLowerCase())auto+=Number(q.points||0)}
  modal(`<div class="modal-header"><div><h2>ตรวจงาน: ${esc(s.profiles?.full_name||"")}</h2><div class="muted">${esc(s.worksheets?.title||"")}</div></div><button class="btn sm" data-close>✕</button></div>
    ${(s.worksheets?.questions||[]).map((q,i)=>`<div class="q-card"><b>${i+1}. ${esc(q.text)}</b><div><b>คำตอบ:</b> ${esc(s.answers?.[q.id]??"-")}</div><div class="muted"><b>เฉลย:</b> ${esc(k.answer_key?.[q.id]??"-")} • ${Number(q.points||0)} คะแนน</div></div>`).join("")}
    ${links.length?`<div class="file-list"><b>ไฟล์คำตอบ</b>${links.map((f,i)=>`<div class="file-chip"><span>ไฟล์ ${i+1}</span><a class="btn sm" href="${f.url}" target="_blank" rel="noopener">เปิด</a></div>`).join("")}</div>`:""}
    <div class="alert">คะแนนแนะนำจากคำตอบที่เทียบตรง: <b>${auto}/${max}</b> (Admin สามารถแก้ได้)</div>
    <form id="gf"><div class="form-grid">
      <div class="field"><label>คะแนน</label><input name="score" type="number" min="0" step="0.01" value="${g?.score??auto}" required></div>
      <div class="field"><label>คะแนนเต็ม</label><input name="max_score" type="number" min="0" step="0.01" value="${g?.max_score??max}" required></div>
      <div class="field"><label>เกรด</label><input name="grade" value="${esc(g?.grade||"")}"></div>
      <div class="field span2"><label>ความคิดเห็น Admin (ผู้เรียนอ่านไม่ได้)</label><textarea name="admin_comment">${esc(g?.admin_comment||"")}</textarea></div>
    </div><div class="row end"><button type="button" class="btn" data-close>ปิด</button><button class="btn green">บันทึกผล</button></div></form>`,{wide:true});
  $("#gf").onsubmit=async e=>{
    e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
    const r=await sb.from("submission_grades").upsert({submission_id:id,score:Number(f.score),max_score:Number(f.max_score),grade:f.grade||null,admin_comment:f.admin_comment||null,graded_by:uid(),graded_at:new Date().toISOString(),grading_status:"finalized",finalized_at:new Date().toISOString()});
    if(r.error)return toast(friendlyError(r.error),"error");
    await sb.from("submissions").update({status:"graded"}).eq("id",id);
    closeModal();toast("บันทึกผลแล้ว");grading();
  };
}

async function reports(){
  const {data,error}=await sb.from("submission_grades").select("*,submissions(submitted_at,profiles(full_name,student_code,class_name),worksheets(title,subjects(code,name)))").order("graded_at",{ascending:false});if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>รายงานผล</h1><div class="muted">เฉพาะ Admin เท่านั้น</div></div><button class="btn green" id="csv">Export CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>ผู้เรียน</th><th>รหัส/ห้อง</th><th>ใบงาน</th><th>คะแนน</th><th>เกรด</th><th>ตรวจเมื่อ</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${esc(x.submissions?.profiles?.full_name||"-")}</td><td>${esc(x.submissions?.profiles?.student_code||"-")} / ${esc(x.submissions?.profiles?.class_name||"-")}</td><td>${esc(x.submissions?.worksheets?.title||"-")}</td><td><b>${x.score??"-"}/${x.max_score??"-"}</b></td><td>${esc(x.grade||"-")}</td><td>${fmt(x.graded_at)}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">ยังไม่มีผลการตรวจ</td></tr>`}</tbody></table></div>`;
  $("#csv").onclick=()=>downloadCSV([["ชื่อ","รหัส","ห้อง","วิชา","ใบงาน","คะแนน","คะแนนเต็ม","เกรด","ตรวจเมื่อ"],...(data||[]).map(x=>[x.submissions?.profiles?.full_name,x.submissions?.profiles?.student_code,x.submissions?.profiles?.class_name,x.submissions?.worksheets?.subjects?.code,x.submissions?.worksheets?.title,x.score,x.max_score,x.grade,fmt(x.graded_at)])]);
}
function downloadCSV(rows,filename=`DOC-FULL-NR-report-${Date.now()}.csv`){
  const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function audit(){
  const {data,error}=await sb.from("audit_logs").select("*,profiles(full_name)").order("created_at",{ascending:false}).limit(300);if(error)throw error;
  $("#content").innerHTML=`<div class="section-head"><div><h1>Audit log</h1><div class="muted">กิจกรรมสำคัญฝั่ง Admin/Server</div></div></div><div class="table-wrap"><table><thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>Action</th><th>Entity</th><th>รายละเอียด</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${fmt(x.created_at)}</td><td>${esc(x.profiles?.full_name||"-")}</td><td><b>${esc(x.action)}</b></td><td>${esc(x.entity_type||"")} ${esc(x.entity_id||"")}</td><td class="smalltext">${esc(JSON.stringify(x.metadata||{}))}</td></tr>`).join("")||`<tr><td colspan="5" class="empty">ยังไม่มี Audit log</td></tr>`}</tbody></table></div>`;
}

async function profile(){
  $("#content").innerHTML=`<div class="card" style="max-width:760px"><h1>โปรไฟล์</h1>
    <div class="alert"><b>สิทธิ์ปัจจุบัน:</b> ${esc(S.profile?.role||"user")} • ${S.profile?.active===false?"ปิดใช้งาน":"ใช้งาน"}</div>
    <form id="pf"><div class="form-grid">
      <div class="field"><label>ชื่อ-สกุล</label><input name="full_name" value="${esc(S.profile?.full_name||"")}"></div>
      <div class="field"><label>ชื่อผู้ใช้</label><input name="username" value="${esc(S.profile?.username||"")}"></div>
      <div class="field"><label>รหัสนักศึกษา</label><input name="student_code" value="${esc(S.profile?.student_code||"")}"></div>
      <div class="field"><label>ห้องเรียน</label><input name="class_name" value="${esc(S.profile?.class_name||"")}"></div>
    </div><button class="btn primary">บันทึกโปรไฟล์</button></form>
    ${S.profile?.role!=="admin"?`<div class="divider"></div><h3>ตั้งค่าระบบครั้งแรก</h3><p class="muted">ถ้ายังไม่มี Admin ระบบจะเลื่อนบัญชีนี้เป็น Admin คนแรก ฟังก์ชันฝั่ง Server จะปฏิเสธทันทีหากมี Admin อยู่แล้ว</p><button class="btn warn" id="bootstrap">ตั้งบัญชีนี้เป็น Admin คนแรก</button>`:""}
  </div>`;
  $("#pf").onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const {error}=await sb.from("profiles").update(v).eq("id",uid());if(error)return toast(friendlyError(error),"error");await loadProfile();toast("บันทึกโปรไฟล์แล้ว");renderShell()};
  if($("#bootstrap"))$("#bootstrap").onclick=async()=>{
    if(!ask("ยืนยันตั้งบัญชีนี้เป็น Admin คนแรก?"))return;
    const {data,error}=await sb.functions.invoke("bootstrap-admin",{body:{}});
    if(error||data?.error)return toast(friendlyError(data?.error||error),"error");
    await loadProfile();S.route="dashboard";toast("ตั้งค่า Admin สำเร็จ");renderShell();
  };
}

async function printWorksheet(id){
  const {data:w,error}=await sb.from("worksheets").select("*,subjects(code,name)").eq("id",id).single();if(error)return toast(friendlyError(error),"error");
  const link=`${location.origin}${location.pathname}?worksheet=${encodeURIComponent(w.id)}`;
  modal(`<div class="print-sheet"><div class="no-print row end"><button class="btn primary" id="printnow">พิมพ์ / Save PDF</button><button class="btn" data-close>ปิด</button></div>
    <h2>DOC-FULL-NR Smart Worksheet</h2><h1>${esc(w.title)}</h1><div>${esc(w.subjects?.code||"")} ${esc(w.subjects?.name||"")}</div><div>ชื่อ-สกุล _______________________________ ชั้น/ห้อง __________ เลขที่ ______</div>
    <p>${esc(w.instructions||"")}</p>${(w.questions||[]).map((q,i)=>`<div class="q-card"><b>${i+1}. ${esc(q.text)}</b><div class="paper-answer"></div></div>`).join("")}
    <div class="qrbox"><div id="qr"></div><div><svg id="barcode"></svg><div class="muted smalltext">Worksheet: ${esc(w.reference_code||w.id)}</div></div></div></div>`);
  if(window.QRCode)new QRCode($("#qr"),{text:link,width:128,height:128});
  try{if(window.JsBarcode)JsBarcode("#barcode",(w.reference_code||w.id.replaceAll("-","").slice(0,18)),{format:"CODE128",width:1.4,height:50,displayValue:false})}catch{}
  $("#printnow").onclick=()=>{document.body.classList.add("printing");window.print();setTimeout(()=>document.body.classList.remove("printing"),500)};
}
async function paperTokensDialog(wid){
  const ar=await sb.from("worksheet_assignments").select("user_id").eq("worksheet_id",wid);if(ar.error)return toast(friendlyError(ar.error),"error");
  const ids=(ar.data||[]).map(x=>x.user_id);
  if(!ids.length)return toast("ใบงานยังไม่มีผู้เรียนที่ได้รับมอบหมาย กรุณา Publish ก่อน","error");
  const [pr,tr]=await Promise.all([sb.from("profiles").select("id,full_name,student_code,class_name").in("id",ids),sb.from("paper_tokens").select("*").eq("worksheet_id",wid).in("user_id",ids)]);
  if(pr.error||tr.error)return toast(friendlyError(pr.error||tr.error),"error");
  const existing=new Map((tr.data||[]).map(x=>[x.user_id,x]));
  const missing=ids.filter(id=>!existing.has(id)).map(user_id=>({worksheet_id:wid,user_id,code_kind:"qr"}));
  if(missing.length){
    const ir=await sb.from("paper_tokens").insert(missing).select("*");if(ir.error)return toast(friendlyError(ir.error),"error");
    for(const x of ir.data||[])existing.set(x.user_id,x);
  }
  const rows=(pr.data||[]).map(p=>({...p,token:existing.get(p.id)?.token||""}));
  modal(`<div class="modal-header"><div><h2>รหัสงานกระดาษ</h2><div class="muted">แจก Token ให้ผู้เรียนแต่ละคน แล้วผู้เรียนยืนยันในเมนู “ยืนยันงานกระดาษ”</div></div><button class="btn sm" data-close>✕</button></div>
    <div class="row end"><button class="btn green" id="tokencsv">Export CSV</button></div>
    <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>รหัส</th><th>ห้อง</th><th>Token</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.full_name||"-")}</td><td>${esc(x.student_code||"-")}</td><td>${esc(x.class_name||"-")}</td><td><code>${esc(x.token)}</code></td></tr>`).join("")}</tbody></table></div>`,{wide:true});
  $("#tokencsv").onclick=()=>downloadCSV([["ชื่อ","รหัสนักศึกษา","ห้อง","Token"],...rows.map(x=>[x.full_name,x.student_code,x.class_name,x.token])],`paper-tokens-${wid}.csv`);
}

init();
