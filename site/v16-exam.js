/* DOC-FULL-NR V16 EXAM CENTER
   - 50 multiple-choice questions, 4 options each
   - 75 minutes, full score 20 (correct * 20 / 50)
   - per-attempt shuffled question + option order
   - student score/answer-key privacy
   - anti-cheat event audit (deterrence, not a browser security boundary)
   - admin question bank CRUD + JSON import/export + realtime results
*/
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const URL="https://thjscmfqunlaqxlievna.supabase.co";
const KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const REF="thjscmfqunlaqxlievna";
const SK=`sb-${REF}-auth-token`;
const VERSION="V16-EXAM-50Q-75MIN-REALTIME";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const localVal=d=>{const x=d?new Date(d):new Date();return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const params=new URLSearchParams(location.search);
const roomSubject=params.get("subject")||"";

let state={
  profile:null,offset:0,attempt:null,answers:{},flags:new Set(),currentIndex:0,
  saveTimer:null,timer:null,submitting:false,dirty:false,
  examChannel:null,rt:null,antiCheatBound:false,fullscreenExpected:false,
  violationLocal:0,fullscreenPrompting:false
};

function session(){try{const x=JSON.parse(localStorage.getItem(SK)||"null");return x?.access_token?x:null}catch{return null}}
function db(){const s=session();return createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}})}
async function rtClient(){const s=session();if(!s)return null;if(state.rt)return state.rt;const c=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});try{await c.realtime.setAuth(s.access_token)}catch{}state.rt=c;return c}
function app(){return $("#exam-app")}
function msg(text,bad=false){let e=$("#exam-toast");if(!e){e=document.createElement("div");e.id="exam-toast";e.className="v14-toast";document.body.appendChild(e)}e.textContent=text;e.className=`v14-toast show${bad?" bad":""}`;clearTimeout(msg.t);msg.t=setTimeout(()=>e.className="v14-toast",3500)}
function err(e){const s=String(e?.message||e?.details||e||"เกิดข้อผิดพลาด");const map={EXAM_NOT_OPEN:"ยังไม่ถึงเวลาเปิดสอบ",EXAM_CLOSED:"หมดเวลาเปิดสอบแล้ว",MAX_ATTEMPTS_REACHED:"ใช้สิทธิ์เข้าสอบครบแล้ว",NOT_ASSIGNED:"ไม่ได้รับมอบหมายข้อสอบนี้",EXAM_TIME_EXPIRED:"หมดเวลาทำข้อสอบแล้ว",ATTEMPT_FINALIZED:"ข้อสอบถูกส่งแล้ว",ADMIN_REQUIRED:"ต้องใช้บัญชี Admin",QUESTION_BANK_NEEDS_50:"คลังข้อสอบรายวิชานี้ต้องมีอย่างน้อย 50 ข้อ",FOUR_OPTIONS_REQUIRED:"คำถามต้องมีตัวเลือก 4 ตัว",CORRECT_ANSWER_NOT_IN_OPTIONS:"เฉลยต้องตรงกับหนึ่งใน 4 ตัวเลือก"};for(const[k,v]of Object.entries(map))if(s.includes(k))return v;return s}
function uuid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function seededOrder(arr,seed){const h=s=>{let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return x>>>0};return [...arr].sort((a,b)=>h(seed+JSON.stringify(a))-h(seed+JSON.stringify(b)))}
function csvDownload(rows,filename){const cell=v=>{const s=String(v??"");return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(cell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function jsonDownload(data,filename){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function closeChannel(){if(state.examChannel&&state.rt){try{state.rt.removeChannel(state.examChannel)}catch{}}state.examChannel=null}

async function profile(){
  const s=session();if(!s){location.href="./";return null}
  const {data,error}=await db().from("profiles").select("id,full_name,student_code,role,active,approval_status,academic_status,class_name,grade_level,room_label,department").eq("id",s.user.id).maybeSingle();
  if(error||!data){app().innerHTML='<div class="alert error">ไม่สามารถโหลดโปรไฟล์ได้</div>';return null}
  state.profile=data;$("#exam-user").textContent=`${data.full_name||data.student_code||""} • ${data.role.toUpperCase()}`;
  if(data.role!=="admin"&&(!data.active||data.approval_status!=="approved"||data.academic_status!=="studying")){
    app().innerHTML='<div class="card"><h2>ยังไม่สามารถเข้าสู่ระบบสอบได้</h2><p>บัญชีต้องได้รับการอนุมัติและมีสถานะกำลังศึกษาก่อน</p><a class="btn primary" href="./">กลับหน้าหลัก</a></div>';return null
  }
  return data;
}
async function syncTime(){try{const a=Date.now(),{data}=await db().rpc("server_now"),b=Date.now();if(data)state.offset=new Date(data).getTime()-(a+b)/2}catch{}}
function now(){return Date.now()+state.offset}

// ---------------------------------------------------------------------
// Admin home / room context
// ---------------------------------------------------------------------
async function adminHome(){
  cleanupExamSecurity();closeChannel();
  const c=db();
  const [er,sr,ar,enr]=await Promise.all([
    c.from("exams").select("*,subjects(code,name,color_hex)").order("created_at",{ascending:false}),
    c.from("subjects").select("id,code,name").eq("active",true).eq("subject_type","subject").order("code"),
    c.from("exam_attempts").select("id",{count:"exact",head:true}),
    roomSubject?c.from("subject_enrollments").select("id",{count:"exact",head:true}).eq("subject_id",roomSubject).eq("status","approved"):Promise.resolve({count:0})
  ]);
  if(er.error){app().innerHTML=`<div class="alert error">${esc(err(er.error))}</div>`;return}
  const all=er.data||[],subjects=sr.data||[],room=roomSubject?subjects.find(x=>x.id===roomSubject):null,exams=roomSubject?all.filter(x=>x.subject_id===roomSubject):all;
  let bankCount=0;if(roomSubject){const br=await c.from("exam_question_bank").select("id",{count:"exact",head:true}).eq("subject_id",roomSubject).eq("active",true);bankCount=br.count||0}
  app().innerHTML=`
    ${room?`<div class="card exam-room-context"><div><span class="v14-kicker">🏫 ห้องเรียนรายวิชา</span><b>${esc(room.code)} ${esc(room.name)}</b><small>สมาชิกที่อนุมัติ ${enr.count||0} คน • คลังข้อสอบ ${bankCount} ข้อ</small></div><a class="btn" href="./">← กลับห้องเรียน</a></div>`:""}
    <div class="v16-exam-head"><div><span class="v14-kicker">EXAM CENTER • ${VERSION}</span><h1>${room?"ระบบสอบของห้องเรียนนี้":"ระบบสอบออนไลน์"}</h1><p>มาตรฐานกลาง/ปลายภาค: ปรนัย 4 ตัวเลือก 50 ข้อ • 75 นาที • 20 คะแนน • สุ่มข้อและตัวเลือกต่อผู้สอบ</p></div>
      <div class="row wrap">${room?`<button class="btn" id="exam-bank">คลังข้อสอบ (${bankCount})</button><button class="btn primary" id="exam-from-bank">＋ สร้างข้อสอบ 50 ข้อ</button>`:`<button class="btn" id="exam-bank">จัดการคลังข้อสอบ</button>`}</div>
    </div>
    <div class="v16-exam-kpis"><div><span>ชุดสอบ</span><b>${exams.length}</b></div><div><span>เปิดสอบ</span><b>${exams.filter(x=>x.status==="published").length}</b></div><div><span>คลังข้อสอบ</span><b>${room?bankCount:"-"}</b></div><div><span>Attempt</span><b>${ar.count||0}</b></div></div>
    <div class="exam-grid">${exams.map(x=>`<article class="exam-card"><div class="row between"><span class="v14-kicker">${esc(x.subjects?.code||"")}</span><span class="v16-kind">${x.exam_kind==="midterm"?"กลางภาค":x.exam_kind==="final"?"ปลายภาค":"ฝึก/อื่น"}</span></div><h3>${esc(x.title)}</h3><small>${esc(x.subjects?.name||"")}</small><div class="v16-exam-spec"><span>📝 ${x.question_count_target||50} ข้อ</span><span>⏱ ${x.duration_minutes||75} นาที</span><span>🎯 ${Number(x.full_score||20)} คะแนน</span></div><span class="v14-status ${x.status==="published"?"approved":x.status==="draft"?"pending":"muted"}">${esc(x.status)}</span>${x.open_at?`<small>เปิด ${fmt(x.open_at)}<br>ปิด ${fmt(x.due_at)}</small>`:""}<div class="exam-admin-toolbar"><button class="btn primary sm" data-exam-publish="${x.id}">กำหนดเวลา/ปล่อยสอบ</button><button class="btn sm" data-exam-results="${x.id}">ผลสอบ</button><button class="btn red sm" data-exam-delete="${x.id}">ลบชุดสอบ</button></div></article>`).join("")||`<div class="v14-empty">ยังไม่มีชุดสอบในห้องเรียนนี้</div>`}</div>`;
  $("#exam-bank")?.addEventListener("click",()=>questionBank(roomSubject||null,subjects));
  $("#exam-from-bank")?.addEventListener("click",()=>createFromBankDialog(roomSubject,room,bankCount));
  $$('[data-exam-publish]').forEach(b=>b.onclick=()=>publishDialog(b.dataset.examPublish));
  $$('[data-exam-results]').forEach(b=>b.onclick=()=>resultsView(b.dataset.examResults));
  $$('[data-exam-delete]').forEach(b=>b.onclick=()=>deleteExam(b.dataset.examDelete));
}

async function createFromBankDialog(subjectId,room,bankCount){
  if(!subjectId){msg("กรุณาเปิด Exam Center จากห้องเรียนรายวิชา",true);return}
  if(bankCount<50){msg(`คลังข้อสอบมี ${bankCount} ข้อ ต้องมีอย่างน้อย 50 ข้อ`,true);return}
  const start=new Date(now()+10*60000),end=new Date(start.getTime()+2*60*60000);
  app().innerHTML=`<button class="btn" id="exam-back">← กลับ</button><div class="v16-simple-page"><span class="v14-kicker">CREATE FROM QUESTION BANK</span><h1>สร้างข้อสอบ 50 ข้อ</h1><p>${esc(room?.code||"")} ${esc(room?.name||"")} • ระบบสุ่ม 50 ข้อจากคลัง และนักศึกษาแต่ละคนจะเห็นลำดับข้อ/ตัวเลือกต่างกัน</p><form id="bank-exam-form" class="card v16-form-stack"><label>ชื่อชุดสอบ<input class="input" name="title" required value="สอบกลางภาค ${esc(room?.name||"")}"></label><label>ประเภท<select class="input" name="kind"><option value="midterm">สอบกลางภาค 20 คะแนน</option><option value="final">สอบปลายภาค 20 คะแนน</option><option value="practice">สอบฝึก/ทดสอบ 20 คะแนน</option></select></label><div class="v14-form-grid"><label>เปิดสอบ<input class="input" type="datetime-local" name="open" value="${localVal(start)}" required></label><label>ปิดรับเข้าสอบ<input class="input" type="datetime-local" name="due" value="${localVal(end)}" required></label></div><div class="v16-fixed-spec"><b>ค่าคงที่ของระบบ</b><span>50 ข้อ • 4 ตัวเลือก • 75 นาที • คะแนนเต็ม 20 • 1 ข้อ = 0.4 คะแนน • ไม่แสดงคะแนนผู้เรียน</span></div><label class="v16-check"><input type="checkbox" name="publish" checked> สร้างแล้วปล่อยสอบให้สมาชิกห้องทันที</label><div class="row end"><button class="btn primary">สร้างชุดสอบ</button></div></form></div>`;
  $("#exam-back").onclick=adminHome;
  $("#bank-exam-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),open=new Date(String(f.get("open"))).toISOString(),due=new Date(String(f.get("due"))).toISOString();const c=db();const cr=await c.rpc("admin_create_exam_from_bank",{p_subject_id:subjectId,p_title:String(f.get("title")||""),p_exam_kind:String(f.get("kind")||"midterm"),p_open_at:open,p_due_at:due});if(cr.error){msg(err(cr.error),true);return}if(f.get("publish")){const pr=await c.rpc("publish_exam_to_subject",{p_exam_id:cr.data,p_open_at:open,p_due_at:due});if(pr.error){msg(`สร้างชุดแล้ว แต่ปล่อยสอบไม่สำเร็จ: ${err(pr.error)}`,true);return}}msg("สร้างชุดสอบ 50 ข้อเรียบร้อย");adminHome()};
}

async function publishDialog(id){
  const c=db(),{data:e,error}=await c.from("exams").select("id,title,open_at,due_at,duration_minutes,question_count_target,full_score").eq("id",id).single();if(error){msg(err(error),true);return}
  const start=e.open_at?new Date(e.open_at):new Date(now()+5*60000),end=e.due_at?new Date(e.due_at):new Date(start.getTime()+2*60*60000);
  app().innerHTML=`<button class="btn" id="exam-back">← กลับ</button><div class="v16-simple-page"><span class="v14-kicker">PUBLISH EXAM</span><h1>${esc(e.title)}</h1><div class="v16-fixed-spec"><span>${e.question_count_target||50} ข้อ • ${e.duration_minutes||75} นาที • ${Number(e.full_score||20)} คะแนน</span></div><form id="publish-form" class="card"><div class="v14-form-grid"><label>เปิดสอบ<input class="input" type="datetime-local" name="open" value="${localVal(start)}" required></label><label>ปิดรับเข้าสอบ<input class="input" type="datetime-local" name="due" value="${localVal(end)}" required></label></div><div class="row end"><button class="btn primary">ปล่อยสอบให้สมาชิกห้อง</button></div></form></div>`;
  $("#exam-back").onclick=adminHome;$("#publish-form").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),r=await c.rpc("publish_exam_to_subject",{p_exam_id:id,p_open_at:new Date(String(f.get("open"))).toISOString(),p_due_at:new Date(String(f.get("due"))).toISOString()});if(r.error){msg(err(r.error),true);return}msg(`ปล่อยสอบแล้ว ${r.data?.assigned_count||0} คน`);adminHome()}
}

async function deleteExam(id){if(!confirm("ลบชุดสอบนี้? Attempt และการมอบหมายของชุดนี้จะถูกลบตามความสัมพันธ์ฐานข้อมูล"))return;const r=await db().rpc("admin_delete_exam",{p_exam_id:id});if(r.error){msg(err(r.error),true);return}msg("ลบชุดสอบแล้ว");adminHome()}

// ---------------------------------------------------------------------
// Question bank CRUD / import / export
// ---------------------------------------------------------------------
async function questionBank(preferredSubject,subjects){
  cleanupExamSecurity();closeChannel();const subjectId=preferredSubject||subjects[0]?.id||"";if(!subjectId){app().innerHTML='<div class="alert error">ยังไม่มีรายวิชา</div>';return}
  const draw=async sid=>{
    const c=db(),[qr,sr]=await Promise.all([c.from("exam_question_bank").select("*").eq("subject_id",sid).order("created_at",{ascending:false}),c.from("subjects").select("id,code,name").eq("id",sid).single()]);if(qr.error){msg(err(qr.error),true);return}
    const rows=qr.data||[],sub=sr.data;
    app().innerHTML=`<button class="btn" id="exam-back">← กลับ Exam Center</button><div class="v16-exam-head"><div><span class="v14-kicker">QUESTION BANK</span><h1>คลังข้อสอบ ${esc(sub.code)}</h1><p>${esc(sub.name)} • ใช้คลังเดียวกันในการสร้างข้อสอบ 50 ข้อ และสุ่มต่อผู้เข้าสอบ</p></div><div class="row wrap"><button class="btn primary" id="bank-add">＋ เพิ่มข้อ</button><button class="btn" id="bank-import">Import JSON</button><button class="btn" id="bank-export">Export JSON</button></div></div><div class="v16-exam-kpis"><div><span>ทั้งหมด</span><b>${rows.length}</b></div><div><span>ใช้งาน</span><b>${rows.filter(x=>x.active).length}</b></div><div><span>ขั้นต่ำสร้างสอบ</span><b>50</b></div><div><span>สถานะ</span><b>${rows.filter(x=>x.active).length>=50?"พร้อม":"ยังไม่ครบ"}</b></div></div><div class="card v16-bank-filter"><select id="bank-subject" class="input">${subjects.map(x=>`<option value="${x.id}" ${x.id===sid?"selected":""}>${esc(x.code)} ${esc(x.name)}</option>`).join("")}</select><input id="bank-q" class="input" placeholder="ค้นหาคำถาม"></div><div id="bank-list" class="v16-bank-list"></div><input id="bank-file" type="file" accept="application/json,.json" hidden>`;
    const render=()=>{const q=$("#bank-q").value.trim().toLowerCase(),f=rows.filter(x=>!q||`${x.prompt} ${(x.options||[]).join(" ")}`.toLowerCase().includes(q));$("#bank-list").innerHTML=f.map((x,i)=>`<article class="v16-bank-q ${x.active?"":"disabled"}"><div class="row between"><b>ข้อ ${i+1}</b><span class="v14-status ${x.active?"approved":"muted"}">${x.active?"ใช้งาน":"ปิดใช้งาน"}</span></div><h3>${esc(x.prompt)}</h3><ol type="A">${(x.options||[]).map(o=>`<li class="${String(o)===String(x.correct_answer)?"correct":""}">${esc(o)}</li>`).join("")}</ol><div class="row end"><button class="btn sm" data-bank-edit="${x.id}">แก้ไข</button>${x.active?`<button class="btn red sm" data-bank-delete="${x.id}">ปิดใช้งาน</button>`:`<button class="btn green sm" data-bank-edit="${x.id}" data-reactivate="1">เปิดใช้งาน</button>`}</div></article>`).join("")||'<div class="v14-empty">ยังไม่มีข้อสอบในคลัง</div>';$$('[data-bank-edit]').forEach(b=>b.onclick=()=>bankQuestionDialog(sid,rows.find(x=>x.id===b.dataset.bankEdit),()=>draw(sid),b.dataset.reactivate==="1"));$$('[data-bank-delete]').forEach(b=>b.onclick=async()=>{if(!confirm("ปิดใช้งานข้อนี้?"))return;const r=await c.rpc("admin_delete_exam_question",{p_id:b.dataset.bankDelete});if(r.error)msg(err(r.error),true);else draw(sid)})};render();
    $("#bank-q").oninput=render;$("#bank-subject").onchange=e=>draw(e.target.value);$("#bank-add").onclick=()=>bankQuestionDialog(sid,null,()=>draw(sid));$("#exam-back").onclick=adminHome;
    $("#bank-export").onclick=()=>{const out=rows.map(x=>({id:x.source_key||x.id,subjectCode:sub.code,q:x.prompt,options:x.options,correct:(x.options||[]).findIndex(o=>String(o)===String(x.correct_answer)),explain:x.explanation||"",level:x.difficulty||"",theme:x.theme||""}));jsonDownload(out,`question-bank-${sub.code}.json`)};
    $("#bank-import").onclick=()=>$("#bank-file").click();$("#bank-file").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const raw=JSON.parse(await file.text()),arr=Array.isArray(raw)?raw:Array.isArray(raw.questions)?raw.questions:[];const items=arr.map(x=>({...x,subjectCode:x.subjectCode||x.subject_code||sub.code}));if(!items.length)throw new Error("ไม่พบรายการคำถาม");const r=await c.rpc("admin_import_exam_bank",{p_items:items});if(r.error)throw r.error;msg(`นำเข้า ${r.data?.imported||0} ข้อ • ข้าม ${r.data?.skipped||0} ข้อ`);draw(sid)}catch(ex){msg(err(ex),true)}};
  };
  draw(subjectId);
}

function bankQuestionDialog(subjectId,q,onDone,forceActive=false){
  const options=Array.isArray(q?.options)&&q.options.length===4?q.options:["","","",""];
  app().innerHTML=`<button class="btn" id="bank-back">← กลับคลัง</button><div class="v16-simple-page"><span class="v14-kicker">QUESTION EDITOR</span><h1>${q?"แก้ไขคำถาม":"เพิ่มคำถาม"}</h1><form id="bank-q-form" class="card v16-form-stack"><label>คำถาม<textarea class="input" name="prompt" rows="3" required>${esc(q?.prompt||"")}</textarea></label>${options.map((o,i)=>`<label>ตัวเลือก ${String.fromCharCode(65+i)}<input class="input" name="o${i}" required value="${esc(o)}"></label>`).join("")}<label>เฉลย<select class="input" name="correct">${options.map((o,i)=>`<option value="${i}" ${String(o)===String(q?.correct_answer)?"selected":""}>${String.fromCharCode(65+i)}</option>`).join("")}</select></label><label>คำอธิบายเฉลย<textarea class="input" name="explanation" rows="2">${esc(q?.explanation||"")}</textarea></label><div class="v14-form-grid"><label>ระดับความยาก<input class="input" name="difficulty" value="${esc(q?.difficulty||"")}" placeholder="ง่าย/กลาง/ยาก"></label><label>หัวข้อ<input class="input" name="theme" value="${esc(q?.theme||"")}"></label></div><div class="row end"><button class="btn primary">บันทึกคำถาม</button></div></form></div>`;
  $("#bank-back").onclick=onDone;$("#bank-q-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),opts=[0,1,2,3].map(i=>String(f.get(`o${i}`)||"").trim()),idx=Number(f.get("correct")),r=await db().rpc("admin_upsert_exam_question",{p_id:q?.id||null,p_subject_id:subjectId,p_prompt:String(f.get("prompt")||""),p_options:opts,p_correct_answer:opts[idx],p_explanation:String(f.get("explanation")||"")||null,p_difficulty:String(f.get("difficulty")||"")||null,p_theme:String(f.get("theme")||"")||null,p_active:forceActive?true:q?.active!==false});if(r.error){msg(err(r.error),true);return}msg("บันทึกคำถามแล้ว");onDone()}
}

// ---------------------------------------------------------------------
// Admin results / reset / realtime
// ---------------------------------------------------------------------
async function resultsView(id){
  cleanupExamSecurity();closeChannel();const c=db();
  const [er,ar]=await Promise.all([c.from("exams").select("id,title,exam_kind,full_score,question_count_target,subjects(code,name)").eq("id",id).single(),c.from("exam_attempts").select("*,profiles(full_name,student_code,class_name)").eq("exam_id",id).order("started_at",{ascending:false})]);if(ar.error){msg(err(ar.error),true);return}
  const exam=er.data,rows=ar.data||[],avg=rows.filter(x=>x.score!=null).length?rows.filter(x=>x.score!=null).reduce((a,x)=>a+Number(x.score),0)/rows.filter(x=>x.score!=null).length:0;
  app().innerHTML=`<button class="btn" id="exam-back">← กลับ</button><div class="v16-exam-head"><div><span class="v14-kicker">EXAM RESULTS • ADMIN ONLY</span><h1>${esc(exam?.title||"")}</h1><p>${esc(exam?.subjects?.code||"")} ${esc(exam?.subjects?.name||"")} • คะแนนไม่เปิดเผยแก่ Student</p></div><button class="btn" id="result-csv">⬇️ CSV</button></div><div class="v16-exam-kpis"><div><span>เข้าสอบ</span><b>${rows.length}</b></div><div><span>คะแนนเฉลี่ย</span><b>${avg.toFixed(2)}</b></div><div><span>เต็ม</span><b>${Number(exam?.full_score||20)}</b></div><div><span>สูตร</span><b>ถูก × 20/50</b></div></div><div class="table-wrap"><table><thead><tr><th>นักศึกษา</th><th>ครั้ง</th><th>ส่ง</th><th>ถูก</th><th>คะแนน /20</th><th>สลับแท็บ</th><th>ออก Fullscreen</th><th>Copy/Paste</th><th>รวมเหตุการณ์</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.profiles?.full_name||"")}</b><div class="muted smalltext">${esc(x.profiles?.student_code||"")} • ${esc(x.profiles?.class_name||"")}</div></td><td>${x.attempt_no}</td><td>${fmt(x.submitted_at||x.started_at)}</td><td>${x.correct_count??"-"}/${exam?.question_count_target||50}</td><td><b>${x.score??"-"}</b>/${x.max_score??exam?.full_score??20}</td><td>${x.tab_switch_count||0}</td><td>${x.fullscreen_exit_count||0}</td><td>${x.copy_paste_count||0}</td><td><span class="v14-status ${(x.violation_count||0)>0?"pending":"approved"}">${x.violation_count||0}</span></td><td><button class="btn red sm" data-reset-user="${x.user_id}">รีเซ็ตผู้สอบ</button></td></tr>`).join("")||`<tr><td colspan="10" class="empty">ยังไม่มีผู้เข้าสอบ</td></tr>`}</tbody></table></div>`;
  $("#exam-back").onclick=adminHome;$("#result-csv").onclick=()=>csvDownload([["รหัส","ชื่อ","ห้อง","ครั้ง","ถูก","คะแนน","สลับแท็บ","ออก fullscreen","copy/paste","context menu","print","เหตุการณ์รวม"],...rows.map(x=>[x.profiles?.student_code,x.profiles?.full_name,x.profiles?.class_name,x.attempt_no,x.correct_count,x.score,x.tab_switch_count,x.fullscreen_exit_count,x.copy_paste_count,x.context_menu_count,x.print_attempt_count,x.violation_count])],`exam-results-${exam?.subjects?.code||"subject"}.csv`);
  $$('[data-reset-user]').forEach(b=>b.onclick=async()=>{if(!confirm("รีเซ็ตผู้เข้าสอบคนนี้? เขาจะสามารถเริ่มสอบใหม่ตามสิทธิ์ของชุดสอบ"))return;const r=await c.rpc("admin_reset_exam_user",{p_exam_id:id,p_user_id:b.dataset.resetUser});if(r.error)msg(err(r.error),true);else{msg("รีเซ็ตแล้ว");resultsView(id)}});
  const rt=await rtClient();if(rt){state.examChannel=rt.channel(`exam-result-${id}-${Date.now()}`).on("postgres_changes",{event:"*",schema:"public",table:"exam_attempts",filter:`exam_id=eq.${id}`},()=>{clearTimeout(resultsView.t);resultsView.t=setTimeout(()=>resultsView(id),800)}).subscribe()}
}

// ---------------------------------------------------------------------
// Student list / exam attempt
// ---------------------------------------------------------------------
async function studentHome(){
  cleanupExamSecurity();closeChannel();const c=db();const {data:as,error}=await c.from("exam_assignments").select("exam_id,assigned_at").eq("user_id",state.profile.id).order("assigned_at",{ascending:false});if(error){app().innerHTML=`<div class="alert error">${esc(err(error))}</div>`;return}
  const ids=[...new Set((as||[]).map(x=>x.exam_id))];let exams=[],attempts=[];
  if(ids.length){const [er,ar]=await Promise.all([c.from("exams").select("*,subjects(code,name,color_hex)").in("id",ids),c.rpc("my_exam_attempt_status",{p_exam_id:null})]);if(er.error){app().innerHTML=`<div class="alert error">${esc(err(er.error))}</div>`;return}exams=(er.data||[]).filter(x=>!roomSubject||x.subject_id===roomSubject);attempts=(ar.data||[]).filter(x=>ids.includes(x.exam_id)&&(!roomSubject||exams.some(e=>e.id===x.exam_id)))}
  app().innerHTML=`<div class="v16-exam-head"><div><span class="v14-kicker">ONLINE EXAMINATION</span><h1>${roomSubject?"ข้อสอบของห้องเรียนนี้":"ระบบสอบของฉัน"}</h1><p>ข้อสอบกลาง/ปลายภาค 50 ข้อ • 75 นาที • ระบบส่งอัตโนมัติเมื่อหมดเวลา • ไม่แสดงคะแนนหรือเฉลยหลังส่ง</p></div></div><div class="exam-grid">${exams.map(x=>{const a=attempts.filter(z=>z.exam_id===x.id).sort((m,n)=>n.attempt_no-m.attempt_no)[0],before=x.open_at&&now()<new Date(x.open_at),after=x.due_at&&now()>new Date(x.due_at),label=a?.status==="draft"?"กำลังสอบ":a?"ส่งแล้ว":"ยังไม่เริ่ม";return `<article class="exam-card"><div class="row between"><span class="v14-kicker">${esc(x.subjects?.code||"")}</span><span class="v16-kind">${x.exam_kind==="midterm"?"กลางภาค":x.exam_kind==="final"?"ปลายภาค":"แบบทดสอบ"}</span></div><h3>${esc(x.title)}</h3><small>${esc(x.subjects?.name||"")}</small><div class="v16-exam-spec"><span>📝 ${x.question_count_target||50} ข้อ</span><span>⏱ ${x.duration_minutes||75} นาที</span></div><small>เปิด ${fmt(x.open_at)}<br>ปิด ${fmt(x.due_at)}</small>${a?`<span class="v14-status ${a.status==="draft"?"pending":"approved"}">${label}</span>`:""}<button class="btn primary" data-start-exam="${x.id}" ${before||after||a&&a.status!=="draft"?"disabled":""}>${before?"ยังไม่เปิด":after?"หมดเวลา":a?.status==="draft"?"ทำต่อ":a?"ส่งแล้ว":"เริ่มสอบ"}</button></article>`}).join("")||`<div class="v14-empty">ยังไม่มีข้อสอบที่มอบหมาย</div>`}</div>`;
  $$('[data-start-exam]').forEach(b=>b.onclick=()=>startAttempt(b.dataset.startExam));
}

async function startAttempt(examId){
  const {data,error}=await db().rpc("start_exam",{p_exam_id:examId});if(error){msg(err(error),true);return}
  if(data?.expired_finalized&&data?.exhausted){app().innerHTML=`<div class="exam-result card"><span class="v14-kicker">AUTO SUBMITTED</span><h1>หมดเวลา • ระบบส่งข้อสอบให้แล้ว</h1><strong>✓</strong><p>บันทึกการสอบเรียบร้อย</p><p class="muted">ระบบผู้เรียนไม่แสดงคะแนนหรือเฉลย</p><button class="btn primary" id="exam-finish">กลับรายการสอบ</button></div>`;$("#exam-finish").onclick=studentHome;return}
  state.attempt=data;state.answers={...(data.answers||{})};state.flags=new Set();state.currentIndex=0;state.dirty=false;state.violationLocal=0;state.fullscreenExpected=!!data.exam?.require_fullscreen;renderAttempt();
}

async function enterFullscreen(){if(!state.attempt||document.fullscreenElement)return;try{state.fullscreenPrompting=true;await document.documentElement.requestFullscreen();state.fullscreenPrompting=false}catch{state.fullscreenPrompting=false;msg("เบราว์เซอร์ไม่อนุญาต Fullscreen อัตโนมัติ กรุณากดปุ่ม 'เข้าสู่ Fullscreen'",true)}}
async function recordViolation(type){if(!state.attempt?.attempt_id||state.submitting)return;state.violationLocal++;const el=$("#exam-violations");if(el)el.textContent=`เหตุการณ์ออกนอกการสอบ ${state.violationLocal} ครั้ง`;try{await db().rpc("record_exam_violation",{p_attempt_id:state.attempt.attempt_id,p_event:type})}catch{}}
function onRestricted(ev){if(!$(".exam-attempt"))return;ev.preventDefault();const type=ev.type==="contextmenu"?"contextmenu":ev.type;recordViolation(type);msg("ระหว่างสอบไม่อนุญาตคำสั่งนี้",true)}
function onVisibility(){if($(".exam-attempt")&&document.visibilityState==="hidden")recordViolation("tab_switch")}
function onFullscreenChange(){if(!$(".exam-attempt")||!state.fullscreenExpected||state.fullscreenPrompting)return;if(!document.fullscreenElement){recordViolation("fullscreen_exit");msg("ตรวจพบการออกจาก Fullscreen กรุณากลับเข้าสู่โหมดสอบ",true);$("#exam-fullscreen")?.classList.add("warn")}}
function onKey(ev){if(!$(".exam-attempt"))return;if((ev.ctrlKey||ev.metaKey)&&String(ev.key).toLowerCase()==="p"){ev.preventDefault();recordViolation("print");msg("ไม่อนุญาตพิมพ์ข้อสอบ",true)}}
function onBeforePrint(){if($(".exam-attempt"))recordViolation("print")}
function bindExamSecurity(){if(state.antiCheatBound)return;state.antiCheatBound=true;["copy","paste","cut","contextmenu"].forEach(x=>document.addEventListener(x,onRestricted,true));document.addEventListener("visibilitychange",onVisibility,true);document.addEventListener("fullscreenchange",onFullscreenChange,true);document.addEventListener("keydown",onKey,true);window.addEventListener("beforeprint",onBeforePrint)}
function cleanupExamSecurity(){if(!state.antiCheatBound)return;state.antiCheatBound=false;["copy","paste","cut","contextmenu"].forEach(x=>document.removeEventListener(x,onRestricted,true));document.removeEventListener("visibilitychange",onVisibility,true);document.removeEventListener("fullscreenchange",onFullscreenChange,true);document.removeEventListener("keydown",onKey,true);window.removeEventListener("beforeprint",onBeforePrint);clearInterval(state.timer);clearTimeout(state.saveTimer)}

function renderAttempt(){
  const a=state.attempt,e=a.exam,seed=a.attempt_id;let qs=e.questions||[];if(e.shuffle_questions)qs=seededOrder(qs,seed+"q");state.attempt.orderedQuestions=qs;
  app().innerHTML=`<div class="exam-attempt"><div class="exam-workbar"><div><b>${esc(e.title)}</b><div class="exam-fullscreen-note">${qs.length} ข้อ • ${e.duration_minutes||75} นาที • Autosave • ส่งอัตโนมัติเมื่อหมดเวลา</div></div><div class="exam-timer" id="exam-timer"></div><div class="row"><button class="btn" id="exam-fullscreen">⛶ Fullscreen</button><button class="btn green" id="exam-submit">ส่งข้อสอบ</button></div></div><div class="v16-exam-alert"><b>กติกาการสอบ</b><span>ห้าม Copy/Paste, Context Menu, Print, สลับแท็บ หรือออก Fullscreen ระบบจะบันทึกเหตุการณ์ไว้ให้ Admin ตรวจสอบ</span><small id="exam-violations">เหตุการณ์ออกนอกการสอบ 0 ครั้ง</small></div><div class="exam-nav" id="exam-nav">${qs.map((q,i)=>`<button class="btn sm" data-jump="${i}">${i+1}</button>`).join("")}</div><div id="exam-question-area"></div><div class="exam-autosave" id="exam-save-state">พร้อมบันทึก</div></div>`;
  $("#exam-submit").onclick=()=>submitAttempt(false);$("#exam-fullscreen").onclick=enterFullscreen;$$('[data-jump]').forEach(b=>b.onclick=()=>{state.currentIndex=Number(b.dataset.jump);drawQuestion()});drawQuestion();startTimer();bindExamSecurity();setTimeout(enterFullscreen,150);
}
function drawQuestion(){
  const qs=state.attempt.orderedQuestions||[],q=qs[state.currentIndex];if(!q)return;let opts=q.options||[];if(state.attempt.exam.shuffle_options&&q.type==="mcq")opts=seededOrder(opts,state.attempt.attempt_id+q.id);const val=state.answers[q.id]??"";
  $("#exam-question-area").innerHTML=`<article class="exam-question"><span class="v14-kicker">ข้อ ${state.currentIndex+1} / ${qs.length}</span><h3>${esc(q.prompt||q.text||"")}</h3><div class="exam-options">${opts.map((o,i)=>{const v=typeof o==="object"?(o.value||o.text||o.label):o;return `<label class="exam-option"><input type="radio" name="exam-answer" value="${esc(v)}" ${String(val)===String(v)?"checked":""}><span><i>${String.fromCharCode(65+i)}</i>${esc(v)}</span></label>`}).join("")}</div><button class="btn exam-flag" id="exam-flag">${state.flags.has(q.id)?"🚩 ยกเลิกปักธง":"⚑ ปักธงข้อนี้"}</button><div class="row between"><button class="btn" id="exam-prev" ${state.currentIndex===0?"disabled":""}>← ก่อนหน้า</button><button class="btn primary" id="exam-next" ${state.currentIndex===qs.length-1?"disabled":""}>ถัดไป →</button></div></article>`;
  $$('input[name="exam-answer"]').forEach(x=>x.onchange=()=>setAnswer(q.id,x.value));$("#exam-flag").onclick=()=>{state.flags.has(q.id)?state.flags.delete(q.id):state.flags.add(q.id);drawQuestion();drawNav()};$("#exam-prev").onclick=()=>{state.currentIndex--;drawQuestion()};$("#exam-next").onclick=()=>{state.currentIndex++;drawQuestion()};drawNav();
}
function drawNav(){const qs=state.attempt.orderedQuestions||[];$$('[data-jump]').forEach((b,i)=>{const q=qs[i];b.classList.toggle("answered",String(state.answers[q.id]??"").trim()!=="");b.classList.toggle("flagged",state.flags.has(q.id));b.classList.toggle("primary",i===state.currentIndex)})}
function setAnswer(id,v){state.answers[id]=v;state.dirty=true;drawNav();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(saveAnswers,900)}
async function saveAnswers(){if(state.submitting||!state.attempt)return;const e=$("#exam-save-state");if(e)e.textContent="กำลังบันทึก...";const {error}=await db().rpc("save_exam_answers",{p_attempt_id:state.attempt.attempt_id,p_answers:state.answers});if(e)e.textContent=error?`บันทึกไม่สำเร็จ • จะลองใหม่เมื่อแก้คำตอบ: ${err(error)}`:`บันทึกล่าสุด ${new Date().toLocaleTimeString("th-TH")}`;if(!error)state.dirty=false}
function startTimer(){clearInterval(state.timer);const tick=()=>{const el=$("#exam-timer");if(!el)return;let ms=new Date(state.attempt.expires_at).getTime()-now();if(ms<=0){el.textContent="หมดเวลา";el.classList.add("danger");clearInterval(state.timer);submitAttempt(true);return}const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),sec=Math.floor(ms%60000/1000);el.textContent=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;if(ms<300000)el.classList.add("danger")};tick();state.timer=setInterval(tick,1000)}
async function submitAttempt(auto){
  if(state.submitting)return;if(!auto&&!confirm("ยืนยันส่งข้อสอบ? หลังส่งแล้วแก้คำตอบไม่ได้"))return;state.submitting=true;clearTimeout(state.saveTimer);clearInterval(state.timer);const {data,error}=await db().rpc("submit_exam_attempt",{p_attempt_id:state.attempt.attempt_id,p_answers:state.answers});state.submitting=false;if(error){msg(err(error),true);startTimer();return}state.dirty=false;cleanupExamSecurity();try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}app().innerHTML=`<div class="exam-result card"><span class="v14-kicker">EXAM SUBMITTED</span><h1>${auto?"หมดเวลา • ระบบส่งข้อสอบให้แล้ว":"ส่งข้อสอบสำเร็จ"}</h1><strong>✓</strong><p>ระบบบันทึกคำตอบเรียบร้อยแล้ว</p><p class="muted">คะแนนสอบกลางภาค/ปลายภาค เฉลย และความคิดเห็นเป็นข้อมูล Admin เท่านั้น นักศึกษาไม่สามารถขอเปิดดูจากระบบนี้ได้</p><button class="btn primary" id="exam-finish">กลับรายการสอบ</button></div>`;$("#exam-finish").onclick=studentHome;
}

async function boot(){await syncTime();const p=await profile();if(!p)return;document.documentElement.dataset.examVersion=VERSION;if(p.role==="admin")adminHome();else studentHome()}
window.addEventListener("beforeunload",e=>{if(state.attempt?.attempt_id&&state.dirty&&!state.submitting){e.preventDefault();e.returnValue=""}});
window.addEventListener("pagehide",()=>{cleanupExamSecurity();closeChannel()});
boot().catch(e=>{console.error("DOC-FULL-NR V16 Exam",e);app().innerHTML=`<div class="alert error">${esc(err(e))}</div>`});
