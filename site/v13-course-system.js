import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF="thjscmfqunlaqxlievna";
const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;
const FEATURE_VERSION="V13-COURSE-ENROLLMENT-BULK-RELEASE";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const dtLocal=d=>{
  const x=d?new Date(d):new Date();
  const local=new Date(x.getTime()-x.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
};

let profileCache=null;
let navTimer=null;
let enhanceTimer=null;
let countdownTimer=null;
let dashboardBusy=false;

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const x=JSON.parse(raw);
    return x?.access_token&&x?.user?.id?x:null;
  }catch{return null}
}
function uid(){return readSession()?.user?.id||null}
function client(){
  const s=readSession();
  return createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}}
  });
}
async function profile(force=false){
  if(!force&&profileCache)return profileCache;
  const id=uid(); if(!id)return null;
  const {data,error}=await client().from("profiles")
    .select("id,role,active,full_name,student_code,class_name,grade_level,room_label,department,major")
    .eq("id",id).maybeSingle();
  if(error)return null;
  profileCache=data||null;return profileCache;
}
function content(){return $("#content")}
function toast(message,bad=false){
  let el=$("#v13-toast");
  if(!el){el=document.createElement("div");el.id="v13-toast";document.body.appendChild(el)}
  el.textContent=message;
  el.className=`v13-toast show${bad?" bad":""}`;
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.className="v13-toast",3600);
}
function setActive(btn){
  const nav=$("#sidebar .nav");
  if(nav)$$('button',nav).forEach(x=>x.classList.remove('active'));
  btn?.classList.add('active');
}
function showModal(html,wide=false){
  closeModal();
  document.body.insertAdjacentHTML('beforeend',`<div id="v13-modal-bg" class="v13-modal-bg"><div class="v13-modal${wide?' wide':''}">${html}</div></div>`);
  $("#v13-modal-bg")?.addEventListener('click',e=>{if(e.target.id==='v13-modal-bg'||e.target.closest('[data-v13-close]'))closeModal()});
}
function closeModal(){$("#v13-modal-bg")?.remove()}
function busy(message="กำลังโหลด..."){if(content())content().innerHTML=`<div class="card v13-busy"><div class="v13-spinner"></div><b>${esc(message)}</b></div>`}
function errText(e){
  const raw=String(e?.message||e?.details||e||'เกิดข้อผิดพลาด');
  const map={
    ACTIVE_USER_REQUIRED:'บัญชีผู้เรียนยังไม่พร้อมใช้งาน',
    SUBJECT_NOT_AVAILABLE:'รายวิชานี้ไม่เปิดรับลงทะเบียน',
    ADMIN_REQUIRED:'ต้องใช้บัญชี Admin',
    INVALID_STATUS:'สถานะคำขอไม่ถูกต้อง',
    INVALID_SCHEDULE:'เวลาเปิดและกำหนดส่งไม่ถูกต้อง',
    NO_WORKSHEETS_SELECTED:'กรุณาเลือกใบงานอย่างน้อย 1 รายการ',
    WORKSHEET_SUBJECT_MISMATCH:'พบใบงานที่ไม่อยู่ในรายวิชานี้'
  };
  for(const [k,v] of Object.entries(map))if(raw.includes(k))return v;
  return raw;
}

function newNavButton(key,label){
  const b=document.createElement('button');b.type='button';b.dataset.v13Route=key;b.className='v13-nav-button';b.textContent=label;return b;
}
async function ensureNav(){
  const nav=$("#sidebar .nav");if(!nav)return;
  const p=await profile();if(!p)return;
  if(p.role==='admin'&&!nav.querySelector('[data-v13-route="enrollment-admin"]')){
    const b=newNavButton('enrollment-admin','🎓 อนุมัติรายวิชา');
    const before=nav.querySelector('[data-v12-route="promotion"]')||nav.querySelector('[data-route="profile"]');
    before?nav.insertBefore(b,before):nav.appendChild(b);
  }
  if(p.role!=='admin'&&!nav.querySelector('[data-v13-route="course-enroll"]')){
    const b=newNavButton('course-enroll','🎓 ลงทะเบียนรายวิชา');
    const before=nav.querySelector('[data-v12-route="workstatus"]')||nav.querySelector('[data-route="profile"]');
    before?nav.insertBefore(b,before):nav.appendChild(b);
  }
}
function scheduleNav(){if(navTimer)return;navTimer=setTimeout(()=>{navTimer=null;ensureNav().catch(()=>{})},80)}

function statusBadge(status){
  if(status==='approved')return '<span class="v13-status approved">อนุมัติแล้ว</span>';
  if(status==='pending')return '<span class="v13-status pending">รอ Admin อนุมัติ</span>';
  if(status==='rejected')return '<span class="v13-status rejected">ไม่อนุมัติ</span>';
  return '<span class="v13-status muted">ยังไม่ได้ลงทะเบียน</span>';
}

async function renderCourseEnrollment(){
  const p=await profile();if(!p||p.role==='admin')return;
  busy('กำลังโหลดรายวิชาที่เปิดให้ลงทะเบียน...');
  const c=client();
  const [sr,er]=await Promise.all([
    c.from('subjects').select('id,code,name,color_hex,semester,academic_year').eq('active',true).eq('subject_type','subject').order('code'),
    c.from('subject_enrollments').select('id,subject_id,status,requested_at,decided_at,note').eq('user_id',uid())
  ]);
  if(sr.error||er.error){content().innerHTML=`<div class="alert error">${esc(errText(sr.error||er.error))}</div>`;return}
  const em=new Map((er.data||[]).map(x=>[x.subject_id,x]));
  const cards=(sr.data||[]).map(s=>{
    const e=em.get(s.id);const st=e?.status||'';
    const action=st==='approved'?'<button class="btn" disabled>✓ เรียนวิชานี้แล้ว</button>':st==='pending'?'<button class="btn" disabled>กำลังรออนุมัติ</button>':`<button class="btn primary" data-v13-request="${s.id}">${st==='rejected'?'ขออนุมัติใหม่':'ขอลงทะเบียนเรียน'}</button>`;
    return `<article class="card v13-course-card" style="--course:${esc(s.color_hex||'#22d3ee')}">
      <div class="v13-course-code">${esc(s.code)}</div><h3>${esc(s.name)}</h3>
      <div class="muted">ภาคเรียน ${esc(s.semester||'-')} • ปีการศึกษา ${esc(s.academic_year||'-')}</div>
      <div class="v13-course-status">${statusBadge(st)}</div>
      ${e?.note?`<div class="v13-note">หมายเหตุ: ${esc(e.note)}</div>`:''}
      <div class="v13-card-action">${action}</div>
    </article>`;
  }).join('');
  content().innerHTML=`<section class="v13-page"><div class="v13-hero"><div><span class="v13-kicker">COURSE REGISTRATION</span><h1>ลงทะเบียนรายวิชา</h1><p>เลือกวิชาที่ต้องการเรียน จากนั้นรอ Admin อนุมัติ เมื่ออนุมัติแล้ว ใบงานที่ปล่อยในวิชานั้นจะเข้าบัญชีของคุณอัตโนมัติ</p></div></div><div class="v13-course-grid">${cards||'<div class="card">ยังไม่มีรายวิชาเปิดใช้งาน</div>'}</div></section>`;
}

async function requestEnrollment(subjectId){
  const btn=$(`[data-v13-request="${subjectId}"]`);if(btn){btn.disabled=true;btn.textContent='กำลังส่งคำขอ...'}
  const {error}=await client().rpc('request_subject_enrollment',{p_subject_id:subjectId});
  if(error){toast(errText(error),true);if(btn)btn.disabled=false;return}
  toast('ส่งคำขอลงทะเบียนแล้ว รอ Admin อนุมัติ');
  await renderCourseEnrollment();
}

async function renderAdminEnrollments(){
  const p=await profile();if(!p||p.role!=='admin')return;
  busy('กำลังโหลดคำขอลงทะเบียนรายวิชา...');
  const c=client();
  const {data,error}=await c.from('subject_enrollments').select(`id,status,requested_at,decided_at,note,subject_id,user_id,subjects(id,code,name,color_hex),profiles!subject_enrollments_user_id_fkey(id,full_name,student_code,grade_level,room_label,department,major)`).order('requested_at',{ascending:false});
  if(error){content().innerHTML=`<div class="alert error">${esc(errText(error))}</div>`;return}
  const rows=data||[];
  const counts={pending:0,approved:0,rejected:0,withdrawn:0};rows.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
  const subjects=[...new Map(rows.map(x=>[x.subject_id,x.subjects])).entries()].map(([id,s])=>({id,...(s||{})}));
  content().innerHTML=`<section class="v13-page">
    <div class="v13-hero"><div><span class="v13-kicker">ADMIN COURSE CONTROL</span><h1>อนุมัติการลงทะเบียนรายวิชา</h1><p>Admin เป็นผู้กำหนดว่านักศึกษาคนใดมีสิทธิ์เรียนวิชาใด เมื่ออนุมัติแล้วจะได้รับใบงานที่ปล่อยในรายวิชานั้นโดยอัตโนมัติ</p></div></div>
    <div class="v13-kpi-grid"><div class="v13-kpi warn"><span>รออนุมัติ</span><b>${counts.pending}</b></div><div class="v13-kpi good"><span>อนุมัติแล้ว</span><b>${counts.approved}</b></div><div class="v13-kpi danger"><span>ไม่อนุมัติ</span><b>${counts.rejected}</b></div><div class="v13-kpi"><span>ทั้งหมด</span><b>${rows.length}</b></div></div>
    <div class="card v13-filterbar"><div class="field"><label>ค้นหา</label><input id="v13-enroll-q" class="input" placeholder="ชื่อ / เลขนักศึกษา / รหัสวิชา"></div><div class="field"><label>รายวิชา</label><select id="v13-enroll-subject" class="input"><option value="">ทุกวิชา</option>${subjects.map(s=>`<option value="${s.id}">${esc(s.code||'')} ${esc(s.name||'')}</option>`).join('')}</select></div><div class="field"><label>สถานะ</label><select id="v13-enroll-status" class="input"><option value="">ทุกสถานะ</option><option value="pending">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ไม่อนุมัติ</option></select></div></div>
    <div class="card v13-table-card"><div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>ระดับ/ห้อง</th><th>รายวิชา</th><th>วันที่ขอ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody id="v13-enroll-body"></tbody></table></div></div>
  </section>`;
  const redraw=()=>{
    const q=($("#v13-enroll-q")?.value||'').trim().toLowerCase(),sub=$("#v13-enroll-subject")?.value||'',st=$("#v13-enroll-status")?.value||'';
    const filtered=rows.filter(x=>{
      const p=x.profiles||{},s=x.subjects||{};const text=`${p.full_name||''} ${p.student_code||''} ${s.code||''} ${s.name||''}`.toLowerCase();
      return (!q||text.includes(q))&&(!sub||x.subject_id===sub)&&(!st||x.status===st);
    });
    $("#v13-enroll-body").innerHTML=filtered.map(x=>{
      const p=x.profiles||{},s=x.subjects||{};
      const actions=x.status==='pending'?`<div class="row"><button class="btn green sm" data-v13-decide="${x.id}" data-status="approved">อนุมัติ</button><button class="btn red sm" data-v13-decide="${x.id}" data-status="rejected">ไม่อนุมัติ</button></div>`:x.status==='approved'?`<button class="btn red sm" data-v13-decide="${x.id}" data-status="rejected">ยกเลิกสิทธิ์เรียน</button>`:`<button class="btn green sm" data-v13-decide="${x.id}" data-status="approved">อนุมัติ</button>`;
      return `<tr><td><b>${esc(p.student_code||'-')}</b><br>${esc(p.full_name||'-')}</td><td>${esc(p.grade_level||'-')}${esc(p.room_label||'')}</td><td><b>${esc(s.code||'')}</b><br>${esc(s.name||'')}</td><td>${esc(fmt(x.requested_at))}</td><td>${statusBadge(x.status)}</td><td>${actions}</td></tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">ไม่พบข้อมูล</td></tr>';
  };
  ['#v13-enroll-q','#v13-enroll-subject','#v13-enroll-status'].forEach(sel=>$(sel)?.addEventListener(sel==='#v13-enroll-q'?'input':'change',redraw));redraw();
}

function decisionModal(id,status){
  showModal(`<div class="v13-modal-head"><div><h2>${status==='approved'?'อนุมัติให้เรียนรายวิชา':'ไม่อนุมัติ / ยกเลิกสิทธิ์เรียน'}</h2><div class="muted">การเปลี่ยนสิทธิ์ทุกครั้งจะถูกบันทึกใน Audit Log</div></div><button class="btn" data-v13-close>✕</button></div><form id="v13-decision-form"><div class="field"><label>หมายเหตุ (ไม่บังคับ)</label><textarea name="note" rows="3" placeholder="เช่น อนุมัติตามรายชื่อห้องเรียน"></textarea></div><div class="row end"><button type="button" class="btn" data-v13-close>ยกเลิก</button><button class="btn ${status==='approved'?'green':'red'}">ยืนยัน</button></div></form>`);
  $("#v13-decision-form").onsubmit=async e=>{e.preventDefault();const note=String(new FormData(e.target).get('note')||'');const {error}=await client().rpc('decide_subject_enrollment',{p_enrollment_id:id,p_status:status,p_note:note||null});if(error)return toast(errText(error),true);closeModal();toast(status==='approved'?'อนุมัติรายวิชาแล้ว':'อัปเดตสิทธิ์รายวิชาแล้ว');renderAdminEnrollments()};
}

function remainingText(date){
  if(!date)return 'ไม่กำหนดเวลา';
  const diff=new Date(date).getTime()-Date.now();
  const past=diff<0,ms=Math.abs(diff),mins=Math.floor(ms/60000),days=Math.floor(mins/1440),hours=Math.floor((mins%1440)/60),minutes=mins%60;
  const t=`${days?days+' วัน ':''}${String(hours).padStart(2,'0')} ชม. ${String(minutes).padStart(2,'0')} นาที`;
  return past?`หมดเวลาแล้ว ${t}`:`เหลือ ${t}`;
}
function refreshCountdowns(){
  $$('[data-v13-countdown]').forEach(el=>{const due=el.dataset.v13Countdown;el.textContent=remainingText(due);el.classList.toggle('expired',new Date(due).getTime()<Date.now())});
}
function startCountdowns(){clearInterval(countdownTimer);refreshCountdowns();countdownTimer=setInterval(refreshCountdowns,30000)}

async function loadApprovedCoursesAndWork(){
  const c=client(),id=uid();
  const er=await c.from('subject_enrollments').select('id,subject_id,status,requested_at,subjects(id,code,name,color_hex,semester,academic_year)').eq('user_id',id).order('requested_at',{ascending:false});
  if(er.error)throw er.error;
  const approved=(er.data||[]).filter(x=>x.status==='approved');
  const approvedIds=new Set(approved.map(x=>x.subject_id));
  const ar=await c.from('worksheet_assignments').select('worksheet_id,assigned_at').eq('user_id',id).order('assigned_at',{ascending:false});
  if(ar.error)throw ar.error;
  const ids=[...new Set((ar.data||[]).map(x=>x.worksheet_id))];
  if(!ids.length)return {enrollments:er.data||[],approved,works:[]};
  const [wr,sr]=await Promise.all([
    c.from('worksheets').select('id,subject_id,title,reference_code,mode,status,open_at,due_at,subjects(code,name,color_hex)').in('id',ids),
    c.from('submissions').select('worksheet_id,status,submitted_at,is_late,last_saved_at').eq('user_id',id).in('worksheet_id',ids)
  ]);
  if(wr.error||sr.error)throw wr.error||sr.error;
  const sm=new Map();(sr.data||[]).forEach(s=>sm.set(s.worksheet_id,s));
  const works=(wr.data||[]).filter(w=>approvedIds.has(w.subject_id)).map(w=>({w,s:sm.get(w.id)||null})).sort((a,b)=>(new Date(a.w.due_at||'9999').getTime()-new Date(b.w.due_at||'9999').getTime()));
  return {enrollments:er.data||[],approved,works};
}
function workState(w,s){
  if(s&&['submitted','confirmed','graded'].includes(s.status))return s.is_late?['ส่งแล้ว (ช้า)','late']:['ส่งแล้ว','sent'];
  if(s?.status==='draft')return ['บันทึกร่าง','draft'];
  if(w.open_at&&new Date(w.open_at)>new Date())return ['ยังไม่เปิด','upcoming'];
  if(w.due_at&&new Date(w.due_at)<new Date())return ['เกินกำหนด','overdue'];
  return ['ยังไม่ส่ง','pending'];
}
async function renderUserDashboard(){
  if(dashboardBusy)return;dashboardBusy=true;
  try{
    const p=await profile();if(!p||p.role==='admin')return;
    const ctn=content();if(!ctn)return;
    const heading=ctn.querySelector('.section-head h1');
    if(!heading||heading.textContent.trim()!=='หน้าหลัก'||ctn.dataset.v13Dashboard==='1')return;
    ctn.dataset.v13Dashboard='1';
    ctn.innerHTML='<div class="card v13-busy"><div class="v13-spinner"></div><b>กำลังสร้างแดชบอร์ดรายวิชาของคุณ...</b></div>';
    const data=await loadApprovedCoursesAndWork();
    const pending=data.enrollments.filter(x=>x.status==='pending').length;
    const courseCards=data.approved.map(e=>`<article class="v13-mini-course" style="--course:${esc(e.subjects?.color_hex||'#22d3ee')}"><b>${esc(e.subjects?.code||'')}</b><span>${esc(e.subjects?.name||'')}</span><small>อนุมัติให้เรียนแล้ว</small></article>`).join('');
    const digital=data.works.filter(x=>x.w.mode==='digital'),paper=data.works.filter(x=>x.w.mode==='paper');
    const workRows=(rows)=>rows.slice(0,10).map(({w,s})=>{const [label,key]=workState(w,s);return `<div class="v13-work-row"><div><b>${esc(w.subjects?.code||'')} • ${esc(w.title)}</b><small>${esc(w.reference_code||'')} • กำหนด ${esc(fmt(w.due_at))}</small></div><span class="v13-work-state ${key}">${label}</span>${!['sent','late'].includes(key)&&w.due_at?`<span class="v13-countdown" data-v13-countdown="${esc(w.due_at)}"></span>`:'<span class="v13-countdown done">เสร็จแล้ว</span>'}<button class="btn primary sm" data-v13-open-work="${w.id}">${['sent','late'].includes(key)?'ดูงาน':'เปิดทำ'}</button></div>`}).join('')||'<div class="empty">ยังไม่มีใบงานที่ปล่อยในหมวดนี้</div>';
    ctn.innerHTML=`<section class="v13-page"><div class="v13-hero"><div><span class="v13-kicker">MY LEARNING DASHBOARD</span><h1>แดชบอร์ดการเรียน</h1><p>${esc(p.full_name||'')} • ${esc(p.grade_level||'-')}${esc(p.room_label||'')}</p></div><button class="btn primary" data-v13-open-enroll>+ ลงทะเบียนรายวิชา</button></div>
      <div class="v13-kpi-grid"><div class="v13-kpi good"><span>วิชาที่อนุมัติแล้ว</span><b>${data.approved.length}</b></div><div class="v13-kpi warn"><span>รออนุมัติ</span><b>${pending}</b></div><div class="v13-kpi"><span>ใบงานดิจิทัล</span><b>${digital.length}</b></div><div class="v13-kpi"><span>ใบงานกระดาษ</span><b>${paper.length}</b></div></div>
      <div class="card"><div class="row between"><div><h2>รายวิชาที่ลงทะเบียนเรียนแล้ว</h2><div class="muted">เฉพาะวิชาที่ Admin อนุมัติ</div></div><button class="btn" data-v13-open-enroll>จัดการรายวิชา</button></div><div class="v13-mini-course-grid">${courseCards||'<div class="empty">ยังไม่มีรายวิชาที่ได้รับอนุมัติ</div>'}</div></div>
      <div class="v13-two-col"><div class="card"><div class="v13-section-title"><span>💻</span><div><h2>ใบงานอิเล็กทรอนิกส์</h2><small>แสดงเวลาคงเหลือก่อนกำหนดส่ง</small></div></div>${workRows(digital)}</div><div class="card"><div class="v13-section-title"><span>🖨️</span><div><h2>ใบงานสำหรับพิมพ์</h2><small>แยกจากใบงานอิเล็กทรอนิกส์</small></div></div>${workRows(paper)}</div></div>
    </section>`;
    startCountdowns();
  }catch(e){if(content())content().innerHTML=`<div class="alert error">${esc(errText(e))}</div>`}
  finally{dashboardBusy=false}
}

async function enhanceSubjectLibrary(){
  const p=await profile();if(!p||p.role!=='admin')return;
  const cards=$$('.v11-subject[data-v11-card]');if(!cards.length)return;
  const needs=cards.filter(x=>!x.dataset.v13EnrollmentCount);if(!needs.length)return;
  const ids=needs.map(x=>x.dataset.v11Card);
  const {data,error}=await client().from('subject_enrollments').select('subject_id,status').in('subject_id',ids).eq('status','approved');
  if(error)return;
  const counts={};(data||[]).forEach(x=>counts[x.subject_id]=(counts[x.subject_id]||0)+1);
  needs.forEach(card=>{card.dataset.v13EnrollmentCount='1';const pills=card.querySelector('.v11-pills');if(pills)pills.insertAdjacentHTML('beforeend',`<span class="v13-student-pill">👥 ผู้เรียน ${counts[card.dataset.v11Card]||0} คน</span>`)});
}

function prepareBundleCard(card){
  if(card.dataset.v13Ready==='1')return;
  const prev=card.querySelector('[data-v8-preview]');
  const schedule=card.querySelector('[data-v9-schedule],[data-v8-assign]');
  const upload=card.querySelector('[data-v11-subject]');
  const wid=prev?.dataset.v8Preview||schedule?.dataset.v9Schedule||schedule?.dataset.v8Assign||upload?.dataset.v11Upload;
  if(!wid)return;
  card.dataset.v13Ready='1';card.dataset.v13Wid=wid;
  if(prev){prev.dataset.v13Preview=wid;prev.removeAttribute('data-v8-preview');prev.textContent='ดูตัวอย่างใบงาน'}
  if(schedule){schedule.dataset.v13ReleaseSingle=wid;schedule.removeAttribute('data-v9-schedule');schedule.removeAttribute('data-v8-assign');schedule.textContent='ปล่อยใบงาน / กำหนดเวลา'}
  const head=card.querySelector('.v11-bundle-head');if(head&&!head.querySelector('[data-v13-select]'))head.insertAdjacentHTML('beforeend',`<label class="v13-select"><input type="checkbox" data-v13-select="${wid}"> เลือกชุดนี้</label>`);
}
function modeSection(title,icon,mode,cards,subjectId){
  const section=document.createElement('section');section.className=`v13-mode-section ${mode}`;section.dataset.v13Mode=mode;
  section.innerHTML=`<div class="v13-mode-head"><div><span>${icon}</span><div><h2>${title}</h2><small>${cards.length} ชุด • เลือกปล่อยได้ครั้งละหลายหน่วย</small></div></div><div class="row"><button class="btn sm" data-v13-select-all="${mode}">เลือกทั้งหมด</button><button class="btn sm" data-v13-clear="${mode}">ล้างการเลือก</button><button class="btn primary" data-v13-bulk-release="${mode}" data-subject="${subjectId}">ปล่อยใบงานที่เลือก</button></div></div><div class="v13-mode-list"></div>`;
  const box=section.querySelector('.v13-mode-list');cards.forEach(x=>box.appendChild(x));return section;
}
async function enhanceBundlePage(){
  const p=await profile();if(!p||p.role!=='admin')return;
  const hub=$('.v11-hub');const list=$('#v11-bundles');if(!hub||!list||list.dataset.v13Organized==='1')return;
  const cards=[...list.querySelectorAll(':scope > .v11-bundle')];if(!cards.length)return;
  cards.forEach(prepareBundleCard);
  const subjectId=cards[0].querySelector('[data-v11-subject]')?.dataset.v11Subject||cards[0].querySelector('[data-v9-subject]')?.dataset.v9Subject;
  if(!subjectId)return;
  list.dataset.v13Organized='1';list.innerHTML='';
  const paper=cards.filter(x=>x.classList.contains('paper')),digital=cards.filter(x=>x.classList.contains('digital'));
  list.append(modeSection('ใบงานสำหรับพิมพ์','🖨️','paper',paper,subjectId),modeSection('ใบงานอิเล็กทรอนิกส์','💻','digital',digital,subjectId));
  if(!hub.querySelector('[data-v13-course-control]')){
    const hero=hub.querySelector('.v11-hero');
    hero?.insertAdjacentHTML('afterend',`<div class="card v13-course-control" data-v13-course-control data-subject="${subjectId}"><div><b>👥 ผู้เรียนที่อนุมัติในรายวิชา</b><div class="muted">กำลังตรวจจำนวนผู้เรียน...</div></div><div class="row"><button class="btn" data-v13-members="${subjectId}">ดูรายชื่อผู้เรียน</button><button class="btn primary" data-v13-enrollment-admin-short>อนุมัติคำขอเรียน</button></div></div>`);
    const {count}=await client().from('subject_enrollments').select('id',{count:'exact',head:true}).eq('subject_id',subjectId).eq('status','approved');
    const note=hub.querySelector('[data-v13-course-control] .muted');if(note)note.textContent=`อนุมัติแล้ว ${count||0} คน • เมื่อปล่อยใบงาน ผู้เรียนกลุ่มนี้จะได้รับพร้อมกันทั้งหมด`;
  }
}

async function showMembers(subjectId){
  const {data,error}=await client().from('subject_enrollments').select(`id,requested_at,profiles!subject_enrollments_user_id_fkey(full_name,student_code,grade_level,room_label,department,major),subjects(code,name)`).eq('subject_id',subjectId).eq('status','approved').order('requested_at');
  if(error)return toast(errText(error),true);
  const rows=(data||[]).map((x,i)=>{const p=x.profiles||{};return `<tr><td>${i+1}</td><td><b>${esc(p.student_code||'-')}</b></td><td>${esc(p.full_name||'-')}</td><td>${esc(p.grade_level||'-')}${esc(p.room_label||'')}</td><td>${esc(p.department||'-')}</td><td>${esc(p.major||'-')}</td></tr>`}).join('');
  showModal(`<div class="v13-modal-head"><div><h2>รายชื่อผู้เรียนในรายวิชา</h2><div class="muted">อนุมัติแล้ว ${(data||[]).length} คน</div></div><button class="btn" data-v13-close>✕</button></div><div class="table-wrap"><table><thead><tr><th>#</th><th>เลขนักศึกษา</th><th>ชื่อ</th><th>ระดับ/ห้อง</th><th>แผนก</th><th>สาขา</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">ยังไม่มีผู้เรียนที่อนุมัติ</td></tr>'}</tbody></table></div>`,true);
}

function questionHtml(q,i){
  const text=q?.prompt||q?.question||q?.text||q?.title||`คำถามข้อ ${i+1}`;
  const pts=q?.points!=null?` • ${q.points} คะแนน`:'';
  const opts=Array.isArray(q?.options)?q.options:Array.isArray(q?.choices)?q.choices:[];
  return `<div class="v13-question"><div class="v13-qnum">${i+1}</div><div><b>${esc(text)}</b><small>${esc(q?.type||'คำตอบ')}${pts}</small>${opts.length?`<div class="v13-options">${opts.map((o,j)=>`<div>○ ${esc(typeof o==='string'?o:(o?.text||o?.label||String(o)))}</div>`).join('')}</div>`:'<div class="v13-answer-preview">พื้นที่สำหรับคำตอบ</div>'}</div></div>`;
}
async function previewWorksheet(wid){
  const {data:w,error}=await client().from('worksheets').select('id,title,reference_code,description,instructions,mode,questions,settings,open_at,due_at,subjects(code,name,color_hex)').eq('id',wid).single();
  if(error)return toast(errText(error),true);
  const questions=Array.isArray(w.questions)?w.questions:[];
  showModal(`<div class="v13-modal-head no-print"><div><h2>ตัวอย่าง${w.mode==='paper'?'ใบงานสำหรับพิมพ์':'ใบงานอิเล็กทรอนิกส์'}</h2><div class="muted">${esc(w.subjects?.code||'')} ${esc(w.subjects?.name||'')}</div></div><div class="row">${w.mode==='paper'?'<button class="btn primary" data-v13-print>🖨️ พิมพ์</button>':''}<button class="btn" data-v13-close>✕</button></div></div><div class="v13-preview-sheet ${w.mode==='paper'?'paper':''}"><div class="v13-preview-band"></div><div class="v13-preview-subject">${esc(w.subjects?.code||'')} • ${esc(w.subjects?.name||'')}</div><h1>${esc(w.title||'ใบงาน')}</h1><div class="muted">${esc(w.reference_code||'')}</div>${w.instructions?`<div class="v13-instructions"><b>คำชี้แจง:</b> ${esc(w.instructions)}</div>`:''}<div class="v13-question-list">${questions.map(questionHtml).join('')||'<div class="empty">ยังไม่มีคำถามในใบงานนี้</div>'}</div></div>`,true);
}

async function releaseDialog(subjectId,ids){
  if(!ids.length)return toast('กรุณาเลือกใบงานอย่างน้อย 1 ชุด',true);
  const c=client();
  const [wr,er]=await Promise.all([
    c.from('worksheets').select('id,title,reference_code,mode,open_at,due_at').in('id',ids),
    c.from('subject_enrollments').select('id',{count:'exact',head:true}).eq('subject_id',subjectId).eq('status','approved')
  ]);
  if(wr.error||er.error)return toast(errText(wr.error||er.error),true);
  const works=wr.data||[];const one=works.length===1?works[0]:null;
  const open=one?.open_at?new Date(one.open_at):new Date();
  const due=one?.due_at?new Date(one.due_at):new Date(Date.now()+7*86400000);
  showModal(`<div class="v13-modal-head"><div><h2>ปล่อยใบงานให้ผู้เรียนในรายวิชา</h2><div class="muted">เลือก ${works.length} ชุด • ผู้เรียนที่อนุมัติ ${er.count||0} คน</div></div><button class="btn" data-v13-close>✕</button></div><div class="v13-release-summary">${works.map(w=>`<span>${w.mode==='paper'?'🖨️':'💻'} ${esc(w.reference_code||w.title)}</span>`).join('')}</div><form id="v13-release-form"><div class="v13-form-grid"><div class="field"><label>เปิดทำใบงาน</label><input name="open_at" type="datetime-local" value="${dtLocal(open)}" required></div><div class="field"><label>กำหนดส่ง</label><input name="due_at" type="datetime-local" value="${dtLocal(due)}" required></div></div><div class="v13-checks"><label><input name="allow_late" type="checkbox"> อนุญาตส่งช้า</label><label><input name="allow_resubmit" type="checkbox"> อนุญาตส่งซ้ำ</label><label>จำนวนครั้งสูงสุด <input name="max_attempts" type="number" min="1" max="20" value="1"></label></div><div class="alert">เมื่อกดยืนยัน ผู้เรียนที่ได้รับอนุมัติในรายวิชานี้ทุกคนจะได้รับใบงานชุดที่เลือกพร้อมกัน และเห็นเวลานับถอยหลังบนแดชบอร์ด</div><div class="row end"><button type="button" class="btn" data-v13-close>ยกเลิก</button><button class="btn primary">🚀 ปล่อยใบงาน ${works.length} ชุด</button></div></form>`);
  $("#v13-release-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const openV=String(f.get('open_at')||''),dueV=String(f.get('due_at')||'');if(!openV||!dueV||new Date(dueV)<=new Date(openV))return toast('กำหนดส่งต้องอยู่หลังเวลาเปิด',true);const submit=e.submitter;submit.disabled=true;submit.textContent='กำลังปล่อยใบงาน...';const {data,error}=await c.rpc('publish_subject_worksheets',{p_subject_id:subjectId,p_worksheet_ids:ids,p_open_at:new Date(openV).toISOString(),p_due_at:new Date(dueV).toISOString(),p_allow_late:f.get('allow_late')==='on',p_allow_resubmit:f.get('allow_resubmit')==='on',p_max_attempts:Number(f.get('max_attempts')||1)});if(error){submit.disabled=false;submit.textContent='ลองใหม่';return toast(errText(error),true)}closeModal();toast(`ปล่อย ${data?.worksheet_count||works.length} ใบงานให้ผู้เรียน ${data?.approved_learners||0} คนแล้ว`);window.dispatchEvent(new Event('docfullnr:v11-refresh'))};
}

function selectedIds(mode){return $$(`.v13-mode-section.${mode} [data-v13-select]:checked`).map(x=>x.dataset.v13Select)}

async function scheduleEnhance(){
  if(enhanceTimer)return;enhanceTimer=setTimeout(async()=>{enhanceTimer=null;await ensureNav().catch(()=>{});await enhanceSubjectLibrary().catch(()=>{});await enhanceBundlePage().catch(()=>{});await renderUserDashboard().catch(()=>{})},100)
}
const observer=new MutationObserver(scheduleEnhance);observer.observe(document.body||document.documentElement,{childList:true,subtree:true});setTimeout(scheduleEnhance,350);

// Capture early only for our own controls. Existing V9/V11 controls are converted to V13 attributes before click.
document.addEventListener('click',async e=>{
  const t=e.target.closest('button,a,label');if(!t)return;
  if(t.matches('[data-v13-route="course-enroll"]')){e.preventDefault();e.stopImmediatePropagation();setActive(t);renderCourseEnrollment();return}
  if(t.matches('[data-v13-route="enrollment-admin"]')){e.preventDefault();e.stopImmediatePropagation();setActive(t);renderAdminEnrollments();return}
  if(t.matches('[data-v13-open-enroll]')){e.preventDefault();renderCourseEnrollment();return}
  if(t.matches('[data-v13-enrollment-admin-short]')){e.preventDefault();renderAdminEnrollments();return}
  if(t.matches('[data-v13-request]')){e.preventDefault();requestEnrollment(t.dataset.v13Request);return}
  if(t.matches('[data-v13-decide]')){e.preventDefault();decisionModal(t.dataset.v13Decide,t.dataset.status);return}
  if(t.matches('[data-v13-preview]')){e.preventDefault();e.stopImmediatePropagation();previewWorksheet(t.dataset.v13Preview);return}
  if(t.matches('[data-v13-release-single]')){e.preventDefault();e.stopImmediatePropagation();const card=t.closest('[data-v13-wid]');const sid=card?.querySelector('[data-v11-subject]')?.dataset.v11Subject;releaseDialog(sid,[t.dataset.v13ReleaseSingle]);return}
  if(t.matches('[data-v13-bulk-release]')){e.preventDefault();const mode=t.dataset.v13BulkRelease;releaseDialog(t.dataset.subject,selectedIds(mode));return}
  if(t.matches('[data-v13-select-all]')){e.preventDefault();$$(`.v13-mode-section.${t.dataset.v13SelectAll} [data-v13-select]`).forEach(x=>x.checked=true);return}
  if(t.matches('[data-v13-clear]')){e.preventDefault();$$(`.v13-mode-section.${t.dataset.v13Clear} [data-v13-select]`).forEach(x=>x.checked=false);return}
  if(t.matches('[data-v13-members]')){e.preventDefault();showMembers(t.dataset.v13Members);return}
  if(t.matches('[data-v13-open-work]')){e.preventDefault();location.href=`./?worksheet=${encodeURIComponent(t.dataset.v13OpenWork)}`;return}
  if(t.matches('[data-v13-print]')){e.preventDefault();window.print();return}
},true);

console.info(`[DOC-FULL-NR] ${FEATURE_VERSION} loaded`);
