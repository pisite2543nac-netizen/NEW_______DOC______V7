import { getClient } from "./v18-supabase.js";
const V179_UNLOCK_COMPAT="admin_unlock_subject_unit_v179"; // compatibility contract; V19 wraps the hardened V17.9 unlock RPC

const RELEASE = "V19.1-COMPLETE-STABILIZED-CLASSROOM-FLOW";
const V176_COMPAT_RELEASE="V17.6-FULL-11SUBJECTS";
const v179Key=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const V173_COMPAT_ADMIN_SLIDE_LABEL="สไลด์สรุปพร้อมใช้";
const V174_COMPAT_RELEASE="V17.4-LEARNING-CONTENT-HUB";
const V174_COMPAT_KICKERS=["TEACHER NOTE","KEY CONCEPTS"];
const SUPABASE_URL = "https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const PROJECT_REF = "thjscmfqunlaqxlievna";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt = d=>d?new Date(d).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"-";
const localInput = d=>{
  const x=d?new Date(d):new Date();
  return new Date(x.getTime()-x.getTimezoneOffset()*60000).toISOString().slice(0,16);
};

const state={
  coursePath:new Map(),
  adminPath:new Map(),
  loadingStudent:new Set(),
  loadingAdmin:new Set(),
  role:null,
  uid:null
};

function readSession(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return null;
    const s=JSON.parse(raw);
    return s?.access_token&&s?.user?.id?s:null;
  }catch{return null}
}
function client(){return getClient()}
function flash(message,bad=false){
  let e=$("#v168-flash");
  if(!e){e=document.createElement("div");e.id="v168-flash";document.body.appendChild(e)}
  e.textContent=message;
  e.className=`v168-flash show${bad?" bad":""}`;
  clearTimeout(flash.t);
  flash.t=setTimeout(()=>e.className="v168-flash",4200);
}
function errText(err){
  const raw=String(err?.message||err?.details||err||"เกิดข้อผิดพลาด");
  const map={
    PREVIOUS_UNIT_LOCKED:"ต้องเปิดหน่วยก่อนหน้าให้ครบก่อน",
    ONE_UNIT_AT_A_TIME_REQUIRED:"ระบบอนุญาตให้เปิดทีละ 1 หน่วยเท่านั้น",
    STANDARD_TEMPLATE_MIX_NOT_ALLOWED:"กรุณาเปิดเฉพาะใบงานสำเร็จรูปของหน่วยเดียวกัน",
    INVALID_SCHEDULE:"วันหมดเขตต้องอยู่หลังเวลาเปิด",
    UNIT_NOT_FOUND:"ไม่พบหน่วยเรียนนี้",
    ADMIN_REQUIRED:"ต้องใช้บัญชี Admin",
    STUDENT_NOT_APPROVED_FOR_SUBJECT:"ยังไม่ได้เข้าร่วมรายวิชานี้ด้วย CODE",
    JOIN_CODE_INVALID:"CODE รายวิชาไม่ถูกต้อง",
    LATE_PAPER_NOT_OPEN_YET:"ยังไม่ถึงเวลาส่งย้อนหลัง ให้ทำใบงานอิเล็กทรอนิกส์ก่อน",
    DIGITAL_ALREADY_SUBMITTED:"ใบงานอิเล็กทรอนิกส์นี้ส่งเรียบร้อยแล้ว ไม่ต้องพิมพ์ย้อนหลัง",
    WORK_PAIR_REQUIRED:"ไม่พบคู่ใบงานของหน่วยนี้",
    DIGITAL_PAIR_NOT_FOUND:"ไม่พบใบงานอิเล็กทรอนิกส์คู่กัน",
    ATTENDANCE_CHECKIN_REQUIRED:"ต้องผ่านการเช็คชื่อจากหัวหน้าห้องของวันนี้ก่อน จึงจะทำหรือส่งใบงานอิเล็กทรอนิกส์ได้",
    UNIT_DIGITAL_WORKSHEET_NOT_FOUND:"ไม่พบใบงานอิเล็กทรอนิกส์ของหน่วยนี้"
  };
  for(const [k,v] of Object.entries(map))if(raw.includes(k))return v;
  return raw;
}
async function role(){
  const s=readSession();if(!s)return null;
  if(state.role&&state.uid===s.user.id)return state.role;
  const {data}=await client().from("profiles").select("role").eq("id",s.user.id).maybeSingle();
  state.uid=s.user.id;state.role=data?.role||null;return state.role;
}
function subjectIdFromPage(){
  return $("[data-v16-gradebook]")?.dataset.v16Gradebook
    || $("[data-v16-paper-scan]")?.dataset.v16PaperScan
    || $("[data-v15-room-exam]")?.dataset.v15RoomExam
    || null;
}

function decorateNav(){
  const enroll=$("#sidebar [data-v14-route='enroll']");
  if(enroll){
    const label=enroll.querySelector(".nav-card-label");
    if(label)label.textContent="รายวิชาทั้งหมด";
    enroll.title="ดูรายวิชาทั้งหมดและใส่ CODE เพื่อเข้าเรียน";
  }
  const courses=$("#sidebar [data-v14-route='courses']");
  if(courses){
    const label=courses.querySelector(".nav-card-label");
    if(label&&label.textContent!=="วิชาที่เรียนอยู่")label.textContent="วิชาที่เรียนอยู่";
  }
}

function decorateCatalog(){
  const page=$(".v165-enrollment-home");
  if(!page||page.dataset.v168Catalog)return;
  page.dataset.v168Catalog="1";
  const h=page.querySelector("h1");if(h)h.textContent="รายวิชาเรียนทั้งหมด";
  const p=page.querySelector(".v165-course-home-head p");
  if(p)p.textContent="เลือกรายวิชา → รับ CODE จาก Admin/ครูผู้สอน → กรอก CODE → เข้าเรียนทันที";
  $$("[data-v165-join-course]",page).forEach(b=>b.textContent="เลือกวิชา / ใส่ CODE");
  const help=page.querySelector(".v165-enroll-help");
  if(help)help.innerHTML=`<span>🔐</span><div><b>CODE จาก Admin คือสิทธิ์เข้าเรียนรายวิชา</b><p>เมื่อ CODE ถูกต้อง ระบบจะอนุมัติสมาชิกวิชาทันที แต่ใบงานและสไลด์แต่ละหน่วยยังถูกล็อกไว้ จนกว่า Admin จะกด “เริ่มสอน / ปลดล็อกหน่วย”</p></div>`;
}


function cleanTopic(title){
  return String(title||"หน่วยการเรียนรู้")
    .replace(/^ใบงาน(?:อิเล็กทรอนิกส์|พิมพ์)\s*\d+\s*:\s*/i,"")
    .replace(/^ใบงาน\s*\d+\s*:\s*/i,"")
    .trim()||"หน่วยการเรียนรู้";
}
function unitTopic(unit){
  const works=unit?.worksheets||[];
  const digital=works.find(w=>w.mode==="digital")||works[0];
  return cleanTopic(digital?.title||"");
}
function uniq(items){return [...new Set((items||[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]}
function teachingHints(subjectName,topic){
  const key=`${subjectName||""} ${topic||""}`.toLowerCase();
  if(/กฎหมายแรงงาน|แรงงาน|ลูกจ้าง|นายจ้าง|ค่าจ้าง|วันลา|เวลาทำงาน/.test(key))return [
    `ความหมายและขอบเขตของ “${topic}”`,"สิทธิและหน้าที่ของนายจ้าง–ลูกจ้าง","เงื่อนไข/หลักเกณฑ์สำคัญที่ต้องปฏิบัติ","ตัวอย่างสถานการณ์ในสถานประกอบการ","การป้องกันปัญหาและการปฏิบัติให้ถูกต้องตามกฎหมาย"];
  if(/สุขภาพ|ความปลอดภัย|อาชีว|อันตราย|ความเสี่ยง|ppe|อัคคีภัย|ปฐมพยาบาล|สารเคมี/.test(key))return [
    `ความหมายและความสำคัญของ “${topic}”`,"อันตราย/ปัจจัยเสี่ยงที่เกี่ยวข้อง","หลักการควบคุมและป้องกันความเสี่ยง","ขั้นตอนปฏิบัติที่ปลอดภัยและตัวอย่างจริง","การตรวจสอบ ประเมินผล และการตอบโต้เมื่อเกิดเหตุ"];
  if(/เครือข่าย|network|ip|router|switch|lan|protocol/.test(key))return [
    `แนวคิดและองค์ประกอบของ “${topic}”`,"อุปกรณ์/โพรโทคอลที่เกี่ยวข้อง","การกำหนดค่าและลำดับการทำงาน","ตัวอย่างการเชื่อมต่อหรือสถานการณ์ใช้งาน","การทดสอบ แก้ปัญหา และความปลอดภัยเครือข่าย"];
  if(/ส่วนติดต่อ|ui|ux|อินเทอร์เฟซ|interface|ผู้ใช้|wireframe|prototype/.test(key))return [
    `เป้าหมายผู้ใช้ของ “${topic}”`,"โครงสร้างข้อมูลและลำดับการใช้งาน","องค์ประกอบภาพ ตัวอักษร สี และ Layout","Interaction / Feedback / Accessibility","การทดสอบ Usability และปรับปรุงจากผลทดสอบ"];
  if(/front-end|frontend|html|css|javascript|เว็บ|web/.test(key))return [
    `บทบาทของ “${topic}” ใน Front-End`,"โครงสร้าง HTML และการจัดองค์ประกอบ","CSS / Responsive / การนำเสนอ","JavaScript / Event / State ที่เกี่ยวข้อง","การทดสอบ Debug และตรวจคุณภาพก่อนใช้งานจริง"];
  if(/อุปกรณ์เคลื่อนที่|mobile|android|แอป|application/.test(key))return [
    `แนวคิดของ “${topic}” บนอุปกรณ์เคลื่อนที่`,"โครงสร้างหน้าจอและวงจรการทำงาน","การรับข้อมูล การเก็บข้อมูล และการเชื่อมต่อบริการ","Responsive / Touch / ประสบการณ์ผู้ใช้","การทดสอบบนอุปกรณ์จริงและการจัดการข้อผิดพลาด"];
  if(/เขียนโปรแกรม|โปรแกรม|program|ภาษา|ตัวแปร|เงื่อนไข|วนซ้ำ|ฟังก์ชัน/.test(key))return [
    `แนวคิดหลักของ “${topic}”`,"รูปแบบคำสั่ง / Syntax และข้อมูลนำเข้า","ลำดับการทำงานและตรรกะของโปรแกรม","ตัวอย่างโค้ดหรือสถานการณ์ประยุกต์","การทดสอบ Debug และปรับปรุงโปรแกรมให้ถูกต้อง"];
  if(/นำเข้าข้อมูล|ข้อมูล|data|ไฟล์|ฐานข้อมูล|import/.test(key))return [
    `แหล่งข้อมูลและวัตถุประสงค์ของ “${topic}”`,"รูปแบบข้อมูลและการตรวจความถูกต้อง","ขั้นตอนนำเข้า/แปลง/จัดเก็บข้อมูล","การจัดการข้อมูลผิดพลาดและข้อมูลซ้ำ","การตรวจคุณภาพข้อมูลและยืนยันผลหลังนำเข้า"];
  if(/บริการคอมพิวเตอร์|บริการ|ซ่อม|บำรุง|สารสนเทศ/.test(key))return [
    `ขอบเขตงานของ “${topic}”`,"การรับงานและวิเคราะห์อาการ/ความต้องการ","ขั้นตอนปฏิบัติงานและเครื่องมือที่ใช้","การบันทึกผลและสื่อสารกับผู้รับบริการ","การตรวจคุณภาพ ความปลอดภัย และการส่งมอบงาน"];
  return [`ความหมายของ “${topic}”`,"องค์ประกอบและหลักการสำคัญ","ขั้นตอนหรือกระบวนการทำงาน","ตัวอย่างการประยุกต์ใช้จริง","ข้อควรระวังและการตรวจสอบผล"];
}
function deckSlides(subject,unit,{admin=false}={}){
  const works=unit?.worksheets||[],topic=unitTopic(unit);
  const meta=works.find(w=>w.mode==="digital")||works[0]||{};
  const goals=uniq(works.map(w=>w.learning_goal));
  const concepts=uniq(Array.isArray(meta.key_concepts)?meta.key_concepts:[]);
  const practice=uniq(Array.isArray(meta.practice_steps)?meta.practice_steps:[]);
  const controls=uniq(Array.isArray(meta.control_points)?meta.control_points:[]);
  const exits=uniq(Array.isArray(meta.exit_questions)?meta.exit_questions:[]);
  const fallback=teachingHints(subject?.name,topic);
  const c=[...concepts,...fallback].slice(0,5);
  while(c.length<5)c.push(`หลักการสำคัญของ “${topic}”`);
  const p=practice.length?practice:["สำรวจข้อมูล/สถานการณ์","วิเคราะห์ปัญหา","เลือกวิธีดำเนินการ","ลงมือปฏิบัติ","ตรวจสอบและสรุปผล"];
  const caseStudy=String(meta.case_study||`สถานการณ์ตัวอย่างที่เกี่ยวข้องกับ “${topic}”`);
  const digital=works.find(w=>w.mode==="digital"),paper=works.find(w=>w.mode==="paper");
  const stateText=unit?.unlocked?`เปิด ${fmt(unit.open_at)} • กำหนดส่ง ${fmt(unit.due_at)}`:"ยังไม่เปิดให้นักศึกษา";
  const slides=[
    {kicker:`${subject?.code||""} • UNIT ${unit?.unit_no||""}`,title:topic,lead:subject?.name||"",body:["สไลด์พร้อมสอนประจำหน่วย","เนื้อหา ใบงานออนไลน์ และใบงานย้อนหลังใช้หัวข้อ/ผลลัพธ์การเรียนรู้ชุดเดียวกัน"]},
    {kicker:"LEARNING OUTCOME",title:"ผลลัพธ์การเรียนรู้",body:goals.length?goals:[`อธิบายและประยุกต์ใช้เรื่อง “${topic}” ได้อย่างถูกต้อง`]},
    {kicker:"WHY IT MATTERS",title:"ทำไมเรื่องนี้จึงสำคัญ",body:[`เชื่อมโยง “${topic}” กับการปฏิบัติงานจริง`,`ช่วยลดข้อผิดพลาด/ความเสี่ยงและเพิ่มคุณภาพการทำงาน`,`เป็นพื้นฐานสำหรับการวิเคราะห์สถานการณ์และการตัดสินใจในหน่วยนี้`]},
    {kicker:"KEY WORDS",title:"คำสำคัญประจำหน่วย",body:c},
    {kicker:"CONCEPT 1",title:c[0],body:[`ความหมายของ ${c[0]}`,`ความสัมพันธ์กับ “${topic}”`,`ตัวอย่างที่พบได้ในการเรียนหรือการทำงานจริง`]},
    {kicker:"CONCEPT 2",title:c[1],body:[`หลักการของ ${c[1]}`,`สิ่งที่ผู้เรียนต้องสังเกตหรือพิจารณา`,`ตัวอย่างการนำไปใช้ในสถานการณ์จริง`]},
    {kicker:"CONCEPT 3",title:c[2],body:[`องค์ประกอบสำคัญของ ${c[2]}`,`เหตุผลที่ต้องทำให้ถูกต้อง`,`ผลกระทบเมื่อปฏิบัติไม่เหมาะสม`]},
    {kicker:"CONCEPT 4",title:c[3],body:[`แนวทางปฏิบัติเกี่ยวกับ ${c[3]}`,`ขั้นตอน/เกณฑ์ที่ควรตรวจสอบ`,`ข้อควรระวังที่มักถูกมองข้าม`]},
    {kicker:"CONCEPT 5",title:c[4],body:[`สรุปแนวคิดของ ${c[4]}`,`เชื่อมโยงกับแนวคิดก่อนหน้า`,`นำไปใช้เป็นส่วนหนึ่งของการแก้ปัญหาในหน่วยนี้`]},
    {kicker:"PROCESS",title:"ขั้นตอนการปฏิบัติ",body:p},
    {kicker:"CONTROL POINTS",title:"จุดตรวจสอบสำคัญ",body:controls.length?controls:[`ตรวจความถูกต้องก่อนเริ่มงาน`,`ตรวจความพร้อมของคน/เครื่องมือ/ข้อมูล`,`ปฏิบัติตามขั้นตอนที่กำหนด`,`ตรวจผลและบันทึกสิ่งผิดปกติ`,`ปรับปรุงก่อนนำไปใช้ครั้งต่อไป`]},
    {kicker:"CASE STUDY",title:"กรณีศึกษา",body:[caseStudy,"ให้ผู้เรียนระบุปัญหา/ความเสี่ยง/ข้อผิดพลาดที่พบ","แยกข้อเท็จจริงออกจากความคิดเห็นก่อนเสนอแนวทางแก้ไข"]},
    {kicker:"ANALYZE",title:"วิเคราะห์กรณีศึกษา",body:[`ปัญหาหลักในกรณี “${caseStudy}” คืออะไร`,`สาเหตุหรือปัจจัยที่เกี่ยวข้องมีอะไรบ้าง`,`หลักการข้อใดจากหน่วยนี้ใช้วิเคราะห์ได้`,`ผลลัพธ์จะต่างกันอย่างไรเมื่อเลือกวิธีแก้ไขต่างกัน`]},
    {kicker:"GOOD PRACTICE",title:"แนวทางปฏิบัติที่ถูกต้อง",body:p.map((x,i)=>`${i+1}. ${x}`)},
    {kicker:"COMMON MISTAKES",title:"ข้อผิดพลาดที่พบบ่อย",body:[`รีบลงมือโดยยังไม่วิเคราะห์ “${topic}” ให้ครบ`,`ข้ามขั้นตอนตรวจสอบข้อมูล/สภาพแวดล้อม`,`เลือกวิธีแก้ที่ปลายเหตุแทนสาเหตุหลัก`,`ไม่บันทึกผลหรือไม่ติดตามหลังดำเนินการ`]},
    {kicker:"APPLY",title:"ประยุกต์ใช้กับงานจริง",body:[`ยกตัวอย่างงานจริงที่เกี่ยวข้องกับ “${topic}” 1 กรณี`,`ระบุข้อมูลที่ต้องรวบรวมก่อนตัดสินใจ`,`เลือกขั้นตอนปฏิบัติและอธิบายเหตุผล`,`กำหนดวิธีตรวจว่าผลลัพธ์ที่ได้เหมาะสมหรือไม่`]},
    {kicker:"ON-TIME WORK",title:"ใบงานอิเล็กทรอนิกส์ • ส่งตรงเวลา",body:[digital?`${digital.reference_code||""} • ${cleanTopic(digital.title)}`:"ใบงานออนไลน์ประจำหน่วย",`ทำในระบบภายในกำหนดเวลา • ${stateText}`,"บันทึกร่าง/ตรวจทาน/ยืนยันส่งตาม Flow ของระบบ","เมื่อพ้นกำหนด ระบบจะเปลี่ยนไปใช้ใบงานพิมพ์ย้อนหลังแทน"]},
    {kicker:"LATE WORK",title:"ใบงานพิมพ์ • สำหรับส่งย้อนหลัง",body:[paper?`${paper.reference_code||""} • ${cleanTopic(paper.title)}`:"ใบงานพิมพ์ย้อนหลังประจำหน่วย","ใช้เนื้อหาและผลลัพธ์การเรียนรู้ชุดเดียวกับใบงานอิเล็กทรอนิกส์","นักศึกษาพิมพ์แบบรายบุคคลพร้อม Barcode หลังหมดกำหนด","ส่งกระดาษจริงและ Admin สแกนเก็บสำเนาทั้งแผ่น"]},
    {kicker:admin?"TEACHER CHECK":"CHECK UNDERSTANDING",title:admin?"เช็กลิสต์ครูก่อนจบหน่วย":"ตรวจความเข้าใจก่อนส่งงาน",body:admin?["ตรวจสไลด์ 20 หน้าและใบงานให้สัมพันธ์กัน","ตรวจเวลาเปิด/กำหนดส่งและรูปแบบงานย้อนหลัง","เพิ่มไฟล์สื่อของครูถ้าต้องการ","ยืนยันว่าหน่วยถัดไปยังล็อกจนกว่าจะเริ่มสอน"]:exits.length?exits:[`อธิบายสาระสำคัญของ “${topic}” ด้วยภาษาของตนเอง`,`ยกตัวอย่างการประยุกต์ใช้ 1 กรณี`,`ถ้าพบปัญหา คุณจะเริ่มแก้จากจุดใดและเพราะเหตุใด`]},
    {kicker:"WRAP UP",title:"สรุปหน่วยและงานที่ต้องส่ง",body:[`หัวข้อ: ${topic}`,goals[0]||`เข้าใจและประยุกต์ใช้ “${topic}” ได้`,`ส่งตรงเวลา = ใบงานอิเล็กทรอนิกส์`,`ส่งย้อนหลัง = ใบงานพิมพ์รายบุคคลพร้อม Barcode`,`สไลด์ชุดนี้มี 20 หน้าและสัมพันธ์กับใบงานของหน่วยเดียวกัน`]}
  ];
  return slides.slice(0,20);
}
function renderDeck(slides){
  return `<div class="v174-deck" data-v174-deck>${slides.map((s,i)=>`<section class="v174-slide ${i===0?"active":""}" data-v174-slide="${i}"><div class="v174-slide-kicker">${esc(s.kicker||"")}</div><h3>${esc(s.title||"")}</h3>${s.lead?`<div class="v174-slide-lead">${esc(s.lead)}</div>`:""}${s.html||`<div class="v174-slide-body">${(s.body||[]).map(x=>`<p>• ${esc(x)}</p>`).join("")}</div>`}<div class="v174-slide-page">${i+1} / ${slides.length}</div></section>`).join("")}</div>`;
}
function bindDeck(o,slides){
  let index=0;
  const cards=$$("[data-v174-slide]",o),counter=$("[data-v174-counter]",o),prev=$("[data-v174-prev]",o),next=$("[data-v174-next]",o);
  const show=i=>{index=Math.max(0,Math.min(cards.length-1,i));cards.forEach((c,n)=>c.classList.toggle("active",n===index));if(counter)counter.textContent=`${index+1} / ${cards.length}`;if(prev)prev.disabled=index===0;if(next)next.disabled=index===cards.length-1};
  if(prev)prev.onclick=()=>show(index-1);if(next)next.onclick=()=>show(index+1);
  o.tabIndex=-1;o.focus();
  o.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"){e.preventDefault();show(index-1)}if(e.key==="ArrowRight"||e.key===" "){e.preventDefault();show(index+1)}});
  const print=$("[data-v174-print]",o);if(print)print.onclick=()=>{document.body.classList.add("v174-print-slides");window.print();setTimeout(()=>document.body.classList.remove("v174-print-slides"),350)};
  show(0);
}
function slideOverlay(subject,unit,{admin=false}={}){
  const slides=deckSlides(subject,unit,{admin});
  const o=overlay(`<div class="v168-modal-head v174-deck-head"><div><span class="v14-kicker">${admin?"TEACHING SLIDES • ADMIN":"BUILT-IN TEACHING SLIDES"}</span><h2>${esc(subject?.code||"")} • หน่วย ${Number(unit?.unit_no||0)} • ${esc(unitTopic(unit))}</h2><p>${admin?"สไลด์พร้อมใช้สำหรับเตรียมสอน และเปิดดูได้ก่อนปลดล็อกหน่วย":"สไลด์ประกอบการเรียนของหน่วยที่ครูเปิดแล้ว"}</p></div><div class="row"><button class="btn sm" data-v174-print>🖨️ พิมพ์ / PDF</button><button class="btn sm" data-v168-slide-fullscreen>⛶ เต็มจอ</button><button class="btn sm" data-v168-close>✕</button></div></div>${renderDeck(slides)}<div class="v174-deck-nav"><button class="btn" data-v174-prev>← ก่อนหน้า</button><b data-v174-counter>1 / ${slides.length}</b><button class="btn primary" data-v174-next>ถัดไป →</button></div>`,true);
  const fs=$("[data-v168-slide-fullscreen]",o);if(fs)fs.onclick=()=>window.DOCNR_MOBILE_RUNTIME?.toggleFullscreen?.();
  bindDeck(o,slides);return o;
}


function unitWorkPair(unit,path){
  const works=unit?.worksheets||[];
  const digital=works.find(w=>w.mode==="digital")||null;
  const paper=works.find(w=>w.mode==="paper")||null;
  const nowBase=Number(path?._server_epoch||Date.now());
  const loaded=Number(path?._client_loaded_at||Date.now());
  const now=nowBase+(Date.now()-loaded);
  const due=digital?.due_at||unit?.due_at||null;
  const late=!!(due&&now>new Date(due).getTime());
  const digitalDone=["submitted","confirmed","graded"].includes(String(digital?.submission_status||""));
  const paperDone=["submitted","confirmed","graded"].includes(String(paper?.submission_status||""));
  let action="";
  if(!unit?.unlocked)action=`<button class="btn sm" disabled>🔒 ยังไม่เปิดสอน</button>`;
  else if(digitalDone)action=`<button class="btn sm" disabled>✅ ส่งใบงานออนไลน์แล้ว</button>`;
  else if(paperDone)action=`<button class="btn sm" disabled>✅ ส่งใบงานย้อนหลังแล้ว</button>`;
  else if(!late&&digital)action=`<button class="btn sm primary" data-v14-open-work="${esc(digital.id)}">📝 ทำใบงานประจำหน่วย</button>`;
  else if(late&&paper)action=`<button class="btn sm warn" data-v175-late-paper="${esc(paper.id)}">🖨️ พิมพ์ใบงานส่งย้อนหลัง</button>`;
  else action=`<button class="btn sm" disabled>ไม่พบใบงานที่พร้อมใช้</button>`;
  return `<div class="v175-workpair ${late?"late":"ontime"}">
    <div class="v175-workpair-main"><span class="v168-mode">📝 ใบงานประจำหน่วย</span><b>${esc(unitTopic(unit))}</b><small>${late?"เลยกำหนดแล้ว • ใช้แบบพิมพ์ส่งย้อนหลัง":"อยู่ในช่วงส่งตรงเวลา • ใช้แบบอิเล็กทรอนิกส์"}</small></div>
    <div class="v175-workpair-action">${action}</div>
    <div class="v175-workpair-meta"><span>💻 ${esc(digital?.reference_code||"-")} ออนไลน์</span><span>🖨️ ${esc(paper?.reference_code||"-")} พิมพ์ย้อนหลัง</span><span>📄 อย่างน้อย ${Math.max(Number(digital?.page_count||2),2)} หน้า</span></div>
  </div>`;
}
function worksheetLine(w){
  const icon=w.mode==="paper"?"🖨️":"💻";
  const type=w.mode==="paper"?"ใบงานปริ้น":"ใบงานอิเล็กทรอนิกส์";
  const stateText=w.unlocked?"เปิดแล้ว":"ล็อก";
  return `<div class="v168-work-row ${w.unlocked?"open":"locked"}">
    <div><span class="v168-mode">${icon} ${type}</span><b>${esc(w.reference_code||"")} • ${esc(w.title||"")}</b></div>
    <div>${w.unlocked?`<button class="btn sm primary" data-v14-open-work="${esc(w.id)}">เปิดใบงาน</button>`:`<span class="v168-lock-pill">🔒 ${stateText}</span>`}</div>
  </div>`;
}
function unitCard(unit,sid,path){
  const works=unit.worksheets||[];
  const resources=unit.resources||[];
  return `<article class="v168-unit-card ${unit.unlocked?"unlocked":"locked"}">
    <div class="v168-unit-head">
      <div><span class="v168-unit-no">หน่วย ${Number(unit.unit_no||0)}</span><b>${esc(unitTopic(unit))}</b><small>${unit.unlocked?"พร้อมเรียน":"ยังไม่เปิดสอน"}</small></div>
      <span class="v168-unit-state">${unit.unlocked?"✅ ปลดล็อกแล้ว":"🔒 ล็อก"}</span>
    </div>
    <div class="v168-work-list">${unitWorkPair(unit,path)}</div>
    ${unit.unlocked?`<div class="v168-unit-materials">
      <div><b>📊 สไลด์ / สื่อประกอบการสอน</b><small>เปิดได้เมื่อหน่วยนี้ถูกปลดล็อกแล้วเท่านั้น</small></div>
      <div class="v168-resource-buttons">
        <button class="btn sm" data-v168-summary-slide="${sid}:${unit.unit_no}">▶ สไลด์สรุปหน่วย (Built-in)</button>
        ${resources.map(r=>`<button class="btn sm" data-v168-resource="${esc(r.storage_path)}">📎 ${esc(r.original_name||"สื่อประกอบ")}</button>`).join("")}
      </div>
      <div class="v168-time">เปิด ${fmt(unit.open_at)} • ส่งภายใน ${fmt(unit.due_at)}</div>
    </div>`:`<div class="v168-locked-note">ครูยังไม่เริ่มสอนหน่วยนี้ • ไม่สามารถเปิดใบงานหรือสไลด์ล่วงหน้า</div>`}
  </article>`;
}
async function injectStudentPath(){
  const page=$(".v14-page");
  if(!page||page.querySelector(".v15-room-roster")||!page.querySelector(".v15-room-hero"))return;
  const sid=subjectIdFromPage();if(!sid||page.dataset.v168StudentPath===sid||state.loadingStudent.has(sid))return;
  const r=await role();if(r==="admin")return;
  state.loadingStudent.add(sid);
  try{
    const {data,error}=await client().rpc("my_subject_learning_path",{p_subject_id:sid});
    if(error)throw error;
    data._client_loaded_at=Date.now();
    data._server_epoch=new Date(data.server_time||Date.now()).getTime();
    const allIds=(data?.units||[]).flatMap(u=>(u.worksheets||[]).map(w=>w.id)).filter(Boolean);
    if(allIds.length){
      const {data:subs}=await client().from("submissions").select("worksheet_id,status,submitted_at,confirmed_at").in("worksheet_id",allIds);
      const byId=new Map((subs||[]).map(s=>[s.worksheet_id,s]));
      (data.units||[]).forEach(u=>(u.worksheets||[]).forEach(w=>{const s=byId.get(w.id);if(s){w.submission_status=s.status;w.submitted_at=s.submitted_at;w.confirmed_at=s.confirmed_at}}));
    }
    state.coursePath.set(sid,data);
    page.dataset.v168StudentPath=sid;
    $(".v168-learning-path",page)?.remove();
    const units=data?.units||[],opened=units.filter(x=>x.unlocked).length;
    const hero=page.querySelector(".v15-room-hero");
    const section=document.createElement("section");
    section.className="v168-learning-path";
    section.innerHTML=`<div class="v168-path-head">
      <div><span class="v14-kicker">LEARNING PATH</span><h2>เส้นทางการเรียน • ปลดล็อกทีละหน่วย</h2><p>ใบงานปริ้น ใบงานอิเล็กทรอนิกส์ และสไลด์ถูกจัดไว้ครบตามหน่วย แต่จะเปิดใช้งานเมื่อครูเริ่มสอนเท่านั้น</p></div>
      <div class="v168-path-count"><b>${opened}/${units.length}</b><span>หน่วยที่เปิดแล้ว</span></div>
    </div>
    <div class="v168-unit-grid">${units.map(u=>unitCard(u,sid,data)).join("")}</div>`;
    hero.insertAdjacentElement("afterend",section);
  }catch(e){
    if(String(e?.message||"").includes("STUDENT_NOT_APPROVED_FOR_SUBJECT"))return;
    flash(errText(e),true);
  }finally{state.loadingStudent.delete(sid)}
}

function adminUnitCard(unit,sid,nextUnit){
  const works=unit.worksheets||[];
  const resources=unit.resources||[];
  const resourceCount=resources.length||works.reduce((n,w)=>n+Number(w.resource_count||0),0);
  const first=works[0]||null;
  const digital=works.find(w=>w.mode==="digital")||null,paper=works.find(w=>w.mode==="paper")||null;
  const action=unit.unlocked
    ? `<button class="v19-status-btn open" disabled><span class="v19-btn-icon">✅</span><span>เปิดสอนแล้ว</span></button>`
    : Number(unit.unit_no)===Number(nextUnit)
      ? `<button class="v19-status-btn primary" data-v168-unlock="${sid}:${unit.unit_no}"><span class="v19-btn-icon">▶</span><span>เริ่มสอน / ปลดล็อก</span></button>`
      : `<button class="v19-status-btn locked" disabled><span class="v19-btn-icon">🔒</span><span>รอหน่วยก่อนหน้า</span></button>`;
  const due=digital?.due_at||unit.due_at||null,open=digital?.open_at||unit.open_at||null;
  const duration=(open&&due)?Math.max(0,Math.round((new Date(due)-new Date(open))/3600000*10)/10):null;
  const workButtons=`<div class="v175-admin-pair v19-admin-pair"><div class="v19-pair-icon">📝</div><div><b>ใบงานประจำหน่วย</b><small>Digital ส่งตรงเวลา • Paper ใช้ส่งย้อนหลังหลังหมดเวลา</small></div><button class="btn primary v19-big-action" data-v175-admin-pair="${sid}:${unit.unit_no}"><span>🗂️</span> จัดการใบงาน</button></div>`;
  return `<article class="v168-admin-unit v19-admin-unit ${unit.unlocked?"unlocked":"locked"}">
    <div class="v168-admin-unit-top v19-unit-top"><div><span class="v19-unit-number">หน่วย ${unit.unit_no}</span><b>${esc(unitTopic(unit))}</b><small>${unit.unlocked?"เปิดสอนแล้ว":"เตรียมการสอนได้"}</small></div>${action}</div>
    <div class="v19-schedule-panel">
      <div class="v19-schedule-icon">⏱️</div>
      <div class="v19-schedule-copy"><span>เวลาส่งใบงานอิเล็กทรอนิกส์</span><b>${due?fmt(due):"ยังไม่ได้กำหนด"}</b><small>${open?`เปิด ${fmt(open)}`:"ยังไม่กำหนดเวลาเปิด"}${duration!==null?` • ${duration} ชั่วโมง`:""}</small></div>
      ${unit.unlocked?`<button class="btn v19-schedule-btn" data-v19-unit-schedule="${sid}:${unit.unit_no}">🕒 ${due?"แก้ไขเวลา":"กำหนดเวลา"}</button>`:Number(unit.unit_no)===Number(nextUnit)?`<button class="btn v19-schedule-btn" data-v168-unlock="${sid}:${unit.unit_no}">🕒 กำหนดเวลาเมื่อเริ่มสอน</button>`:`<button class="btn v19-schedule-btn" disabled>🔒 รอเปิดหน่วยก่อนหน้า</button>`}
    </div>
    <div class="v173-unit-actions v19-unit-actions">
      <button class="v19-action-tile primary" data-v168-admin-slide="${sid}:${unit.unit_no}"><span class="v19-action-icon">📊</span><b>เปิดสไลด์พร้อมสอน</b><small>สไลด์ Built-in 20 หน้า</small></button>
      ${first?`<button class="v19-action-tile" data-v14-upload="${first.id}" data-subject="${sid}" data-seq="${unit.unit_no}"><span class="v19-action-icon">➕</span><b>เพิ่มสไลด์/สื่อของครู</b><small>แนบไฟล์ของครู</small></button>`:""}
      ${resources.slice(0,2).map(r=>`<button class="v19-action-tile" data-v168-resource="${esc(r.storage_path)}"><span class="v19-action-icon">📎</span><b>${esc(r.original_name||"สื่อของครู")}</b><small>เปิดสื่อประกอบ</small></button>`).join("")}
    </div>
    <div class="v173-unit-work-list">${workButtons||`<div class="v14-empty">ยังไม่มีใบงานในหน่วยนี้</div>`}</div>
    <div class="v19-unit-footer"><span>${works.length} ใบงาน</span><span>ไฟล์สื่อ ${resourceCount}</span><span>🛡️ Digital รองรับการล็อกด้วยเช็คชื่อหัวหน้าห้อง</span></div>
  </article>`;
}
async function injectAdminPlan(force=false){
  const page=$(".v14-page");
  if(!page||!page.querySelector(".v15-room-roster")||!page.querySelector(".v15-room-hero"))return;
  const sid=subjectIdFromPage();if(!sid||state.loadingAdmin.has(sid))return;
  if(!force&&page.dataset.v168AdminPlan===sid)return;
  const r=await role();if(r!=="admin")return;
  state.loadingAdmin.add(sid);
  try{
    const {data,error}=await client().rpc("admin_subject_unit_plan",{p_subject_id:sid});
    if(error)throw error;
    const units=data?.units||[];
    state.adminPath.set(sid,data);
    const next=units.find(x=>!x.unlocked)?.unit_no??null;
    page.dataset.v168AdminPlan=sid;
    page.classList.add("v168-sequential-mode");
    $(".v168-admin-plan",page)?.remove();
    const anchor=page.querySelector(".v165-room-code")||page.querySelector(".v15-room-hero");
    const section=document.createElement("section");
    section.className="card v168-admin-plan";
    section.innerHTML=`<div class="v168-admin-plan-head">
      <div><span class="v14-kicker">SEQUENTIAL TEACHING</span><h2>🎯 ปลดล็อกการสอนทีละหน่วย</h2><p>เมื่อกดเริ่มสอน ระบบจะเปิดทั้งใบงานอิเล็กทรอนิกส์ + ใบงานปริ้นของเลขหน่วยเดียวกัน และมอบหมายให้นักศึกษาที่เข้าเรียนด้วย CODE โดยอัตโนมัติ</p></div>
      <div class="v168-next-actions"><div class="v168-next-unit">${next?`หน่วยถัดไป <b>${next}</b>`:"<b>เปิดครบแล้ว</b>"}</div></div>
    </div>
    <div class="v168-admin-unit-grid">${units.map(u=>adminUnitCard(u,sid,next)).join("")}</div>
    <div class="v168-sequence-rule">🔒 Server บังคับลำดับจริง: เปิดหน่วยถัดไปไม่ได้จนกว่าหน่วยก่อนหน้าจะถูกเปิดครบ</div>`;
    anchor.insertAdjacentElement("afterend",section);
    const release=page.querySelector(".v14-releasebar");
    if(release){
      release.classList.add("v168-legacy-release");
      const b=release.querySelector("#v14-bulk-release");if(b)b.hidden=true;
      const text=release.querySelector(".muted");if(text)text.textContent="ใช้แผง “ปลดล็อกการสอนทีละหน่วย” ด้านบนแทน เพื่อป้องกันเปิดงานล่วงหน้า";
    }
  }catch(e){flash(errText(e),true)}
  finally{state.loadingAdmin.delete(sid)}
}

function overlay(html){
  $("#v168-overlay")?.remove();
  const o=document.createElement("div");
  o.id="v168-overlay";o.className="v168-overlay";o.innerHTML=`<div class="v168-modal">${html}</div>`;
  document.body.appendChild(o);
  $$("[data-v168-close]",o).forEach(b=>b.onclick=()=>o.remove());
  o.addEventListener("click",e=>{if(e.target===o)o.remove()});
  return o;
}
function v19DurationPresets(){return [[1,"1 ชม."],[2,"2 ชม."],[3,"3 ชม."],[6,"6 ชม."],[12,"12 ชม."],[24,"1 วัน"],[48,"2 วัน"],[72,"3 วัน"],[168,"7 วัน"]]}
function v19BindDurationControls(o){
  const openInput=$("[name=open_at]",o),dueInput=$("[name=due_at]",o),hoursInput=$("[name=duration_hours]",o);
  const applyHours=h=>{const n=Number(h);if(!Number.isFinite(n)||n<=0)return;const open=new Date(openInput.value);if(Number.isNaN(open.getTime()))return;dueInput.value=localInput(new Date(open.getTime()+n*3600000));hoursInput.value=String(n)};
  $$("[data-v19-hours]",o).forEach(b=>b.onclick=()=>applyHours(b.dataset.v19Hours));
  if(hoursInput)hoursInput.onchange=()=>applyHours(hoursInput.value);
  if(openInput)openInput.onchange=()=>{if(Number(hoursInput?.value)>0)applyHours(hoursInput.value)};
}
function v19ScheduleFields({open,due,gate=true,resubmit=false,maxAttempts=1}={}){
  const openD=open?new Date(open):new Date(),dueD=due?new Date(due):new Date((open?new Date(open):new Date()).getTime()+2*3600000);
  const hours=Math.max(.25,Math.round((dueD-openD)/3600000*100)/100);
  return `<div class="v19-schedule-form-grid"><label class="field"><span>วัน/เวลาเปิด</span><input class="input" name="open_at" type="datetime-local" value="${localInput(openD)}" required></label><label class="field"><span>วัน/เวลาปิดรับ Digital</span><input class="input" name="due_at" type="datetime-local" value="${localInput(dueD)}" required></label></div>
    <div class="v19-duration-box"><div><b>หรือกำหนดระยะเวลาหลังเปิด</b><small>เลือกชั่วโมงสำเร็จรูป หรือกรอกจำนวนชั่วโมงเอง</small></div><div class="v19-duration-presets">${v19DurationPresets().map(([h,l])=>`<button type="button" class="btn sm" data-v19-hours="${h}">${l}</button>`).join("")}</div><label class="v19-duration-custom"><span>กำหนดเอง</span><input class="input" name="duration_hours" type="number" min="0.25" max="720" step="0.25" value="${hours}"><b>ชั่วโมง</b></label></div>
    <div class="v19-security-box"><label><input type="checkbox" name="attendance_gate" ${gate?"checked":""}> <span><b>🛡️ ต้องเช็คชื่อจากหัวหน้าห้องก่อนทำ Digital</b><small>หากยังไม่ผ่านการเช็คชื่อของวันนี้ ระบบจะไม่ให้เปิด บันทึกร่าง หรือส่งใบงานอิเล็กทรอนิกส์</small></span></label></div>
    <div class="v168-checks"><label><input type="checkbox" name="allow_resubmit" ${resubmit?"checked":""}> อนุญาตส่งซ้ำก่อนหมดเวลา</label><label>จำนวนครั้งสูงสุด <input class="input v19-attempt-input" name="max_attempts" type="number" min="1" max="20" value="${Math.max(1,Number(maxAttempts||1))}"></label></div>`;
}
function openUnlockDialog(sid,unitNo){
  const now=new Date(),due=new Date(now.getTime()+2*3600000);
  const o=overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">START TEACHING • V19</span><h2>เริ่มสอนหน่วย ${unitNo}</h2><p>เปิดหน่วยพร้อมกำหนดเวลาส่ง Digital และเงื่อนไขเช็คชื่อ</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <form id="v168-unlock-form">${v19ScheduleFields({open:now,due,gate:true,resubmit:false,maxAttempts:1})}
      <div class="v168-unlock-warning">เมื่อยืนยัน ระบบจะเปิดทั้ง Digital/Paper ของหน่วยนี้ แต่นักศึกษาจะทำ Digital ได้ต่อเมื่อผ่านเงื่อนไขเช็คชื่อที่กำหนด</div>
      <div class="row end"><button type="button" class="btn" data-v168-close>ยกเลิก</button><button class="btn primary">▶ ยืนยันเริ่มสอน</button></div>
    </form>`);
  v19BindDurationControls(o);
  $("#v168-unlock-form",o).onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),btn=e.submitter;
    const open=new Date(String(f.get("open_at"))),dueAt=new Date(String(f.get("due_at")));
    if(!(dueAt>open)){flash("กำหนดส่งต้องอยู่หลังเวลาเปิด",true);return}
    btn.disabled=true;btn.textContent="กำลังปลดล็อก...";
    const {data,error}=await client().rpc("admin_unlock_subject_unit_v19",{
      p_subject_id:sid,p_unit_no:Number(unitNo),p_due_at:dueAt.toISOString(),p_open_at:open.toISOString(),
      p_allow_resubmit:f.get("allow_resubmit")==="on",p_max_attempts:Number(f.get("max_attempts")||1),
      p_attendance_gate_required:f.get("attendance_gate")==="on",p_request_key:v179Key()
    });
    if(error){btn.disabled=false;btn.textContent="▶ ยืนยันเริ่มสอน";flash(errText(error),true);return}
    o.remove();flash(`ปลดล็อกหน่วย ${data?.unit_no||unitNo} แล้ว • มอบหมาย ${data?.assignment_count||0} รายการ`);
    const page=$(".v14-page");if(page)delete page.dataset.v168AdminPlan;setTimeout(()=>injectAdminPlan(true),350);
  };
}
async function openUnitScheduleDialog(sid,unitNo){
  const plan=state.adminPath.get(sid),unit=(plan?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  const digital=(unit?.worksheets||[]).find(w=>w.mode==="digital");
  if(!digital){flash("ไม่พบใบงานอิเล็กทรอนิกส์ของหน่วยนี้",true);return}
  const {data:w,error}=await client().from("worksheets").select("id,open_at,due_at,allow_resubmit,max_attempts,status,settings").eq("id",digital.id).single();
  if(error){flash(errText(error),true);return}
  const o=overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">DIGITAL DEADLINE • V19</span><h2>⏱️ กำหนดเวลาส่ง • หน่วย ${unitNo}</h2><p>${esc(unitTopic(unit))} • Admin แก้เวลาได้ตลอด</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <form id="v19-schedule-form">${v19ScheduleFields({open:w.open_at||new Date(),due:w.due_at||new Date(Date.now()+2*3600000),gate:w.settings?.attendance_gate_required!==false,resubmit:w.allow_resubmit,maxAttempts:w.max_attempts})}
      <div class="v19-schedule-note">การเปลี่ยนเวลาจะมีผลทันทีที่ Server • หลังจากนั้นใช้ Paper ย้อนหลัง โดยปุ่มของผู้เรียนจะเปลี่ยนเป็น “พิมพ์ใบงานส่งย้อนหลัง” ตามระบบเดิม</div>
      <div class="row end"><button type="button" class="btn" data-v168-close>ยกเลิก</button><button class="btn primary">💾 บันทึกเวลา</button></div>
    </form>`);
  v19BindDurationControls(o);
  $("#v19-schedule-form",o).onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.target),btn=e.submitter;
    const open=new Date(String(f.get("open_at"))),dueAt=new Date(String(f.get("due_at")));
    if(!(dueAt>open)){flash("กำหนดส่งต้องอยู่หลังเวลาเปิด",true);return}
    btn.disabled=true;btn.textContent="กำลังบันทึก...";
    const {data,error}=await client().rpc("admin_update_unit_schedule_v19",{
      p_subject_id:sid,p_unit_no:Number(unitNo),p_open_at:open.toISOString(),p_due_at:dueAt.toISOString(),
      p_allow_resubmit:f.get("allow_resubmit")==="on",p_max_attempts:Number(f.get("max_attempts")||1),
      p_attendance_gate_required:f.get("attendance_gate")==="on",p_request_key:v179Key()
    });
    if(error){btn.disabled=false;btn.textContent="💾 บันทึกเวลา";flash(errText(error),true);return}
    o.remove();flash(`บันทึกเวลาหน่วย ${unitNo} แล้ว • ปิดรับ ${fmt(data?.due_at||dueAt)}`);
    const page=$(".v14-page");if(page)delete page.dataset.v168AdminPlan;setTimeout(()=>injectAdminPlan(true),250);
  };
}
function openAdminSummarySlides(sid,unitNo){
  const plan=state.adminPath.get(sid),unit=(plan?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  if(!unit){flash("ไม่พบข้อมูลหน่วยเรียน กรุณาเปิดห้องใหม่",true);return}
  slideOverlay(plan?.subject||{},unit,{admin:true});
}


function openAdminWorkPair(sid,unitNo){
  const plan=state.adminPath.get(sid),unit=(plan?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  if(!unit){flash("ไม่พบข้อมูลหน่วยเรียน",true);return}
  const works=unit.worksheets||[],digital=works.find(w=>w.mode==="digital"),paper=works.find(w=>w.mode==="paper");
  overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">WORKSHEET PAIR</span><h2>หน่วย ${unitNo} • ${esc(unitTopic(unit))}</h2><p>ใบงานคู่เดียวกัน: ออนไลน์ใช้ส่งตรงเวลา • แบบพิมพ์ใช้ส่งย้อนหลัง</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <div class="v175-pair-modal">
      <div class="card"><h3>💻 ใบงานอิเล็กทรอนิกส์</h3><p>${esc(digital?.reference_code||"-")} • ${esc(cleanTopic(digital?.title||""))}</p><p class="muted">สำหรับนักศึกษาที่ทำและส่งภายในกำหนดเวลา</p>${digital?`<button class="btn primary" data-v14-preview="${digital.id}">👁 ดูใบงานออนไลน์</button>`:""}</div>
      <div class="card"><h3>🖨️ ใบงานพิมพ์ย้อนหลัง</h3><p>${esc(paper?.reference_code||"-")} • ${esc(cleanTopic(paper?.title||""))}</p><p class="muted">อย่างน้อย 2 หน้า • ใช้เมื่อเลยกำหนดส่งออนไลน์</p>${paper?`<div class="row"><button class="btn" data-v14-preview="${paper.id}">👁 ดูแบบพิมพ์</button><button class="btn primary" data-v167-print-pack="${paper.id}">🖨️ พิมพ์รายบุคคล + Barcode</button></div>`:""}</div>
    </div>`,true);
}
function latePaperHtml(pack){
  const w=pack?.worksheet||{},s=pack?.student||{},sub=pack?.subject||{},t=pack?.token||{},qs=Array.isArray(w.questions)?w.questions:[];
  const cut=Math.max(1,Math.ceil(qs.length/2)),pages=[qs.slice(0,cut),qs.slice(cut)];
  while(pages.length<2)pages.push([]);
  const barcodeId=`v175-barcode-${Date.now()}`,subjectColor=sub.color_hex||"#1565C0";
  return `<div class="v175-late-paper-wrap" style="--subject-color:${esc(subjectColor)}">
    <div class="row end no-print"><button class="btn" data-v175-close-paper>ปิด</button><button class="btn primary" data-v175-print-paper>🖨️ พิมพ์ / Save PDF</button></div>
    ${pages.slice(0,2).map((page,pi)=>`<section class="v175-paper-page" style="--subject-color:${esc(subjectColor)}">
      <header class="v175-paper-head"><img class="v175-paper-logo" src="./icons/icon-192.png" alt=""><div><b>วิทยาลัยเทคนิคนางรอง</b><h2>${esc(sub.code||"")} • ${esc(sub.name||"")}</h2><h3>${esc(cleanTopic(w.title||"ใบงานส่งย้อนหลัง"))}</h3></div><div class="v175-paper-code">${pi===0?`<svg id="${barcodeId}"></svg><small>${esc(w.reference_code||"")}</small>`:`<b>หน้า ${pi+1}/2</b>`}</div></header>
      <div class="v175-student-row"><span>ชื่อ ${esc(s.full_name||"-")}</span><span>รหัส ${esc(s.student_code||"-")}</span><span>ห้อง ${esc(s.class_name||s.room_label||"-")}</span></div>
      <div class="alert warn">ใบงานสำหรับส่งย้อนหลัง • คะแนนเป็นไปตามเกณฑ์งานย้อนหลังของรายวิชา • ต้องส่งกระดาษจริงให้ผู้สอน</div>
      <div class="v175-paper-questions">${page.map((q,i)=>`<div class="v175-paper-q"><b>${pi*cut+i+1}. ${esc(q.text||"")}</b><div class="v175-answer-lines">${"<span></span>".repeat(7)}</div></div>`).join("")||`<div class="v175-paper-q"><b>พื้นที่เขียนคำตอบ/งานเพิ่มเติม</b><div class="v175-answer-lines">${"<span></span>".repeat(14)}</div></div>`}</div>
      <footer>Barcode/Token ผูกกับนักศึกษารายนี้ • หมดอายุ ${fmt(t.expires_at)} • หน้า ${pi+1}/2</footer>
    </section>`).join("")}
  </div>`;
}
async function openLatePaper(paperId){
  try{
    const {data,error}=await client().rpc("my_prepare_late_paper_print",{p_worksheet_id:paperId});
    if(error)throw error;
    const o=overlay(latePaperHtml(data),true);
    setTimeout(()=>{try{if(window.JsBarcode&&data?.token?.barcode_payload)window.JsBarcode(o.querySelector("svg[id^='v175-barcode-']"),data.token.barcode_payload,{format:"CODE128",displayValue:false,height:48,margin:0})}catch{}},30);
    const close=$("[data-v175-close-paper]",o);if(close)close.onclick=()=>o.remove();
    const print=$("[data-v175-print-paper]",o);if(print)print.onclick=()=>{document.body.classList.add("v175-print-paper");window.print();setTimeout(()=>document.body.classList.remove("v175-print-paper"),350)};
  }catch(e){flash(errText(e),true)}
}

async function openResource(path){
  const {data,error}=await client().storage.from("subject-files").createSignedUrl(path,600);
  if(error||!data?.signedUrl){flash(errText(error||"เปิดไฟล์ไม่ได้"),true);return}
  window.open(data.signedUrl,"_blank","noopener");
}
function openSummarySlides(sid,unitNo){
  const path=state.coursePath.get(sid),unit=(path?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  if(!unit||!unit.unlocked){flash("หน่วยนี้ยังไม่ถูกปลดล็อก",true);return}
  slideOverlay(path?.subject||{},unit,{admin:false});
}

document.addEventListener("click",e=>{
  const latePaper=e.target.closest?.("[data-v175-late-paper]");
  if(latePaper){e.preventDefault();e.stopPropagation();openLatePaper(latePaper.dataset.v175LatePaper);return}
  const adminPair=e.target.closest?.("[data-v175-admin-pair]");
  if(adminPair){e.preventDefault();e.stopPropagation();const [sid,u]=adminPair.dataset.v175AdminPair.split(":");openAdminWorkPair(sid,Number(u));return}
  const schedule=e.target.closest?.("[data-v19-unit-schedule]");
  if(schedule){e.preventDefault();e.stopPropagation();const [sid,u]=schedule.dataset.v19UnitSchedule.split(":");openUnitScheduleDialog(sid,Number(u));return}
  const unlock=e.target.closest?.("[data-v168-unlock]");
  if(unlock){e.preventDefault();e.stopPropagation();const [sid,u]=unlock.dataset.v168Unlock.split(":");openUnlockDialog(sid,Number(u));return}
  const adminSlide=e.target.closest?.("[data-v168-admin-slide]");
  if(adminSlide){e.preventDefault();e.stopPropagation();const [sid,u]=adminSlide.dataset.v168AdminSlide.split(":");openAdminSummarySlides(sid,Number(u));return}
  const res=e.target.closest?.("[data-v168-resource]");
  if(res){e.preventDefault();e.stopPropagation();openResource(res.dataset.v168Resource);return}
  const slide=e.target.closest?.("[data-v168-summary-slide]");
  if(slide){e.preventDefault();e.stopPropagation();const [sid,u]=slide.dataset.v168SummarySlide.split(":");openSummarySlides(sid,Number(u));return}
},true);

let pending=false;
function scan(){
  pending=false;
  // V17: app.js owns Sidebar/Catalog routing; this file only enhances course unit content.
  injectAdminPlan().catch(()=>{});
  injectStudentPath().catch(()=>{});
}
const mo=new MutationObserver(()=>{
  if(pending)return;pending=true;setTimeout(scan,80);
});
mo.observe(document.documentElement,{childList:true,subtree:true});
scan();

window.DOCNR_COURSE_FLOW=Object.freeze({release:RELEASE,refresh:scan});
console.info(`[DOC-FULL-NR] ${RELEASE} loaded`);