import { getClient } from "./v18-supabase.js";
import { TEACHING_KNOWLEDGE } from "./data/teaching-knowledge-v20.js";
import { RELEASE_VERSION } from "./release-meta.js";
const V179_UNLOCK_COMPAT="admin_unlock_subject_unit_v179"; // compatibility contract; V19 wraps the hardened V17.9 unlock RPC

const V191_COMPAT_RELEASE = "V19.1-COMPLETE-STABILIZED-CLASSROOM-FLOW";
const RELEASE = RELEASE_VERSION;
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
    UNIT_DIGITAL_WORKSHEET_NOT_FOUND:"ไม่พบใบงานอิเล็กทรอนิกส์ของหน่วยนี้",
    CLOSE_LATEST_UNIT_FIRST:"กรุณาปิดหน่วยล่าสุดก่อน เพื่อรักษาลำดับการสอน",
    UNIT_ALREADY_CLOSED:"หน่วยนี้ปิดการสอนอยู่แล้ว"
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
function teachingDomain(subjectName,topic){
  const key=`${subjectName||""} ${topic||""}`.toLowerCase();
  if(/กฎหมายแรงงาน|แรงงาน|ลูกจ้าง|นายจ้าง|ค่าจ้าง|วันลา|เวลาทำงาน|ประกันสังคม/.test(key))return "law";
  if(/สุขภาพ|ความปลอดภัย|อาชีว|อันตราย|ความเสี่ยง|ppe|อัคคีภัย|ปฐมพยาบาล|สารเคมี/.test(key))return "safety";
  if(/เครือข่าย|network|ip|router|switch|lan|protocol|dns|dhcp|vlan|firewall/.test(key))return "network";
  if(/ส่วนติดต่อ|ui|ux|อินเทอร์เฟซ|interface|wireframe|prototype|design system|usability/.test(key))return "ui";
  if(/front-end|frontend|html|css|javascript|เว็บ|web|dom|fetch api|pwa/.test(key))return "frontend";
  if(/อุปกรณ์เคลื่อนที่|mobile|android|แอป|application|push notification|permission/.test(key))return "mobile";
  if(/เขียนโปรแกรม|โปรแกรม|program|ภาษา|ตัวแปร|เงื่อนไข|วนซ้ำ|ฟังก์ชัน|array|string|debug|algorithm/.test(key))return "programming";
  if(/นำเข้าข้อมูล|data|ocr|barcode|qr code|csv|spreadsheet|etl|pipeline|ฐานข้อมูล|api/.test(key))return "data";
  if(/บริการคอมพิวเตอร์|บริการ|ซ่อม|บำรุง|service ticket|sla|remote support|ครุภัณฑ์/.test(key))return "service";
  return "general";
}
function topicExplanation(domain,topic){
  const d={
    law:`หัวข้อนี้เน้นให้ผู้เรียนเข้าใจว่า “${topic}” เชื่อมโยงกับสิทธิ หน้าที่ และความรับผิดชอบในสถานประกอบการอย่างไร การเรียนไม่ควรหยุดที่การจำถ้อยคำ แต่ต้องฝึกอ่านเงื่อนไข แยกข้อเท็จจริง และนำหลักเกณฑ์ไปใช้กับสถานการณ์จริงอย่างมีเหตุผล โดยเมื่อใช้งานจริงควรตรวจสอบกฎหมายและประกาศฉบับปัจจุบันเสมอ`,
    safety:`“${topic}” เป็นส่วนหนึ่งของการป้องกันอุบัติเหตุและลดความสูญเสีย ผู้เรียนควรมองให้ครบตั้งแต่การระบุอันตราย ประเมินโอกาสและความรุนแรง เลือกมาตรการควบคุม ปฏิบัติงานอย่างปลอดภัย ไปจนถึงการติดตามผล เพราะการแก้ปัญหาที่ดีต้องจัดการสาเหตุ ไม่ใช่เพียงอาการที่เห็น`,
    network:`“${topic}” ต้องเข้าใจทั้งภาพรวมของการสื่อสารข้อมูลและรายละเอียดการตั้งค่า ผู้เรียนควรเชื่อมโยงอุปกรณ์ หมายเลขที่อยู่ โพรโทคอล และเส้นทางข้อมูลเข้าด้วยกัน แล้วใช้การทดสอบแบบเป็นขั้นตอนเพื่อแยกว่าปัญหาเกิดที่ชั้นใด จุดใด และควรแก้อย่างไรโดยไม่สร้างปัญหาใหม่`,
    ui:`การเรียน “${topic}” ต้องเริ่มจากผู้ใช้และงานที่ผู้ใช้ต้องทำ ไม่ใช่เริ่มจากความสวยงามเพียงอย่างเดียว การออกแบบที่ดีต้องทำให้ข้อมูลหาเจอง่าย ลำดับการใช้งานชัดเจน อ่านได้ ใช้ได้กับหลายอุปกรณ์ และมี Feedback ที่ช่วยให้ผู้ใช้รู้ว่าระบบกำลังเกิดอะไรขึ้น`,
    frontend:`“${topic}” ในงาน Front-End ต้องมองทั้งโครงสร้าง การนำเสนอ พฤติกรรม และคุณภาพของหน้าเว็บร่วมกัน ผู้เรียนควรเข้าใจว่าการเปลี่ยนโค้ดหนึ่งจุดอาจกระทบ Accessibility, Responsive, Performance และ State ของหน้าจอ จึงต้องทดสอบทั้งกรณีปกติและกรณีผิดพลาด`,
    mobile:`“${topic}” บนอุปกรณ์เคลื่อนที่มีข้อจำกัดเรื่องหน้าจอ การสัมผัส ทรัพยากร แบตเตอรี่ เครือข่าย และสิทธิ์เข้าถึงอุปกรณ์ ผู้เรียนจึงต้องออกแบบ Flow ให้สั้น เข้าใจง่าย จัดการ Offline/Permission/Error อย่างชัดเจน และทดสอบบนอุปกรณ์จริงมากกว่าพึ่ง Emulator อย่างเดียว`,
    programming:`“${topic}” เป็นทักษะที่ต้องเข้าใจทั้งแนวคิดและการลงมือเขียนโปรแกรม ผู้เรียนควรแยกปัญหาออกเป็นส่วนย่อย ระบุข้อมูลเข้า กระบวนการ และผลลัพธ์ เขียนตรรกะที่ตรวจสอบได้ แล้วทดสอบด้วยข้อมูลหลายกรณีเพื่อยืนยันว่าโปรแกรมทำงานถูกต้อง ไม่ใช่เพียงรันผ่านครั้งเดียว`,
    data:`“${topic}” เกี่ยวข้องกับคุณภาพของข้อมูลตั้งแต่ต้นทางถึงปลายทาง ผู้เรียนต้องตรวจรูปแบบ ความครบถ้วน ความถูกต้อง การซ้ำ ความปลอดภัย และวิธีรับมือเมื่อเกิดข้อผิดพลาด เพราะข้อมูลที่นำเข้าผิดอาจทำให้การคำนวณ รายงาน และการตัดสินใจในระบบผิดตามไปด้วย`,
    service:`“${topic}” ในงานบริการคอมพิวเตอร์ต้องผสมทั้งทักษะเทคนิคและการบริการ ผู้เรียนควรรับปัญหาให้ชัด เก็บหลักฐาน วิเคราะห์อย่างเป็นระบบ เลือกวิธีแก้ที่กระทบผู้ใช้น้อยที่สุด บันทึกสิ่งที่ทำ และยืนยันผลกับผู้ใช้ก่อนปิดงานทุกครั้ง`,
    general:`การเรียน “${topic}” ควรเข้าใจความหมาย องค์ประกอบ กระบวนการ และเหตุผลของแต่ละขั้นตอน แล้วเชื่อมโยงกับสถานการณ์จริง ผู้เรียนควรอธิบายได้ว่าเหตุใดจึงเลือกวิธีหนึ่งแทนอีกวิธีหนึ่ง และมีวิธีตรวจสอบอย่างไรว่าผลลัพธ์ถูกต้องหรือเหมาะสม`
  };
  return d[domain]||d.general;
}
function conceptExplanation(domain,concept,topic){
  const base={
    law:`ให้พิจารณา “${concept}” โดยแยกผู้เกี่ยวข้อง สิทธิ หน้าที่ เงื่อนไข และหลักฐานที่ใช้ประกอบการตัดสินใจ จากนั้นเชื่อมกลับมาที่ “${topic}” เพื่อดูว่าหลักการนี้มีผลต่อการปฏิบัติงานจริงอย่างไร`,
    safety:`สำหรับ “${concept}” ให้เริ่มจากสิ่งที่อาจก่ออันตราย ผู้ที่อาจได้รับผลกระทบ และสภาพแวดล้อมที่เกี่ยวข้อง แล้วเลือกมาตรการควบคุมตามลำดับความเหมาะสม พร้อมกำหนดวิธีตรวจว่ามาตรการนั้นได้ผลจริง`,
    network:`“${concept}” ควรถูกมองเป็นส่วนหนึ่งของเส้นทางข้อมูล ให้ตรวจว่าอุปกรณ์หรือโพรโทคอลส่วนนี้รับข้อมูลจากไหน ส่งต่อไปไหน ใช้ค่ากำหนดอะไร และมีคำสั่งหรือเครื่องมือใดช่วยยืนยันการทำงานได้`,
    ui:`เมื่อวิเคราะห์ “${concept}” ให้ถามว่าใครคือผู้ใช้ ผู้ใช้ต้องทำอะไร ข้อมูลใดสำคัญที่สุด และหน้าจอตอบสนองต่อการกระทำอย่างไร ทุกองค์ประกอบควรมีเหตุผลที่สัมพันธ์กับเป้าหมาย ไม่ใช่ใส่เพราะความสวยงามอย่างเดียว`,
    frontend:`“${concept}” ต้องเชื่อมกับโครงสร้างหน้าเว็บ การแสดงผล และพฤติกรรมของผู้ใช้ ควรพิจารณา Semantic, Responsive, Accessibility, Error state และผลต่อ Performance ก่อนถือว่าฟังก์ชันเสร็จสมบูรณ์`,
    mobile:`“${concept}” ต้องคำนึงถึงขนาดหน้าจอ การสัมผัส สถานะเครือข่าย Permission และวงจรชีวิตแอป ให้เตรียมทั้งสถานะปกติ กำลังโหลด ไม่มีข้อมูล ออฟไลน์ และเกิดข้อผิดพลาด`,
    programming:`“${concept}” ควรเข้าใจในรูป Input → Process → Output พร้อมติดตามค่าของข้อมูลในแต่ละขั้นตอน หากผลลัพธ์ผิดให้ย้อนตรวจเงื่อนไข ลูป ฟังก์ชัน และชนิดข้อมูลทีละส่วนแทนการแก้แบบเดาสุ่ม`,
    data:`“${concept}” ต้องมีเกณฑ์ชัดเจนว่าข้อมูลแบบใดผ่านหรือไม่ผ่าน ควรแยก Validation, Transformation, Storage และ Logging ออกจากกัน เพื่อให้ตรวจสอบย้อนกลับและกู้คืนได้เมื่อเกิดข้อผิดพลาด`,
    service:`“${concept}” ควรถูกบันทึกเป็นขั้นตอนที่ตรวจสอบย้อนหลังได้ ตั้งแต่รับแจ้ง วิเคราะห์ ดำเนินการ ทดสอบผล ไปจนถึงยืนยันกับผู้ใช้ เพื่อให้การแก้ปัญหาไม่ขึ้นกับความจำของช่างเพียงคนเดียว`,
    general:`“${concept}” เป็นองค์ประกอบหนึ่งของ “${topic}” ควรเข้าใจทั้งความหมาย หน้าที่ ความสัมพันธ์กับส่วนอื่น และเกณฑ์ตรวจสอบผล เพื่อสามารถเลือกใช้ได้อย่างมีเหตุผลในสถานการณ์จริง`
  };
  return base[domain]||base.general;
}
function conceptExample(domain,concept,topic,index=0){
  const ex={
    law:`ตัวอย่าง: ให้สถานการณ์ที่นายจ้างและลูกจ้างเห็นต่างกัน แล้วใช้ “${concept}” แยกข้อเท็จจริง เอกสารที่เกี่ยวข้อง และแนวทางปฏิบัติที่ควรตรวจสอบก่อนสรุป`,
    safety:`ตัวอย่าง: สำรวจพื้นที่ทำงานหนึ่งจุด แล้วใช้ “${concept}” ระบุอันตราย ผู้ได้รับผลกระทบ มาตรการที่มีอยู่ และสิ่งที่ต้องปรับปรุงก่อนเริ่มงาน`,
    network:`ตัวอย่าง: เครื่องผู้ใช้เชื่อมต่อเครือข่ายได้แต่เข้าเว็บไซต์ไม่ได้ ให้ใช้ “${concept}” กำหนดจุดตรวจทีละขั้น เช่น Link, IP, Gateway, DNS และปลายทาง`,
    ui:`ตัวอย่าง: ผู้ใช้กรอกฟอร์มแล้วไม่รู้ว่าบันทึกสำเร็จหรือไม่ ให้ใช้ “${concept}” ปรับลำดับข้อมูล สถานะ Feedback และข้อความช่วยเหลือให้เข้าใจได้ทันที`,
    frontend:`ตัวอย่าง: หน้าเว็บใช้งานได้บนคอมพิวเตอร์แต่ปุ่มล้นจอบนมือถือ ให้ใช้ “${concept}” วิเคราะห์โครงสร้าง CSS, Breakpoint, Touch target และการทดสอบหลายขนาดหน้าจอ`,
    mobile:`ตัวอย่าง: แอปต้องใช้กล้องแต่ผู้ใช้ปฏิเสธ Permission ให้ใช้ “${concept}” ออกแบบข้อความอธิบาย ทางเลือก และ Flow กลับมาอนุญาตภายหลังโดยไม่ทำให้แอปค้าง`,
    programming:`ตัวอย่าง: โปรแกรมรับคะแนนหลายค่าแล้วสรุปผลผิดบางกรณี ให้ใช้ “${concept}” ไล่ค่าตัวแปรด้วยข้อมูลทดสอบ ตรวจเงื่อนไขขอบเขต และแยกฟังก์ชันเพื่อหาเหตุผิดพลาด`,
    data:`ตัวอย่าง: ไฟล์ CSV มีวันที่หลายรูปแบบและรหัสซ้ำ ให้ใช้ “${concept}” กำหนดกฎ Validation, Mapping, Deduplicate และ Log รายการที่ถูกปฏิเสธก่อนนำเข้าฐานข้อมูล`,
    service:`ตัวอย่าง: ผู้ใช้แจ้งว่าเครื่องช้า ให้ใช้ “${concept}” เก็บอาการ เวลาที่เกิด การเปลี่ยนแปลงล่าสุด ตรวจทรัพยากร/ซอฟต์แวร์ แล้วบันทึกผลก่อนส่งมอบ`,
    general:`ตัวอย่าง: เลือกสถานการณ์จริงที่เกี่ยวข้องกับ “${topic}” แล้วใช้ “${concept}” อธิบายว่าควรเริ่มตรวจอะไร ทำอะไรต่อ และใช้เกณฑ์ใดยืนยันผล`
  };
  return ex[domain]||ex.general;
}
function topicScenario(domain,topic){
  const x={
    law:`สถานประกอบการมีเหตุการณ์ที่เกี่ยวข้องกับ “${topic}” แต่ข้อมูลจากนายจ้างและลูกจ้างไม่ตรงกัน ผู้เรียนต้องรวบรวมข้อเท็จจริง เอกสาร เวลา และผู้เกี่ยวข้องก่อนวิเคราะห์สิทธิ/หน้าที่และเสนอแนวทางปฏิบัติ`,
    safety:`ระหว่างปฏิบัติงานพบสภาพที่เกี่ยวข้องกับ “${topic}” ซึ่งอาจก่อให้เกิดอุบัติเหตุ ผู้เรียนต้องหยุดประเมินสถานการณ์ ระบุอันตราย จัดลำดับมาตรการควบคุม และวางวิธีติดตามว่าความเสี่ยงลดลงจริง`,
    network:`ผู้ใช้หลายคนรายงานว่าบริการเครือข่ายที่เกี่ยวข้องกับ “${topic}” ทำงานไม่ปกติ ผู้เรียนต้องกำหนดขอบเขตปัญหา ตรวจจากชั้นพื้นฐานขึ้นไป เก็บหลักฐานจากค่ากำหนด/Log และทดสอบหลังแก้ไข`,
    ui:`ผู้ใช้ทำงานผ่านหน้าจอที่เกี่ยวข้องกับ “${topic}” แล้วเกิดความสับสนและทำขั้นตอนผิดบ่อย ผู้เรียนต้องหาจุดติดขัดจาก User Flow ปรับลำดับข้อมูล/Feedback และกำหนดวิธีทดสอบกับผู้ใช้จริง`,
    frontend:`หน้าเว็บที่เกี่ยวข้องกับ “${topic}” ทำงานได้ในบางอุปกรณ์แต่มีปัญหาในอีกอุปกรณ์หนึ่ง ผู้เรียนต้องแยกปัญหาโครงสร้าง Style Script State และ Network แล้วแก้โดยไม่ทำให้ส่วนเดิมเสีย`,
    mobile:`ผู้ใช้แอปพบปัญหาที่เกี่ยวข้องกับ “${topic}” เมื่อสัญญาณอินเทอร์เน็ตไม่เสถียรหรือ Permission เปลี่ยน ผู้เรียนต้องออกแบบ State, Retry, Offline fallback และข้อความที่ผู้ใช้เข้าใจได้`,
    programming:`โปรแกรมที่เกี่ยวข้องกับ “${topic}” ให้ผลลัพธ์ถูกต้องกับข้อมูลทั่วไปแต่ผิดเมื่อเจอค่าขอบเขต ผู้เรียนต้องสร้าง Test case ไล่ลำดับการทำงาน หาเงื่อนไขที่ผิด และปรับโค้ดให้รองรับกรณีดังกล่าว`,
    data:`ระบบนำเข้าข้อมูลที่เกี่ยวข้องกับ “${topic}” รับไฟล์จากหลายแหล่งและพบข้อมูลผิดรูปแบบ/ซ้ำ ผู้เรียนต้องออกแบบ Validation, Mapping, Error handling และรายงานผลการนำเข้าให้ตรวจสอบย้อนหลังได้`,
    service:`มี Ticket งานบริการที่เกี่ยวข้องกับ “${topic}” และผู้ใช้ต้องกลับมาใช้งานโดยเร็ว ผู้เรียนต้องจัดลำดับความสำคัญ เก็บข้อมูล วิเคราะห์สาเหตุ แก้ไข ทดสอบ และสื่อสารผลอย่างเป็นระบบ`,
    general:`เกิดสถานการณ์จริงที่เกี่ยวข้องกับ “${topic}” ซึ่งมีข้อมูลไม่ครบและมีหลายทางเลือก ผู้เรียนต้องแยกข้อเท็จจริง วิเคราะห์สาเหตุ เลือกแนวทางที่เหมาะสม และกำหนดวิธีตรวจผลหลังดำเนินการ`
  };
  return x[domain]||x.general;
}
function commonMistakes(domain,topic){
  const x={
    law:["สรุปจากความจำโดยไม่ตรวจเงื่อนไขและเอกสารที่เกี่ยวข้อง","ปะปนข้อเท็จจริงกับความคิดเห็นของคู่กรณี","อ้างกฎทั่วไปโดยไม่ดูข้อยกเว้นหรือบริบท","ตัดสินก่อนตรวจข้อมูลและหลักฐานให้ครบ"],
    safety:["มองเห็นอันตรายแต่ไม่ประเมินว่าใครได้รับผลกระทบ","เลือก PPE เป็นมาตรการแรกทั้งที่ควบคุมที่ต้นเหตุได้","แก้เฉพาะจุดเกิดเหตุแต่ไม่หาสาเหตุระบบ","ไม่มีการติดตามว่ามาตรการใหม่ลดความเสี่ยงจริงหรือไม่"],
    network:["เปลี่ยนค่าหลายจุดพร้อมกันจนไม่รู้ว่าสาเหตุอยู่ที่ใด","ข้ามการตรวจ Physical/Link แล้วเริ่มแก้ที่ Application","ไม่บันทึกค่าก่อนแก้ไข","ทดสอบเพียงเครื่องเดียวแล้วสรุปว่าระบบปกติ"],
    ui:["เริ่มจากสีและความสวยก่อนเข้าใจผู้ใช้","ใส่ข้อมูลมากเกินไปในหน้าจอเดียว","ไม่มีสถานะ Loading/Error/Success ที่ชัดเจน","ทดสอบกับผู้พัฒนาเองแทนผู้ใช้จริง"],
    frontend:["แก้ CSS เฉพาะขนาดหน้าจอที่กำลังดู","ผูก Event ซ้ำจนเกิดการทำงานหลายครั้ง","ไม่จัดการ Network/Error state","ตรวจเพียงว่าหน้าจอแสดงผลแต่ไม่ตรวจ Keyboard/Accessibility"],
    mobile:["สมมติว่าอินเทอร์เน็ตพร้อมตลอดเวลา","ขอ Permission โดยไม่บอกเหตุผล","ทำปุ่มเล็กหรือชิดขอบจนแตะยาก","ไม่ทดสอบตอนแอปถูกพัก/กลับมาทำงานอีกครั้ง"],
    programming:["เขียนโค้ดยาวทั้งหมดในจุดเดียว","ทดสอบเฉพาะข้อมูลตัวอย่างที่คาดว่าจะผ่าน","แก้ค่าจนผลลัพธ์ถูกโดยไม่เข้าใจสาเหตุ","ไม่ตรวจ Input และกรณีขอบเขต"],
    data:["นำเข้าทันทีโดยไม่ Validate","แก้ข้อมูลต้นฉบับโดยไม่มีสำเนาหรือ Log","ไม่กำหนดกฎป้องกันข้อมูลซ้ำ","รายงานเฉพาะจำนวนสำเร็จแต่ไม่เก็บรายการที่ผิด"],
    service:["รีบลงโปรแกรมใหม่ก่อนเก็บอาการ","ไม่บันทึกสิ่งที่เปลี่ยนแปลง","ปิด Ticket โดยยังไม่ได้ให้ผู้ใช้ยืนยัน","แก้ปัญหาเฉพาะครั้งนี้โดยไม่ทำ Preventive action"],
    general:["เริ่มทำก่อนวิเคราะห์โจทย์","ข้ามขั้นตอนตรวจสอบข้อมูล","เลือกวิธีจากความคุ้นเคยแทนเหตุผล","ไม่กำหนดเกณฑ์ตรวจผลหลังทำงาน"]
  };
  return x[domain]||x.general;
}
function learningTerms(...values){
  const stop=/การ|ความ|ระบบ|หลักการ|หลัก|และ|ของ|ใน|สำหรับ|แบบ|ขั้นสูง|ขั้น|งาน|เทคโนโลยี|ปฏิบัติ|โครงงาน|พร้อม|ด้วย|จาก|เข้าสู่|คอมพิวเตอร์|ซอฟต์แวร์/gi;
  return uniq(values.flatMap(v=>String(v||"").toLowerCase().replace(stop," ").split(/[^0-9a-zA-Zก-๙+#.-]+/).filter(x=>x.length>=3))).slice(0,24);
}
function teachingKnowledge(subject,unit,concepts=[]){
  const facts=TEACHING_KNOWLEDGE[String(subject?.code||"")]||[];
  if(!facts.length)return [];
  const topic=unitTopic(unit),terms=learningTerms(topic,...concepts);
  const scored=facts.map((fact,i)=>({fact,i,score:terms.reduce((n,t)=>n+(String(fact).toLowerCase().includes(t)?(t.length>5?3:2):0),0)}))
    .sort((a,b)=>b.score-a.score||a.i-b.i);
  const matched=scored.filter(x=>x.score>0).map(x=>x.fact);
  if(matched.length>=5)return matched.slice(0,5);
  const offset=Math.max(0,(Number(unit?.unit_no||1)-1)*3)%facts.length;
  const fallback=[...facts.slice(offset),...facts.slice(0,offset)];
  return uniq([...matched,...fallback]).slice(0,5);
}
function topicPrinciples(domain,topic){
  const x={
    law:["แยกข้อเท็จจริงออกจากข้อกล่าวอ้างหรือความคิดเห็น","ตรวจผู้เกี่ยวข้อง สิทธิ หน้าที่ เงื่อนไข และหลักฐานก่อนสรุป","ใช้กฎหมาย/ประกาศฉบับปัจจุบันและตรวจข้อยกเว้นที่เกี่ยวข้อง","บันทึกเหตุผลและแหล่งข้อมูลเพื่อให้ตรวจสอบย้อนหลังได้"],
    safety:["กำจัดอันตรายที่ต้นเหตุก่อนพึ่ง PPE เมื่อทำได้","ประเมินโอกาสเกิดและความรุนแรงก่อนเลือกมาตรการ","หยุดงานเมื่อเงื่อนไขไม่ปลอดภัยหรือข้อมูลไม่พอ","ติดตามผลหลังควบคุมเพื่อยืนยันว่าความเสี่ยงลดลงจริง"],
    network:["ตรวจจากชั้นกายภาพไปยังการตั้งค่าและบริการทีละชั้น","เปลี่ยนค่าทีละจุดและเก็บค่าก่อนแก้ทุกครั้ง","ใช้คำสั่ง/Log ยืนยันสมมติฐาน ไม่แก้จากการเดา","ทดสอบปลายทางหลายจุดหลังแก้เพื่อป้องกันผลกระทบแฝง"],
    ui:["เริ่มจากงานและข้อจำกัดของผู้ใช้ก่อนเลือกภาพลักษณ์","จัดลำดับข้อมูลให้เห็นสิ่งสำคัญก่อนและลดภาระความจำ","ทุก Action ต้องมี Feedback และ Error recovery ที่เข้าใจได้","ทดสอบกับผู้ใช้จริงและปรับจากหลักฐาน ไม่ใช่รสนิยมส่วนตัว"],
    frontend:["ใช้ Semantic structure ก่อนตกแต่งภาพ","แยก Structure / Style / Behavior เพื่อลดผลกระทบข้ามส่วน","รองรับ Loading / Empty / Error / Offline และ Keyboard","ทดสอบ Responsive, Accessibility, Performance และ Security ก่อนปล่อย"],
    mobile:["ออกแบบ Touch target และ Flow ให้เหมาะกับหน้าจอเล็ก","ขอ Permission เมื่อจำเป็นและอธิบายเหตุผล","รองรับ Lifecycle, Offline, Retry และข้อมูลที่ยังไม่ Sync","ปกป้อง Token/ข้อมูลสำคัญและทดสอบบนอุปกรณ์จริง"],
    programming:["นิยาม Input / Process / Output และข้อจำกัดก่อนเขียนโค้ด","แบ่งปัญหาเป็นหน่วยย่อยที่ทดสอบได้","ตรวจกรณีปกติ กรณีขอบเขต และข้อมูลผิดรูปแบบ","Debug จากหลักฐาน เช่น ค่า Variable, Trace และ Test case ไม่แก้แบบสุ่ม"],
    data:["Validate ก่อน Transform และก่อนบันทึก","เก็บ Source/Log เพื่อย้อนกลับได้เมื่อข้อมูลผิด","กำหนดกฎ Mapping, Deduplicate และ Error handling ชัดเจน","ตรวจคุณภาพข้อมูลหลังนำเข้า ไม่ถือว่าสำเร็จเพียงเพราะคำสั่งไม่ Error"],
    service:["รับอาการและผลกระทบให้ชัดก่อนเริ่มแก้","บันทึกสิ่งที่ตรวจและสิ่งที่เปลี่ยนทุกขั้น","จัดลำดับตามผลกระทบและความเร่งด่วน","ทดสอบกับผู้ใช้และทำ Preventive action ก่อนปิด Ticket"],
    general:["กำหนดเป้าหมายและเกณฑ์สำเร็จก่อนลงมือ","ทำตามลำดับที่ตรวจสอบย้อนกลับได้","ใช้ข้อมูลจริงประกอบการตัดสินใจ","ตรวจผลและปรับปรุงจากข้อผิดพลาดที่พบ"]
  };
  return (x[domain]||x.general).map(x=>`${x} — ใช้กับ “${topic}” โดยยึดหลักฐานจากงานจริง`);
}
function correctIncorrect(domain,topic){
  const good={law:"รวบรวมสัญญา เวลา เอกสาร และข้อเท็จจริงก่อนเทียบหลักเกณฑ์",safety:"หยุดประเมินอันตรายและเลือกมาตรการที่ต้นเหตุก่อนเริ่มงาน",network:"ตรวจ Link → IP → Gateway → DNS → Service ทีละชั้นและบันทึกผล",ui:"ทดสอบ User Flow กับผู้ใช้เป้าหมายและปรับจากจุดติดขัด",frontend:"ทดสอบหน้าเดียวกันหลาย viewport พร้อม Keyboard และ Error state",mobile:"จำลอง Offline/Permission denied/Lifecycle แล้วตรวจการกู้คืน",programming:"สร้าง Test case ปกติ/ขอบเขต/ผิดรูปแบบแล้วไล่ค่าทีละขั้น",data:"Validate schema และข้อมูลซ้ำก่อน Import พร้อมเก็บ rejection log",service:"บันทึก Ticket อาการ การเปลี่ยนแปลง ผลทดสอบ และให้ผู้ใช้ยืนยันก่อนปิด",general:"กำหนดโจทย์ ขั้นตอน และเกณฑ์ตรวจผลก่อนลงมือ"};
  const bad={law:"สรุปสิทธิหรือความผิดจากความจำโดยไม่ตรวจเอกสารและกฎที่ใช้บังคับ",safety:"เห็นอันตรายแต่ใส่ PPE อย่างเดียวโดยไม่ลดความเสี่ยงที่ต้นเหตุ",network:"เปลี่ยน Router, DNS และ Firewall พร้อมกันจนไม่รู้ว่าสาเหตุจริงคืออะไร",ui:"เริ่มออกแบบสีและตกแต่งก่อนรู้ว่าผู้ใช้ต้องทำงานอะไร",frontend:"แก้ CSS ให้พอดีเฉพาะหน้าจอตนเองและไม่ทดสอบผลกระทบ",mobile:"สมมติว่าอินเทอร์เน็ตและ Permission พร้อมตลอด",programming:"แก้ตัวเลขหรือเงื่อนไขจนตัวอย่างหนึ่งผ่านโดยไม่หา Root cause",data:"Import ทันทีโดยไม่มี Validation/Backup/Log",service:"รีบติดตั้งใหม่ก่อนเก็บอาการและปิด Ticket โดยผู้ใช้ยังไม่ได้ยืนยัน",general:"เริ่มทำทันทีโดยไม่กำหนดข้อมูลที่ต้องใช้และเกณฑ์สำเร็จ"};
  return {good:`ถูก: ${good[domain]||good.general} ในหัวข้อ “${topic}”`,bad:`ไม่ถูก: ${bad[domain]||bad.general} ซึ่งทำให้ตรวจสอบสาเหตุและผลลัพธ์ได้ยาก`};
}
function troubleshootingGuide(domain,topic){
  const common=commonMistakes(domain,topic);
  return [
    `1. ระบุอาการ/ปัญหาให้เป็นประโยคที่วัดได้ในเรื่อง “${topic}”`,
    "2. ตรวจเงื่อนไขก่อนหน้าและข้อมูลที่เปลี่ยนล่าสุด",
    `3. หยิบข้อผิดพลาดที่พบบ่อยมาเทียบ: ${common[0]||"ข้ามขั้นตอนตรวจสอบ"}`,
    "4. แก้ทีละสาเหตุและทดสอบซ้ำด้วยเกณฑ์เดิม",
    "5. บันทึก Root cause วิธีแก้ และจุดป้องกันไม่ให้เกิดซ้ำ"
  ];
}
function topicPrecautions(domain,topic){
  const x={
    law:["ตรวจฉบับกฎหมาย/ประกาศที่มีผลใช้บังคับจริงก่อนนำไปใช้","อย่าเปิดเผยข้อมูลส่วนบุคคลหรือเอกสารพนักงานเกินความจำเป็น","กรณีมีข้อพิพาทจริงให้ส่งต่อผู้มีอำนาจ/ผู้เชี่ยวชาญตามขั้นตอน"],
    safety:["หยุดงานทันทีเมื่อมีอันตรายร้ายแรงหรือควบคุมไม่ได้","ใช้ PPE ให้ตรงชนิดอันตรายและตรวจสภาพก่อนใช้","ไม่ทดลองกับไฟฟ้า สารเคมี เครื่องจักร หรือเหตุฉุกเฉินโดยไม่มีผู้ควบคุม"],
    network:["สำรอง Configuration ก่อนแก้ Router/Switch/Firewall","หลีกเลี่ยงการทดสอบที่รบกวนระบบ Production โดยไม่วางแผน","ปกป้อง Password, Key, IP plan และ Log ที่มีข้อมูลสำคัญ"],
    ui:["ตรวจ Contrast, ขนาดตัวอักษร, Keyboard และ Touch target","อย่าใช้สีเพียงอย่างเดียวเป็นตัวสื่อสถานะ","หลีกเลี่ยง Dark pattern และเก็บข้อมูลผู้ใช้เท่าที่จำเป็น"],
    frontend:["Escape/validate ข้อมูลจากผู้ใช้และไม่ฝัง Secret ใน Client","ทดสอบ Browser/Viewport หลักก่อน Deploy","เตรียม Rollback เมื่อแก้โค้ดที่กระทบเส้นทางใช้งานหลัก"],
    mobile:["ขอ Permission เท่าที่จำเป็นและมี fallback เมื่อถูกปฏิเสธ","เก็บ Token/ข้อมูลสำคัญในพื้นที่ปลอดภัยของแพลตฟอร์ม","ทดสอบการพักแอป กลับมาใช้งาน และเครือข่ายหลุด"],
    programming:["Validate input ก่อนคำนวณหรือเขียนข้อมูล","หลีกเลี่ยงการรันโค้ดไม่รู้แหล่งที่มาหรือคำสั่งทำลายข้อมูล","ใช้ Version control และ Test ก่อนรวมโค้ด"],
    data:["สำรองข้อมูล/ใช้ Transaction เมื่อต้องแก้ข้อมูลจำนวนมาก","จำกัดสิทธิ์และไม่ Log ข้อมูลลับเกินจำเป็น","ใช้ Idempotency/Deduplicate ป้องกันนำเข้าซ้ำ"],
    service:["สำรองข้อมูลผู้ใช้ก่อนงานที่เสี่ยงต่อการสูญหาย","ขออนุญาตก่อน Remote/เปลี่ยนค่าที่กระทบผู้ใช้","ไม่บันทึกรหัสผ่านหรือข้อมูลส่วนบุคคลลง Ticket แบบเปิดเผย"],
    general:["ตรวจความพร้อมของเครื่องมือและข้อมูลก่อนเริ่ม","หยุดเมื่อพบเงื่อนไขที่ไม่แน่ใจหรือเสี่ยง","เก็บหลักฐานและผลตรวจเพื่อย้อนกลับได้"]
  };
  return (x[domain]||x.general).map(x=>`${x} • ${topic}`);
}
function deckSlides(subject,unit,{admin=false}={}){
  const works=unit?.worksheets||[],topic=unitTopic(unit);
  const meta=works.find(w=>w.mode==="digital")||works[0]||{};
  const goals=uniq(works.map(w=>w.learning_goal));
  const concepts=uniq(Array.isArray(meta.key_concepts)?meta.key_concepts:[]);
  const practice=uniq(Array.isArray(meta.practice_steps)?meta.practice_steps:[]);
  const controls=uniq(Array.isArray(meta.control_points)?meta.control_points:[]);
  const exits=uniq(Array.isArray(meta.exit_questions)?meta.exit_questions:[]);
  const fallback=teachingHints(subject?.name,topic),domain=teachingDomain(subject?.name,topic);
  const c=[...concepts,...fallback].slice(0,5);while(c.length<5)c.push(`แนวคิดสำคัญของ “${topic}”`);
  const p=practice.length?practice:["สำรวจข้อมูล/สถานการณ์","วิเคราะห์ปัญหา","เลือกวิธีดำเนินการ","ลงมือปฏิบัติ","ตรวจสอบและสรุปผล"];
  const k=teachingKnowledge(subject,unit,c),principles=topicPrinciples(domain,topic),mistakes=commonMistakes(domain,topic),compare=correctIncorrect(domain,topic);
  const caseStudy=String(meta.case_study||topicScenario(domain,topic));
  const digital=works.find(w=>w.mode==="digital"),paper=works.find(w=>w.mode==="paper");
  const stateText=unit?.unlocked?`เปิด ${fmt(unit.open_at)} • กำหนดส่ง ${fmt(unit.due_at)}`:"ยังไม่เปิดให้นักศึกษา";
  const deep=topicExplanation(domain,topic);
  const conceptSlide=(i)=>({kicker:`CONCEPT ${i+1}`,title:c[i],explain:`${conceptExplanation(domain,c[i],topic)}${k[i]?` สาระเชื่อมโยงจากคลังความรู้รายวิชา: ${k[i]}`:""}`,body:[`นิยาม/บทบาท: อธิบาย “${c[i]}” ด้วยภาษาของตนเองและบอกว่ามีหน้าที่ใด`,`ความสัมพันธ์: เชื่อม “${c[i]}” กับ “${topic}” และแนวคิดอื่นในหน่วย`,`การตัดสินใจ: ระบุว่าเมื่อใดควรใช้/ไม่ควรใช้แนวคิดนี้`,`การตรวจผล: บอกหลักฐานหรือผลทดสอบที่ยืนยันว่าใช้ได้ถูกต้อง`],example:conceptExample(domain,c[i],topic,i)});
  const slides=[
    {kicker:`${subject?.code||""} • UNIT ${unit?.unit_no||""}`,title:topic,lead:subject?.name||"",explain:deep,body:["หน่วยนี้เชื่อม Built-in Slides → Learning Goal → Digital/Paper Worksheet → Exam Question Bank","เรียนเพื่ออธิบายเหตุผล วิเคราะห์สถานการณ์ ลงมือทำ และตรวจผลได้จริง","ทุกตัวอย่างควรเชื่อมกับงานจริงของรายวิชา ไม่ใช่จำหัวข้ออย่างเดียว"],note:"TEACHER NOTE: ใช้คำถามสั้นทุก 3–4 หน้า ให้ผู้เรียนสรุปด้วยภาษาของตนเองก่อนเดินหน้าต่อ"},
    {kicker:"LEARNING GOAL",title:"เป้าหมายการเรียนรู้และหลักฐานความสำเร็จ",explain:`เมื่อจบหน่วย ผู้เรียนต้องสามารถอธิบาย วิเคราะห์ และประยุกต์ “${topic}” ได้ตาม Learning Goal ของใบงาน พร้อมแสดงหลักฐานว่าผลลัพธ์ถูกต้อง`,body:goals.length?goals:[`อธิบายความหมายและองค์ประกอบของ “${topic}” ได้`,`เลือกวิธีปฏิบัติและตรวจผลได้`,`เชื่อมเนื้อหากับใบงานและโจทย์วิเคราะห์ได้`],example:"หลักฐานที่ดีต้องตอบได้ครบ What / Why / How / Check ไม่ใช่เพียงบอกชื่อคำศัพท์"},
    {kicker:"DEFINITION",title:"ความหมาย ขอบเขต และความสำคัญ",explain:deep,body:k.length?k.slice(0,4):[`นิยาม “${topic}” ให้ชัดว่าครอบคลุมอะไร`,`ระบุสิ่งที่อยู่ในขอบเขตและสิ่งที่ไม่ใช่หัวข้อนี้`,`อธิบายผลกระทบถ้าปฏิบัติผิดหรือข้ามขั้นตอน`,`เชื่อมกับงานจริงของ ${subject?.name||"รายวิชา"}`],example:topicScenario(domain,topic)},
    {kicker:"KEY CONCEPTS",title:"แนวคิดหลักและคำศัพท์ที่ต้องใช้",explain:"คำศัพท์ทำหน้าที่เป็นเครื่องมือคิด ผู้เรียนควรอธิบายความสัมพันธ์ระหว่างคำ ไม่ใช่ท่องจำเป็นรายการ",body:c.map((x,i)=>`${i+1}. ${x}${k[i]?` — ${k[i]}`:""}`),note:"ให้ผู้เรียนเลือก 2 แนวคิดแล้ววาดลูกศรอธิบายความสัมพันธ์ก่อนเริ่ม Concept เชิงลึก"},
    conceptSlide(0),conceptSlide(1),conceptSlide(2),conceptSlide(3),
    {kicker:"PRINCIPLE",title:`หลักการทำงานของ ${c[4]}`,explain:`หัวข้อนี้เป็นสะพานจาก “รู้คำ” ไปสู่ “เลือกใช้ได้” โดยยึดหลักของ ${c[4]} และบริบท “${topic}”`,body:principles,example:k[4]||conceptExample(domain,c[4],topic,4)},
    {kicker:"PROCESS",title:"กระบวนการทำงานทีละขั้น",explain:`การทำ “${topic}” ต้องเป็นลำดับที่ตรวจสอบย้อนกลับได้ เพื่อให้รู้ว่าความผิดพลาดเกิดก่อน ระหว่าง หรือหลังขั้นตอนไหน`,body:p.map((x,i)=>`${i+1}. ${x} — ระบุ Input, สิ่งที่ต้องทำ, Output และจุดตรวจของขั้นนี้`),example:`จุดควบคุมที่มีในใบงาน: ${(controls.length?controls.slice(0,3):["ตรวจเงื่อนไขก่อนเริ่ม","ตรวจผลระหว่างทำ","ตรวจผลเทียบเกณฑ์"]).join(" • ")}`},
    {kicker:"CORRECT / INCORRECT",title:"ตัวอย่างที่ถูกและตัวอย่างที่ผิด",explain:"การเปรียบเทียบสองแบบช่วยให้เห็นเหตุผลของหลักการชัดกว่าการจำคำตอบ ควรชี้ให้ได้ว่าจุดใดทำให้ผลต่างกัน",body:[compare.good,compare.bad,`Common mistake: ${mistakes[0]||"ข้ามจุดตรวจสำคัญ"}`,`วิธีป้องกัน: เพิ่ม Checklist ก่อนผ่านไปขั้นถัดไป`],example:"ให้ผู้เรียนอธิบายว่าตัวอย่างที่ผิดควรแก้ตรงไหนก่อนเป็นอันดับแรก และใช้หลักฐานใดตรวจว่าดีขึ้นแล้ว"},
    {kicker:"CASE STUDY",title:"กรณีศึกษาและการตัดสินใจ",explain:caseStudy,body:["แยกข้อเท็จจริงที่ทราบแน่นอน","ระบุข้อมูลที่ยังขาดและวิธีเก็บข้อมูลเพิ่ม","เลือกหลักการจากหน่วยนี้อย่างน้อย 2 ข้อ","เปรียบเทียบทางเลือกด้วยเกณฑ์เดียวกัน","กำหนดวิธีตรวจผลหลังดำเนินการ"],example:"อย่ารีบสรุปจากอาการแรก ให้หา Root cause หรือเงื่อนไขที่ยืนยันได้ก่อน"},
    {kicker:"ANALYZE",title:"วิเคราะห์ปัญหาอย่างเป็นระบบ",explain:"ลำดับการคิดที่ตรวจสอบได้คือ ข้อมูล → สมมติฐาน → หลักฐาน → ทางเลือก → การตัดสินใจ → การตรวจผล",body:[`ปัญหาหลักใน “${topic}” คืออะไรและวัดได้อย่างไร`,`ข้อมูลใดสนับสนุนหรือหักล้างสาเหตุที่สงสัย`,`ทางเลือกใดมีผลกระทบ/ความเสี่ยงต่ำกว่า`,`จะทดสอบทีละสาเหตุอย่างไรโดยไม่สร้างปัญหาใหม่`,`เกณฑ์ใดบอกว่าการแก้ปัญหาสำเร็จ`],example:"ถ้ามีหลายสาเหตุ ให้เริ่มจากสาเหตุที่ตรวจได้เร็ว ปลอดภัย และมีหลักฐานชัด แล้วค่อยขยายการตรวจ"},
    {kicker:"COMMON MISTAKE + TROUBLESHOOTING",title:"ข้อผิดพลาดที่พบบ่อยและวิธีแก้",explain:"Troubleshooting ที่ดีไม่ใช่ลองทุกอย่าง แต่เป็นการลดพื้นที่ของสาเหตุทีละขั้นและเก็บหลักฐานทุกครั้ง",body:[...mistakes.slice(0,3).map((x,i)=>`พลาด ${i+1}: ${x}`),...troubleshootingGuide(domain,topic)],example:"หลังแก้ให้ทำ Regression/ทดสอบซ้ำจุดเดิมและจุดที่อาจได้รับผลกระทบ เพื่อยืนยันว่าไม่ได้แก้หนึ่งอย่างแล้วทำอีกอย่างพัง"},
    {kicker:"SAFETY / PRECAUTION",title:"ข้อควรระวัง คุณภาพ และความปลอดภัย",explain:`แม้หัวข้อ “${topic}” จะไม่ใช่งานอันตรายทางกายภาพทุกครั้ง แต่ทุกงานมีความเสี่ยงด้านข้อมูล ระบบ บุคคล หรือคุณภาพ จึงต้องกำหนดข้อควรระวังก่อนลงมือ`,body:topicPrecautions(domain,topic),example:"ก่อนทำงานจริงให้ตอบว่า: อะไรเสียหายได้? ใครได้รับผลกระทบ? ย้อนกลับอย่างไร? และใครต้องอนุมัติก่อน?"},
    {kicker:"WORKSHEET • DIGITAL • ON-TIME WORK",title:"เชื่อมไปใบงานอิเล็กทรอนิกส์",explain:"ใบงาน Digital ตรวจว่าผู้เรียนสามารถใช้แนวคิดของหน่วยเพื่ออธิบาย วิเคราะห์ และปฏิบัติได้จริง คำตอบต้องมีเหตุผลและขั้นตอนเมื่อโจทย์ต้องการ ไม่ใช่ตอบคำสั้น ๆ",body:[digital?`${digital.reference_code||""} • ${cleanTopic(digital.title)}`:"ใบงานออนไลน์ประจำหน่วย",`สถานะ: ${stateText}`,`Learning Goal: ${goals[0]||`ประยุกต์ใช้ ${topic} ได้`}`,"ตรวจคำตอบให้ครบและบันทึกร่างก่อนยืนยันส่ง"],note:"Digital/Paper หน่วยเดียวกันเป็น Logical Work Pair เดียว งานตรงเวลาถูกประมวลผลตามนโยบายคะแนนเดิม"},
    {kicker:"WORKSHEET • PAPER • LATE WORK",title:"ใบงานพิมพ์สำหรับส่งย้อนหลัง",explain:"Paper ใช้เนื้อหาและ Learning Goal เดียวกับ Digital แต่เปลี่ยนช่องทางส่งเป็นเอกสารรายบุคคลพร้อม Barcode/QR เพื่อให้ตรวจสอบย้อนกลับได้",body:[paper?`${paper.reference_code||""} • ${cleanTopic(paper.title)}`:"ใบงานพิมพ์ย้อนหลังประจำหน่วย","พิมพ์ฉบับรายบุคคลจากระบบเมื่อ Backend อนุญาต","ตอบครบทุกข้อและส่งฉบับจริง","Admin สแกนเก็บหลักฐานโดยไม่เปลี่ยนงานเดิม"],note:"งานย้อนหลังมี Credit factor ตามนโยบายระบบเดิมและไม่นับซ้ำกับ Digital ของหน่วยเดียวกัน"},
    {kicker:"EXAM ALIGNMENT",title:"สาระที่เชื่อมกับคลังข้อสอบ",explain:"คลังข้อสอบของรายวิชาวัดทั้งความเข้าใจสาระหลักและการวิเคราะห์ สไลด์จึงทบทวน Concept และเหตุผลที่ต้องใช้จริง โดยไม่เปิดเผยข้อสอบ ตัวเลือก หรือ Answer Key",body:(k.length?k:[...c]).slice(0,5).map((x,i)=>`${i+1}. ${x}`),example:`ฝึกตอบโจทย์แบบใหม่ด้วยหลัก “นิยาม → เหตุผล → ขั้นตอน → ตรวจผล” ในบริบท “${topic}” แทนการจำคำตอบเฉพาะข้อ`},
    {kicker:admin?"TEACHER NOTE + REVIEW":"REVIEW QUESTIONS",title:admin?"แนวสอนของครูและคำถามทบทวน":"คำถามทบทวนก่อนจบหน่วย",explain:admin?"ใช้คำถามที่ต้องอธิบายเหตุผลและให้ผู้เรียนเชื่อมไปยังใบงาน ไม่เฉลยข้อสอบจริงจากคลัง":"ตอบด้วยภาษาของตนเองโดยไม่ย้อนอ่านข้อความ ถ้าตอบไม่ได้ให้กลับไป Concept / Case Study / Troubleshooting ที่เกี่ยวข้อง",body:exits.length?exits:[`อธิบาย “${topic}” ให้เพื่อนฟังภายใน 60 วินาที`,`ยกตัวอย่างที่ถูกและผิดอย่างละ 1 กรณี`,`บอก Common mistake 1 ข้อและวิธี Troubleshoot`,`ระบุข้อควรระวังที่สำคัญที่สุดของหน่วยนี้`,`อธิบายว่าใบงานจะใช้หลักการใดจากสไลด์`],note:admin?"TEACHER NOTE: ใช้ Think–Pair–Share 2–3 นาที แล้วสุ่มผู้เรียนอธิบาย What / Why / How / Check ต่อหน้าชั้น":"ถ้าตอบได้ครบ What / Why / How / Check แสดงว่าพร้อมทำใบงานและเตรียมสอบมากขึ้น"},
    {kicker:"KEY TAKEAWAY",title:"สรุปสิ่งที่ต้องจำและนำไปใช้",explain:`แก่นของ “${topic}” คือการเข้าใจหลักการ เลือกวิธีให้เหมาะกับบริบท ลงมืออย่างเป็นขั้นตอน และยืนยันผลด้วยหลักฐาน`,body:[`Learning Goal: ${goals[0]||`อธิบายและประยุกต์ ${topic} ได้`}`,`Key Concepts: ${c.slice(0,3).join(" • ")}`,`Process: ${p.slice(0,4).join(" → ")}`,`Control: ${(controls[0]||"ตรวจเงื่อนไขก่อนเริ่ม")} → ${(controls[1]||"ตรวจระหว่างทำ")} → ${(controls[2]||"ตรวจผลสุดท้าย")}`,"Slides → Worksheet → Review → Exam ใช้เป้าหมายการเรียนรู้เดียวกัน"],example:"Key takeaway: ก่อนตัดสินใจให้ตอบ 4 คำถาม — กำลังแก้เรื่องอะไร? ใช้หลักการใด? ทำอย่างไร? และมีหลักฐานอะไรยืนยันว่าถูกต้อง?"}
  ];
  return slides.slice(0,20);
}
function renderDeck(slides){
  return `<div class="v174-deck" data-v174-deck>${slides.map((s,i)=>`<section class="v174-slide ${i===0?"active":""}" data-v174-slide="${i}"><div class="v174-slide-kicker">${esc(s.kicker||"")}</div><h3>${esc(s.title||"")}</h3>${s.lead?`<div class="v174-slide-lead">${esc(s.lead)}</div>`:""}${s.explain?`<div class="v199-slide-explain"><b>คำอธิบาย</b><p>${esc(s.explain)}</p></div>`:""}${s.html||`<div class="v174-slide-body">${(s.body||[]).map(x=>`<p>• ${esc(x)}</p>`).join("")}</div>`}${s.example?`<div class="v199-slide-example"><b>ตัวอย่าง / การเชื่อมโยง</b><p>${esc(s.example)}</p></div>`:""}${s.note?`<div class="v199-slide-note"><b>Teacher Note / Learning Note</b><p>${esc(s.note)}</p></div>`:""}<div class="v174-slide-page">${i+1} / ${slides.length}</div></section>`).join("")}</div>`;
}
function bindDeck(o,slides){
  let index=0;
  const cards=$$("[data-v174-slide]",o),counter=$("[data-v174-counter]",o),prev=$("[data-v174-prev]",o),next=$("[data-v174-next]",o);
  const show=i=>{index=Math.max(0,Math.min(cards.length-1,i));cards.forEach((c,n)=>c.classList.toggle("active",n===index));if(counter)counter.textContent=`${index+1} / ${cards.length}`;if(prev)prev.disabled=index===0;if(next)next.disabled=index===cards.length-1};
  if(prev)prev.onclick=()=>show(index-1);if(next)next.onclick=()=>show(index+1);
  o.tabIndex=-1;o.focus();
  o.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"){e.preventDefault();show(index-1)}if(e.key==="ArrowRight"||e.key===" "){e.preventDefault();show(index+1)}if(e.key==="Home"){e.preventDefault();show(0)}if(e.key==="End"){e.preventDefault();show(cards.length-1)}});
  const print=$("[data-v174-print]",o);if(print)print.onclick=()=>{document.body.classList.add("v174-print-slides");window.print();setTimeout(()=>document.body.classList.remove("v174-print-slides"),350)};
  show(0);
}
async function toggleSlidePresentation(o,button){
  const active=o.dataset.v20Present==="1";
  if(active){o.dataset.v20Present="0";o.classList.remove("v20-slide-present");if(document.fullscreenElement===o)try{await document.exitFullscreen()}catch{};button.textContent="🖥️ นำเสนอเต็มจอ";return}
  o.dataset.v20Present="1";o.classList.add("v20-slide-present");button.textContent="↙ ออกจากโหมดนำเสนอ";
  try{if(!document.fullscreenElement&&o.requestFullscreen)await o.requestFullscreen({navigationUI:"hide"})}catch{}
}
function slideOverlay(subject,unit,{admin=false}={}){
  const slides=deckSlides(subject,unit,{admin});
  const o=overlay(`<div class="v168-modal-head v174-deck-head"><div><span class="v14-kicker">${admin?"TEACHING SLIDES • ADMIN":"BUILT-IN TEACHING SLIDES"}</span><h2>${esc(subject?.code||"")} • หน่วย ${Number(unit?.unit_no||0)} • ${esc(unitTopic(unit))}</h2><p>${admin?"สไลด์สอนจริง 20 หน้า • เชื่อม Learning Goal / Worksheet / Exam Bank":"สไลด์ประกอบการเรียนของหน่วยที่ครูเปิดแล้ว"}</p></div><div class="row"><button class="btn sm" data-v174-print>🖨️ พิมพ์ / PDF</button><button class="btn sm v20-present-btn" data-v168-slide-fullscreen>🖥️ นำเสนอเต็มจอ</button><button class="btn sm" data-v168-close>✕</button></div></div>${renderDeck(slides)}<div class="v174-deck-nav"><button class="btn" data-v174-prev>← ก่อนหน้า</button><b data-v174-counter>1 / ${slides.length}</b><button class="btn primary" data-v174-next>ถัดไป →</button></div>`,true);
  const fs=$("[data-v168-slide-fullscreen]",o);if(fs)fs.onclick=()=>toggleSlidePresentation(o,fs);
  const syncFs=()=>{if(o.dataset.v20Present==="1"&&!document.fullscreenElement){o.dataset.v20Present="0";o.classList.remove("v20-slide-present");if(fs)fs.textContent="🖥️ นำเสนอเต็มจอ"}};
  document.addEventListener("fullscreenchange",syncFs,{once:true});
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

function adminUnitCard(unit,sid,nextUnit,lastUnlocked){
  const works=unit.worksheets||[];
  const resources=unit.resources||[];
  const resourceCount=resources.length||works.reduce((n,w)=>n+Number(w.resource_count||0),0);
  const first=works[0]||null;
  const digital=works.find(w=>w.mode==="digital")||null,paper=works.find(w=>w.mode==="paper")||null;
  const action=unit.unlocked
    ? Number(unit.unit_no)===Number(lastUnlocked)
      ? `<button class="v19-status-btn v20-close-teaching" data-v20-lock="${sid}:${unit.unit_no}"><span class="v19-btn-icon">⏸</span><span>ปิดการสอน</span></button>`
      : `<button class="v19-status-btn open" disabled><span class="v19-btn-icon">✅</span><span>เปิดสอนแล้ว</span></button>`
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
    const lastUnlocked=Math.max(0,...units.filter(x=>x.unlocked).map(x=>Number(x.unit_no)||0));
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
    <div class="v168-admin-unit-grid">${units.map(u=>adminUnitCard(u,sid,next,lastUnlocked)).join("")}</div>
    <div class="v168-sequence-rule">🔒 Server บังคับลำดับจริง: เปิดหน่วยถัดไปไม่ได้จนกว่าหน่วยก่อนหน้าจะถูกเปิดครบ • หากเปิดเกิน/เปิดผิด ให้ปิดจากหน่วยล่าสุดย้อนกลับ โดยข้อมูล งาน คะแนน และ Assignment เดิมไม่ถูกลบ</div>`;
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
  const o=overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">START TEACHING • ${RELEASE_VERSION}</span><h2>เริ่มสอนหน่วย ${unitNo}</h2><p>เปิดหน่วยพร้อมกำหนดเวลาส่ง Digital และเงื่อนไขเช็คชื่อ</p></div><button class="btn sm" data-v168-close>✕</button></div>
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

function openLockUnitDialog(sid,unitNo){
  const plan=state.adminPath.get(sid),unit=(plan?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  if(!unit){flash("ไม่พบข้อมูลหน่วยเรียน",true);return}
  const o=overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">CLOSE TEACHING • ${RELEASE_VERSION}</span><h2>⏸ ปิดการสอนหน่วย ${unitNo}</h2><p>${esc(unitTopic(unit))}</p></div><button class="btn sm" data-v168-close>✕</button></div>
    <div class="v20-close-warning"><b>ปิดการสอนแบบไม่ลบข้อมูล</b><p>นักศึกษาจะเปิดสไลด์/ใบงานของหน่วยนี้ไม่ได้จนกว่าจะเปิดใหม่ แต่สมาชิก Assignment Submission คะแนน ประวัติ และเวลาที่เคยกำหนดยังคงอยู่ครบ</p><p>เพื่อรักษาลำดับระบบ จะปิดได้จากหน่วยล่าสุดที่เปิดอยู่ก่อนเท่านั้น</p></div>
    <div class="row end"><button class="btn" data-v168-close>ยกเลิก</button><button class="btn v20-danger-btn" data-v20-confirm-lock>⏸ ยืนยันปิดการสอน</button></div>`);
  const btn=$("[data-v20-confirm-lock]",o);btn.onclick=async()=>{
    btn.disabled=true;btn.textContent="กำลังปิดการสอน...";
    const {data,error}=await client().rpc("admin_lock_subject_unit_v20",{p_subject_id:sid,p_unit_no:Number(unitNo),p_request_key:v179Key()});
    if(error){btn.disabled=false;btn.textContent="⏸ ยืนยันปิดการสอน";flash(errText(error),true);return}
    o.remove();flash(`ปิดการสอนหน่วย ${data?.unit_no||unitNo} แล้ว • ข้อมูลเดิมยังอยู่ครบ`);
    const page=$(".v14-page");if(page)delete page.dataset.v168AdminPlan;setTimeout(()=>injectAdminPlan(true),250);
  };
}
async function openUnitScheduleDialog(sid,unitNo){
  const plan=state.adminPath.get(sid),unit=(plan?.units||[]).find(x=>Number(x.unit_no)===Number(unitNo));
  const digital=(unit?.worksheets||[]).find(w=>w.mode==="digital");
  if(!digital){flash("ไม่พบใบงานอิเล็กทรอนิกส์ของหน่วยนี้",true);return}
  const {data:w,error}=await client().from("worksheets").select("id,open_at,due_at,allow_resubmit,max_attempts,status,settings").eq("id",digital.id).single();
  if(error){flash(errText(error),true);return}
  const o=overlay(`<div class="v168-modal-head"><div><span class="v14-kicker">DIGITAL DEADLINE • ${RELEASE_VERSION}</span><h2>⏱️ กำหนดเวลาส่ง • หน่วย ${unitNo}</h2><p>${esc(unitTopic(unit))} • Admin แก้เวลาได้ตลอด</p></div><button class="btn sm" data-v168-close>✕</button></div>
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
  const lock=e.target.closest?.("[data-v20-lock]");
  if(lock){e.preventDefault();e.stopPropagation();const [sid,u]=lock.dataset.v20Lock.split(":");openLockUnitDialog(sid,Number(u));return}
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