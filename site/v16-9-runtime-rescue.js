(function(){
  "use strict";
  const RELEASE="V16.9-RUNTIME-RESCUE-R2";
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let booted=false;
  let routeTimer=null;

  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
  function shellReady(){return !!($("#content")&&$("#sidebar .nav")&&$("#pagetitle"));}
  function isLoggedIn(){return !!($("#logoutBtn")||$("#sidebar .brand")||$(".topbar"));}
  function detectRole(){
    const brand=String($("#sidebar .brand .smalltext")?.textContent||"").toUpperCase();
    if(brand.includes("ADMIN")) return "admin";
    if($("#sidebar [data-v14-route='accounts'],#sidebar [data-v14-route='profiles'],#sidebar [data-route='users']")) return "admin";
    return "user";
  }
  function topName(){
    const candidates=$$(".topbar .row:last-child > *").map(x=>String(x.textContent||"").trim()).filter(Boolean);
    const skip=/ตรวจระบบ|ติดตั้งแอป|ออกจากระบบ|^[0-9]+$/;
    return candidates.find(x=>!skip.test(x)&&x.length<40)||"ผู้ใช้งาน";
  }
  function toast(message,bad=false){
    let e=$("#v169r-toast");
    if(!e){e=document.createElement("div");e.id="v169r-toast";document.body.appendChild(e);}
    e.textContent=message;e.className=`show${bad?" bad":""}`;
    clearTimeout(toast.t);toast.t=setTimeout(()=>e.className="",3500);
  }
  function card(icon,title,desc,action,tone){
    return `<button class="v169-big-card ${tone||"slate"}" data-v169r-action="${action}"><span class="v169-icon">${icon}</span><span class="v169-card-text"><b>${esc(title)}</b><small>${esc(desc)}</small></span><span class="v169-arrow">›</span></button>`;
  }
  function flowCard(icon,title,desc,flow,tone){
    return `<button class="v169-big-card ${tone||"slate"}" data-v169r-flow="${flow}"><span class="v169-icon">${icon}</span><span class="v169-card-text"><b>${esc(title)}</b><small>${esc(desc)}</small></span><span class="v169-arrow">›</span></button>`;
  }
  function ensureNav(){
    const nav=$("#sidebar .nav"); if(!nav) return;
    let home=nav.querySelector("[data-v169-home],[data-v169r-home]");
    if(!home){
      home=document.createElement("button");home.type="button";home.dataset.v169rHome="1";home.className="v14-nav nav-card-btn v169-home-btn";
      home.innerHTML='<span class="nav-card-icon">🏠</span><span class="nav-card-label">หน้าแรก</span>';
      nav.prepend(home);
    }
    let courses=nav.querySelector("[data-v169r-courses]");
    if(!courses){
      courses=document.createElement("button");courses.type="button";courses.dataset.v169rCourses="1";courses.className="v14-nav nav-card-btn v169r-courses-btn";
      courses.innerHTML='<span class="nav-card-icon">📚</span><span class="nav-card-label">รายวิชา</span>';
      home.insertAdjacentElement("afterend",courses);
    }
    const oldCourse=nav.querySelector("[data-v14-route='courses']");
    if(oldCourse) oldCourse.style.display="none";
  }
  function renderHome(){
    if(!shellReady()) return false;
    ensureNav();
    clearTimeout(routeTimer);
    const host=$("#content"),title=$("#pagetitle"),role=detectRole();
    if(title) title.textContent="แดชบอร์ด";
    $$("#sidebar .nav button").forEach(x=>x.classList.remove("active"));
    $("[data-v169-home],[data-v169r-home]")?.classList.add("active");
    if(role==="admin"){
      host.innerHTML=`<section class="v169-dashboard v169r-ready" data-v169r-home-view="admin"><div class="v169-hero"><div><span>DOC-FULL-NR • SMART DASHBOARD</span><h1>ศูนย์ควบคุมการเรียนการสอน</h1><p>เลือกงานจากปุ่มใหญ่ ระบบจะพาเข้าสู่ Flow ที่เกี่ยวข้องโดยตรง ไม่ต้องไล่หาเมนูย่อย</p></div><div class="v169-health ok"><i></i><b>Dashboard พร้อมใช้งาน</b><small>${RELEASE}</small></div></div><div class="v169-grid">${card('📚','การสอนและรายวิชา','ห้องเรียน • CODE • 13 หน่วย • ปลดล็อกทีละหน่วย','custom:courses','cyan')}${flowCard('👨‍🎓','นักศึกษาและสิทธิ์','อนุมัติบัญชี • สมาชิกวิชา • โปรไฟล์นักศึกษา','students','green')}${flowCard('📝','งาน คะแนน และรายงาน','ตรวจงาน • สิทธิ์ส่งเพิ่ม • ตารางคะแนน • รายงาน','grading','violet')}${flowCard('📷','เช็คชื่อและห้องเรียน','เช็คชื่อ • QR • สถานะออนไลน์ของห้อง','attendance','orange')}${card('🧪','ระบบสอบ','ข้อสอบ • ช่วงเวลาสอบ • ตรวจข้อสอบ','custom:exam','red')}${flowCard('⚙️','ปีการศึกษาและระบบ','เลื่อนชั้น • ผู้ใช้งาน • Audit • ตั้งค่าระบบ','system','slate')}</div><div class="v169-tip"><b>Flow หลัก</b><span>รายวิชา → CODE → เปิดหน่วย → สื่อ/สไลด์ → ใบงาน → เช็คชื่อ → สอบ → คะแนน</span></div></section>`;
    }else{
      host.innerHTML=`<section class="v169-dashboard v169r-ready" data-v169r-home-view="user"><div class="v169-hero"><div><span>SMART LEARNING</span><h1>สวัสดี ${esc(topName())}</h1><p>เลือกสิ่งที่ต้องการจากปุ่มใหญ่ ระบบรวมขั้นตอนการเรียนไว้ใน Flow เดียว</p></div><div class="v169-student-badge">🎓<b>นักศึกษา</b><small>${RELEASE}</small></div></div><div class="v169-grid student">${card('📚','รายวิชาทั้งหมด / ใส่ CODE','เลือกวิชาและใส่ CODE ที่ได้รับจากครู','custom:enroll','cyan')}${card('🏫','วิชาที่เรียนอยู่','ดูหน่วยที่เปิด ใบงาน และสไลด์','custom:courses','green')}${card('📋','งานของฉัน','ดูงานที่เปิดแล้ว สถานะส่ง และกำหนดเวลา','custom:work','violet')}${card('📷','เช็คชื่อ','ดู QR และสถานะการเข้าเรียน','custom:attendance','orange')}${card('🧪','ข้อสอบ','เข้าสู่ระบบสอบเมื่อครูเปิด','custom:exam','red')}${flowCard('👤','ข้อมูลของฉัน','โปรไฟล์อ่านอย่างเดียวและประวัติการศึกษา','student-info','slate')}</div><div class="v169-tip"><b>ลำดับการเรียน</b><span>เลือกวิชา → ใส่ CODE → ครูเปิดหน่วย → ดูสไลด์/ทำใบงาน → ส่งงาน</span></div></section>`;
    }
    return true;
  }
  function loadingText(){return String($("#content")?.textContent||"").replace(/\s+/g," ").trim();}
  function routeFallback(route){
    clearTimeout(routeTimer);
    routeTimer=setTimeout(()=>{
      const text=loadingText();
      if(/กำลังโหลด/.test(text)){
        const host=$("#content");
        if(host) host.innerHTML=`<div class="v169r-route-error"><b>เมนูนี้ใช้เวลานานกว่าปกติ</b><span>ระบบยกเลิกหน้าค้างเพื่อให้คุณใช้งานต่อได้</span><div><button class="btn primary" data-v169r-action="custom:${esc(route)}">ลองอีกครั้ง</button><button class="btn" data-v169r-home>กลับหน้าแรก</button></div></div>`;
      }
    },10000);
  }
  function goCustom(route){
    ensureNav();
    const api=window.DOCNR_V16_6;
    if(api&&typeof api.navigate==="function"){
      try{
        const p=api.navigate(route);
        if(p&&typeof p.catch==="function")p.catch(e=>{console.error("DOCNR route",route,e);toast("เปิดเมนูไม่สำเร็จ กรุณาลองใหม่",true);});
        routeFallback(route);
        return;
      }catch(e){console.error(e);}
    }
    const b=$(`#sidebar [data-v14-route="${CSS.escape(route)}"]`);
    if(b){b.click();routeFallback(route);return;}
    toast("ระบบเมนูยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง",true);
  }
  function goBase(route){
    const b=$(`#sidebar [data-route="${CSS.escape(route)}"]`);
    if(b){b.click();routeFallback(route);return;}
    toast("ไม่พบเมนูนี้ในบัญชีปัจจุบัน",true);
  }
  function openFlow(name){
    const flows={
      students:{title:"นักศึกษาและสิทธิ์",items:[["🟢","อนุมัติบัญชี","ตรวจและเปิดใช้งานบัญชีนักศึกษา","custom:accounts"],["🔐","สิทธิ์เข้ารายวิชา","ตรวจสมาชิก/คำขอรายวิชา","custom:enrollments"],["🪪","โปรไฟล์นักศึกษา","ดูและจัดการข้อมูลนักศึกษา","custom:profiles"]]},
      grading:{title:"งาน คะแนน และรายงาน",items:[["📝","ตรวจงาน","ตรวจ Submission และให้คะแนน","base:grading"],["⏳","สิทธิ์ส่งเพิ่ม","ขยายเวลา/เพิ่มสิทธิ์รายบุคคล","base:overrides"],["📊","รายงาน","สรุปผลและ Export","base:reports"]]},
      attendance:{title:"เช็คชื่อและห้องเรียน",items:[["📷","เช็คชื่อ","เปิด Session / QR / สรุปยอด","custom:attendance"],["📡","สถานะออนไลน์","ดูผู้เรียนออนไลน์แบบ Real-time","custom:presence"]]},
      system:{title:"ปีการศึกษาและระบบ",items:[["📈","เลื่อนชั้น / ปีการศึกษา","จัดรอบปีและประวัติการศึกษา","custom:promotion"],["👥","ผู้ใช้งาน","จัดการบัญชีระบบ","base:users"],["🧾","Audit Log","ตรวจประวัติการดำเนินการ","base:audit"],["⚙️","ตั้งค่าระบบ","สถานะและการตั้งค่าหลัก","base:system"]]},
      "student-info":{title:"ข้อมูลของฉัน",items:[["🪪","โปรไฟล์","ข้อมูลส่วนตัวแบบอ่านอย่างเดียว","base:profile"],["🗓️","ประวัติการศึกษา","ดูประวัติชั้น/ปีการศึกษา","custom:history"]]}
    };
    const f=flows[name];if(!f)return;
    $("#v169r-flow")?.remove();
    const o=document.createElement("div");o.id="v169r-flow";o.className="v169-overlay";
    o.innerHTML=`<div class="v169-modal"><div class="v169-modal-head"><div><span>FLOW</span><h2>${esc(f.title)}</h2></div><button class="btn sm" data-v169r-close>✕</button></div><div class="v169-flow-grid">${f.items.map(x=>`<button data-v169r-action="${x[3]}"><span>${x[0]}</span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></button>`).join("")}</div></div>`;
    document.body.appendChild(o);o.querySelector("[data-v169r-close]").onclick=()=>o.remove();o.addEventListener("click",e=>{if(e.target===o)o.remove();});
  }
  function runAction(action){
    $("#v169r-flow")?.remove();
    if(action.startsWith("custom:"))goCustom(action.slice(7));
    else if(action.startsWith("base:"))goBase(action.slice(5));
  }
  document.addEventListener("click",e=>{
    const home=e.target.closest?.("[data-v169-home],[data-v169r-home]");
    if(home){e.preventDefault();e.stopPropagation();renderHome();return;}
    const courses=e.target.closest?.("[data-v169r-courses]");
    if(courses){e.preventDefault();e.stopPropagation();goCustom("courses");return;}
    const a=e.target.closest?.("[data-v169r-action]");
    if(a){e.preventDefault();e.stopPropagation();runAction(a.dataset.v169rAction);return;}
    const f=e.target.closest?.("[data-v169r-flow]");
    if(f){e.preventDefault();e.stopPropagation();openFlow(f.dataset.v169rFlow);return;}
  },true);

  function boot(){
    if(!shellReady()||!isLoggedIn())return false;
    ensureNav();
    const title=String($("#pagetitle")?.textContent||"").trim();
    const text=loadingText();
    if(!booted||title==="แดชบอร์ด"||/กำลังโหลด/.test(text)){
      booted=true;renderHome();
    }
    return true;
  }
  let tries=0;
  const timer=setInterval(()=>{tries++;if(boot()||tries>80)clearInterval(timer);},250);
  new MutationObserver(()=>{if(shellReady()){ensureNav();if(!booted)boot();}}).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>{if(shellReady()&&/กำลังโหลด/.test(loadingText()))renderHome();},3500);
  window.DOCNR_RUNTIME_RESCUE=Object.freeze({release:RELEASE,home:renderHome,go:goCustom});
  console.info(`[DOC-FULL-NR] ${RELEASE} loaded`);
})();