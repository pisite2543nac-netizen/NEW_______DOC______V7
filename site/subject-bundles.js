import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF="thjscmfqunlaqxlievna";
const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;
const FEATURE_VERSION="V11-SUBJECT-BUNDLES";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const safeName=s=>String(s||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120);

let profileCache=null;
let currentSubjectId=null;

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
    global:{headers:s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{}}
  });
}
async function profile(force=false){
  if(!force&&profileCache)return profileCache;
  const id=uid(); if(!id)return null;
  const {data}=await client().from("profiles").select("id,role,active,full_name").eq("id",id).maybeSingle();
  profileCache=data||null; return profileCache;
}
function content(){return $("#content")}
function activeNav(btn){
  const nav=$("#sidebar .nav");
  if(!nav)return;
  $$("button",nav).forEach(x=>x.classList.remove("active"));
  btn?.classList.add("active");
}
function toast(msg,bad=false){
  let el=$("#v11-toast");
  if(!el){el=document.createElement("div");el.id="v11-toast";document.body.appendChild(el)}
  el.className=`v11-toast show${bad?" bad":""}`;el.textContent=msg;
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.className="v11-toast",3200);
}
function busy(msg="กำลังโหลด..."){
  if(content())content().innerHTML=`<div class="card v11-busy">${esc(msg)}</div>`;
}
function seqOf(w){return Number(w?.settings?.lesson_sequence||w?.settings?.sequence_no||w?.settings?.week_no||0)||0}
function abbr(w){
  const m=String(w.reference_code||"").match(/-([DP]\d{2})$/);
  return m?m[1]:(w.mode==="paper"?"P":"D");
}
function modeTH(w){return w.mode==="paper"?"ใบงานกระดาษ":"ใบงานดิจิทัล"}
function subjectColor(s){return s?.color_hex||"#2563eb"}
function isReady(w){return w?.settings?.template_ready===true}
function fileMatchesWorksheet(f,w){
  if(f.worksheet_id===w.id)return true;
  const seq=seqOf(w);
  return !f.worksheet_id&&seq>0&&Number(f.sequence_no||0)===seq;
}
function scheduleLabel(w){
  if(!w.open_at&&!w.due_at)return "ยังไม่กำหนดวัน/เวลา";
  return `เปิด ${fmt(w.open_at)} · ส่ง ${fmt(w.due_at)}`;
}
function statusClass(w){return w.status==="published"?"published":(w.status==="archived"?"archived":"draft")}
function statusTH(w){return w.status==="published"?"เผยแพร่แล้ว":(w.status==="archived"?"เก็บถาวร":"ฉบับร่าง")}

async function enhanceNav(){
  const p=await profile();
  if(p?.role!=="admin")return;
  const btn=$('#sidebar .nav [data-route="worksheets"]');
  if(btn)btn.textContent="รายวิชา / ชุดใบงานและสไลด์";
}
new MutationObserver(()=>enhanceNav()).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(enhanceNav,500);

async function renderSubjectLibrary(){
  currentSubjectId=null;
  if(!content())return;
  busy("กำลังจัดใบงานทั้งหมดตามรายวิชา...");
  const c=client();
  const {data:subjects,error}=await c.from("subjects")
    .select("id,code,name,color_hex,academic_year,semester,subject_type,active")
    .eq("subject_type","subject").eq("active",true).order("code");
  if(error){content().innerHTML=`<div class="alert error">${esc(error.message)}</div>`;return}
  const ids=(subjects||[]).map(s=>s.id);
  let works=[],files=[];
  if(ids.length){
    const [wr,fr]=await Promise.all([
      c.from("worksheets").select("id,subject_id,mode,status,settings,reference_code,open_at,due_at,title").in("subject_id",ids),
      c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no").in("subject_id",ids)
    ]);
    works=wr.data||[]; files=fr.data||[];
  }
  const cards=(subjects||[]).map(s=>{
    const ws=works.filter(w=>w.subject_id===s.id&&isReady(w));
    const paper=ws.filter(w=>w.mode==="paper").length;
    const digital=ws.filter(w=>w.mode==="digital").length;
    const linked=files.filter(f=>f.subject_id===s.id).length;
    const withMedia=ws.filter(w=>files.some(f=>fileMatchesWorksheet(f,w))).length;
    return `<article class="card v11-subject" data-v11-card="${s.id}" style="--v11-color:${subjectColor(s)}">
      <div class="v11-subject-top"><div class="v11-dot"></div><div><b>${esc(s.code)}</b><h3>${esc(s.name)}</h3></div></div>
      <div class="v11-pills"><span>ทั้งหมด ${ws.length} ใบงาน</span><span>Paper ${paper}</span><span>Digital ${digital}</span><span>สื่อ ${linked}</span></div>
      <div class="v11-progress"><i style="width:${ws.length?Math.round(withMedia/ws.length*100):0}%"></i></div>
      <div class="v11-subnote">จับคู่ใบงานกับสไลด์แล้ว ${withMedia}/${ws.length} ชุด</div>
      <button class="btn primary w100" data-v11-open-subject="${s.id}">เปิดชุดการเรียนของรายวิชานี้</button>
    </article>`;
  }).join("");
  content().innerHTML=`<section class="v11-library">
    <div class="section-head"><div><h1>รายวิชา / ชุดใบงานและสไลด์</h1><div class="muted">ใบงานทั้งหมดถูกซ่อนไว้ภายในรายวิชา เมื่อเปิดรายวิชาจะเห็นใบงานและสไลด์ประกอบเป็นชุดเดียวกัน</div></div></div>
    <div class="card v11-toolbar"><div class="field"><label>ค้นหารายวิชา</label><input id="v11-search-subject" class="input" placeholder="รหัสวิชา / ชื่อวิชา"></div>
      <div class="v11-info"><b>รูปแบบใหม่:</b> รายวิชา → ชุดการเรียน → ใบงาน + สไลด์/สื่อ + เป้าหมาย + วัน/เวลา</div></div>
    <div class="v11-subject-grid">${cards||'<div class="card">ไม่พบรายวิชา</div>'}</div>
  </section>`;
  $("#v11-search-subject")?.addEventListener("input",e=>{
    const term=e.target.value.trim().toLowerCase();
    (subjects||[]).forEach(s=>{
      const el=$(`[data-v11-card="${s.id}"]`);
      if(el)el.hidden=term&&!`${s.code} ${s.name}`.toLowerCase().includes(term);
    });
  });
}

function mediaButtons(files){
  if(!files.length)return `<div class="v11-empty-media"><b>ยังไม่มีสไลด์/สื่อที่จับคู่</b><small>เพิ่มไฟล์แล้วระบบจะผูกกับใบงานชุดนี้ทันที</small></div>`;
  return `<div class="v11-media-list">${files.map(f=>`<button class="v11-media-file" data-v11-open-file="${f.id}" title="เปิดไฟล์"><span>📊</span><span><b>${esc(f.original_name||"ไฟล์สื่อ")}</b><small>${esc(f.resource_kind||"slide")}</small></span></button>`).join("")}</div>`;
}
function bundleCard(w,files,subject){
  const media=files.filter(f=>fileMatchesWorksheet(f,w));
  const seq=seqOf(w);
  const goal=w.settings?.learning_goal||"ยังไม่ได้กำหนดเป้าหมายการเรียน";
  return `<article class="card v11-bundle ${esc(w.mode)}" data-v11-bundle data-search="${esc(`${w.reference_code||""} ${w.title||""} ${goal}`.toLowerCase())}" style="--v11-color:${subjectColor(subject)}">
    <div class="v11-bundle-head">
      <div class="v11-set-no"><span>ชุด</span><b>${esc(abbr(w))}</b></div>
      <div class="v11-title"><div class="v11-badges"><span>${esc(modeTH(w))}</span><span class="${statusClass(w)}">${esc(statusTH(w))}</span>${seq?`<span>ลำดับ ${seq}</span>`:""}</div><h2>${esc(w.title||w.reference_code||"ใบงาน")}</h2><small>${esc(w.reference_code||"")}</small></div>
    </div>
    <div class="v11-pair">
      <section class="v11-pane worksheet-pane"><div class="v11-pane-title"><span>📝</span><div><b>ใบงาน</b><small>งานที่ผู้เรียนต้องทำ</small></div></div>
        <div class="v11-goal"><b>🎯 เป้าหมาย:</b> ${esc(goal)}</div>
        <div class="v11-time ${w.open_at||w.due_at?"":"unset"}">🗓 ${esc(scheduleLabel(w))}</div>
        <div class="v11-actions"><button class="btn" data-v8-preview="${w.id}">ดูตัวอย่างใบงาน</button><button class="btn primary" data-v9-schedule="${w.id}">กำหนดวัน/เวลา</button><button class="btn" data-v9-edit-goal="${w.id}" data-v9-subject="${subject.id}">แก้เป้าหมาย</button></div>
      </section>
      <div class="v11-link" aria-hidden="true"><span>⇄</span><small>ชุดเดียวกัน</small></div>
      <section class="v11-pane media-pane"><div class="v11-pane-title"><span>📊</span><div><b>สไลด์ / สื่อประกอบ</b><small>เปิดใช้สอนคู่กับใบงานชุดนี้</small></div></div>
        ${mediaButtons(media)}
        <button class="btn v11-upload" data-v11-upload="${w.id}" data-v11-subject="${subject.id}" data-v11-seq="${seq}">+ เพิ่มสไลด์/สื่อให้ชุดนี้</button>
      </section>
    </div>
  </article>`;
}

async function renderSubject(subjectId){
  currentSubjectId=subjectId;
  if(!content())return;
  busy("กำลังรวมใบงานและสไลด์เป็นชุด...");
  const c=client();
  const [sr,wr,fr]=await Promise.all([
    c.from("subjects").select("id,code,name,color_hex,academic_year,semester").eq("id",subjectId).single(),
    c.from("worksheets").select("id,subject_id,title,reference_code,mode,status,settings,open_at,due_at").eq("subject_id",subjectId),
    c.from("subject_files").select("id,subject_id,worksheet_id,resource_kind,sequence_no,original_name,storage_path,mime_type,size_bytes,created_at").eq("subject_id",subjectId).order("sequence_no",{ascending:true})
  ]);
  if(sr.error||wr.error||fr.error){const e=sr.error||wr.error||fr.error;content().innerHTML=`<div class="alert error">${esc(e.message)}</div>`;return}
  const subject=sr.data;
  const works=(wr.data||[]).filter(isReady).sort((a,b)=>{
    const sa=seqOf(a),sb=seqOf(b);if(sa!==sb)return (sa||999)-(sb||999);
    if(a.mode!==b.mode)return a.mode==="paper"?-1:1;
    return String(a.reference_code||"").localeCompare(String(b.reference_code||""),"th");
  });
  const files=fr.data||[];
  const mediaMatched=works.filter(w=>files.some(f=>fileMatchesWorksheet(f,w))).length;
  content().innerHTML=`<section class="v11-hub" style="--v11-color:${subjectColor(subject)}">
    <div class="v11-hero card"><button class="btn" data-v11-back>← กลับรายวิชา</button><div><b>${esc(subject.code)}</b><h1>${esc(subject.name)}</h1><div class="muted">ภาคเรียน ${esc(subject.semester||"-")} · ปีการศึกษา ${esc(subject.academic_year||"-")}</div></div><div class="v11-hero-count"><b>${works.length}</b><span>ชุดใบงาน</span><small>มีสื่อจับคู่ ${mediaMatched} ชุด</small></div></div>
    <div class="card v11-filter"><div class="field"><label>ค้นหาภายในวิชานี้</label><input id="v11-search-bundle" class="input" placeholder="ชื่อใบงาน / รหัส / เป้าหมาย"></div><div class="v11-info">แต่ละการ์ดด้านล่างคือ <b>1 ชุดการเรียน</b> ที่รวมใบงานและสไลด์/สื่อไว้คู่กัน</div></div>
    <div id="v11-bundles" class="v11-bundle-list">${works.map(w=>bundleCard(w,files,subject)).join("")||'<div class="card">ยังไม่มีใบงานสำเร็จรูปในรายวิชานี้</div>'}</div>
  </section>`;
  $("#v11-search-bundle")?.addEventListener("input",e=>{
    const term=e.target.value.trim().toLowerCase();
    $$("[data-v11-bundle]").forEach(el=>el.hidden=term&&!el.dataset.search.includes(term));
  });
}

async function openPrivateFile(fileId){
  const c=client();
  const {data:f,error}=await c.from("subject_files").select("id,storage_path,original_name").eq("id",fileId).single();
  if(error){toast(error.message,true);return}
  const {data,error:se}=await c.storage.from("subject-files").createSignedUrl(f.storage_path,900);
  if(se||!data?.signedUrl){toast(se?.message||"เปิดไฟล์ไม่ได้",true);return}
  window.open(data.signedUrl,"_blank","noopener");
}
async function uploadMedia(subjectId,worksheetId,seq,selected){
  const files=[...selected||[]]; if(!files.length)return;
  const c=client();
  toast(`กำลังอัปโหลด ${files.length} ไฟล์...`);
  for(let i=0;i<files.length;i++){
    const f=files[i];
    const path=`${subjectId}/${worksheetId}/${Date.now()}-${i}-${safeName(f.name)}`;
    const {error:upErr}=await c.storage.from("subject-files").upload(path,f,{upsert:false,contentType:f.type||undefined});
    if(upErr){toast(`อัปโหลด ${f.name} ไม่สำเร็จ: ${upErr.message}`,true);return}
    const {error:dbErr}=await c.from("subject_files").insert({subject_id:subjectId,worksheet_id:worksheetId,resource_kind:"slide",sequence_no:seq||null,original_name:f.name,storage_path:path,mime_type:f.type||null,size_bytes:f.size||null,created_by:uid()});
    if(dbErr){await c.storage.from("subject-files").remove([path]);toast(`บันทึก ${f.name} ไม่สำเร็จ: ${dbErr.message}`,true);return}
  }
  toast("เพิ่มสไลด์/สื่อและจับคู่กับใบงานเรียบร้อย");
  await renderSubject(subjectId);
}

// This listener is loaded before v9-features.js so the subject-first page wins for Admin.
document.addEventListener("click",async e=>{
  const t=e.target.closest("button,a"); if(!t)return;
  const route=t.closest("[data-route]")?.dataset.route;
  if(route==="worksheets"){
    const p=await profile();
    if(p?.role==="admin"){
      e.preventDefault();e.stopImmediatePropagation();activeNav(t.closest("[data-route]"));await renderSubjectLibrary();return;
    }
  }
  if(t.matches("[data-v11-open-subject]")){
    e.preventDefault();e.stopImmediatePropagation();await renderSubject(t.dataset.v11OpenSubject);return;
  }
  if(t.matches("[data-v11-back]")){
    e.preventDefault();e.stopImmediatePropagation();await renderSubjectLibrary();return;
  }
  if(t.matches("[data-v11-open-file]")){
    e.preventDefault();e.stopImmediatePropagation();await openPrivateFile(t.dataset.v11OpenFile);return;
  }
  if(t.matches("[data-v11-upload]")){
    e.preventDefault();e.stopImmediatePropagation();
    const input=document.createElement("input");input.type="file";input.multiple=true;input.accept=".ppt,.pptx,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp4";
    input.onchange=()=>uploadMedia(t.dataset.v11Subject,t.dataset.v11Upload,Number(t.dataset.v11Seq||0)||null,input.files);
    input.click();return;
  }
},true);

window.addEventListener("docfullnr:v11-refresh",()=>{if(currentSubjectId)renderSubject(currentSubjectId)});
console.info(`[DOC-FULL-NR] ${FEATURE_VERSION} loaded`);
