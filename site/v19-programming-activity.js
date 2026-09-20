// DOC-FULL-NR V19.7 • Programming Special Activity / Code Typing Academy
// Adapted from user-provided Code Typing Academy V6.0.2 without Firebase/PVP/chat/cosmetic dependencies.
import { getClient, getUserId } from './v18-supabase.js';

const V197_SUBJECT='21910-2010';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtSec=n=>{n=Math.max(0,Number(n)||0);const m=Math.floor(n/60),s=Math.floor(n%60);return `${m}:${String(s).padStart(2,'0')}`};
const tierTH={bronze:'Bronze',silver:'Silver',gold:'Gold',platinum:'Platinum',diamond:'Diamond',master:'Master'};
let catalogPromise=null, focusTimer=null, activeSubject=null, activeRole=null;

function toast(msg,bad=false){
  const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.toggle('error',!!bad); t.classList.add('show');
  clearTimeout(t._v197);t._v197=setTimeout(()=>t.classList.remove('show'),3200);
}
function errText(e){const m=String(e?.message||e||'เกิดข้อผิดพลาด');const map={
  PROGRAMMING_ACTIVITY_ACCESS_DENIED:'ไม่มีสิทธิ์เข้ากิจกรรมนี้',PROGRAMMING_ACTIVITY_CLOSED:'กิจกรรมพิเศษถูกปิดชั่วคราว',
  PROGRAMMING_STAGE_LOCKED:'ต้องผ่านด่านก่อนหน้าก่อน',PROGRAMMING_CODE_NOT_COMPLETE:'โค้ดยังไม่ตรงกับโจทย์',
  PROGRAMMING_SESSION_EXPIRED:'หมดเวลาของรอบนี้ กรุณาเริ่มด่านใหม่',PROGRAMMING_SESSION_ALREADY_COMPLETED:'รอบนี้ส่งผลแล้ว',
  PROGRAMMING_OFFICIAL_INCOMPLETE:'ต้องผ่านกิจกรรมทางการครบ 30 ด่านก่อนส่งผล',PROGRAMMING_RANKING_DISABLED:'ระบบจัดอันดับถูกปิด',
  PROGRAMMING_OFFICIAL_DISABLED:'กิจกรรมทางการถูกปิด',PROGRAMMING_FOCUS_DISABLED:'โหมดฝึกต่อเนื่องถูกปิด'
};return Object.entries(map).find(([k])=>m.includes(k))?.[1]||m}
async function catalog(){
  if(!catalogPromise)catalogPromise=fetch('./data/programming-activity-v197.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('โหลดชุดกิจกรรมไม่สำเร็จ');return r.json()});
  return catalogPromise;
}
async function profile(){
  const uid=await getUserId();if(!uid)return null;const {data,error}=await getClient().from('profiles').select('id,role,full_name,student_code,class_name,active,approval_status').eq('id',uid).single();
  if(error)throw error;return data;
}
async function subject(sid){const {data,error}=await getClient().from('subjects').select('id,code,name,color_hex').eq('id',sid).single();if(error)throw error;return data}
function backButton(sid){return `<button class="btn ghost" data-v197-back="${sid}">← กลับห้องเรียนรายวิชา</button>`}
function tierBadge(t){return `<span class="v197-tier v197-tier-${esc(t||'bronze')}">${esc(tierTH[t]||t||'Bronze')}</span>`}
function difficultyLabel(d){return d==='easy'?'พื้นฐาน':d==='medium'?'ปานกลาง':'ยาก'}
function cleanupFocus(){if(focusTimer){clearInterval(focusTimer);focusTimer=null}}
function navigateBack(sid){cleanupFocus();window.DOCNR_BASE?.navigate?.('courses',sid)}

async function openSpecial(sid){
  cleanupFocus(); activeSubject=sid;
  try{
    const [p,s,c]=await Promise.all([profile(),subject(sid),catalog()]);
    if(!p||s.code!==V197_SUBJECT){toast('กิจกรรมนี้ใช้เฉพาะวิชา 21910-2010',true);return}
    activeRole=p.role;
    const content=$('#content'); if(!content)return;
    $('#pagetitle')&&($('#pagetitle').textContent='กิจกรรมพิเศษ • Code Typing Academy');
    content.innerHTML=`<section class="v14-page"><div class="card v197-loading">กำลังเปิดกิจกรรมพิเศษ...</div></section>`;
    if(p.role==='admin')await renderAdmin(content,s,c,p);else await renderUser(content,s,c,p);
  }catch(e){toast(errText(e),true);const content=$('#content');if(content)content.innerHTML=`<section class="v14-page">${backButton(sid)}<div class="card v197-error"><b>เปิดกิจกรรมไม่สำเร็จ</b><p>${esc(errText(e))}</p></div></section>`}
}

async function renderUser(root,s,catalogData,p){
  const client=getClient();
  const [homeR,progR,offR,rankR]=await Promise.all([
    client.rpc('my_programming_activity_home_v197',{p_subject_id:s.id}),
    client.rpc('my_programming_activity_progress_v197',{p_subject_id:s.id}),
    client.rpc('my_programming_official_v197',{p_subject_id:s.id}),
    client.rpc('programming_activity_leaderboard_v197',{p_subject_id:s.id,p_scope:'class'})
  ]);
  for(const r of [homeR,progR,offR])if(r.error)throw r.error;
  const home=homeR.data||{},settings=home.settings||{},pr=home.profile||{},rating=pr.rating||{},focus=home.focus||{};
  const progress=new Map((progR.data||[]).map(x=>[x.stage_id,x]));const official=offR.data||[];const classRanks=rankR.error?[]:(rankR.data||[]);
  const stages=catalogData.stages||[];
  const completed=Number(pr.completed_stages||0),tokens=Number(pr.tokens||0);
  root.innerHTML=`<section class="v14-page v197-page" id="v197-root" style="--v197-accent:${esc(s.color_hex||'#EF6C00')}">
    <div class="v197-topline">${backButton(s.id)}<span class="v197-safe-note">กิจกรรมพิเศษ • ไม่รวมคะแนนรายวิชา 100 คะแนน</span></div>
    <header class="v197-hero"><div><span class="v14-kicker">SPECIAL ACTIVITY • ${esc(s.code)}</span><h1>⌨️ Code Typing Academy</h1><p>ฝึกพิมพ์และอ่านโค้ด HTML + Python แบบไต่ระดับ 100 ด่าน • วัด WPM, Accuracy, เวลา และความต่อเนื่อง</p></div><div class="v197-profile-badge"><b>${esc(p.full_name||p.student_code||'ผู้เรียน')}</b>${tierBadge(rating.tier)}<small>กิจกรรมเสริม ไม่กระทบเกรดรายวิชา</small></div></header>
    ${settings.enabled===false?`<div class="card v197-closed"><b>🔒 Admin ปิดกิจกรรมพิเศษชั่วคราว</b><p>ความคืบหน้าเดิมยังถูกเก็บไว้ และจะกลับมาใช้งานต่อได้เมื่อเปิดกิจกรรม</p></div>`:''}
    <div class="v197-kpis">
      <div><span>ผ่านแล้ว</span><b>${completed}/100</b><small>${Math.round(completed)}%</small></div>
      <div><span>Token กิจกรรม</span><b>${tokens}</b><small>รางวัลเพื่อแรงจูงใจ</small></div>
      <div><span>Best WPM</span><b>${Number(pr.best_wpm||0).toFixed(1)}</b><small>ความเร็วสูงสุด</small></div>
      <div><span>Accuracy เฉลี่ย</span><b>${Number(pr.avg_accuracy||0).toFixed(1)}%</b><small>ความแม่นยำ</small></div>
      <div><span>Ranking</span><b>${Number(rating.rating||0).toFixed(1)}</b><small>${esc(tierTH[rating.tier]||'Bronze')}</small></div>
    </div>
    <section class="v197-track-grid">
      ${trackCard('html','🌐','HTML',stages,progress)}${trackCard('python','🐍','Python',stages,progress)}
    </section>
    <section class="card v197-focus" ${settings.focus_enabled===false?'hidden':''}><div><span class="v14-kicker">DAILY FOCUS</span><h2>⏱️ ฝึกต่อเนื่องวันนี้</h2><p>นับเฉพาะช่วงที่เปิดหน้านี้และกำลังใช้งาน • เป้าหมาย ${Math.round(Number(focus.target_seconds||3600)/60)} นาที</p></div><div class="v197-focus-meter"><b id="v197-focus-time">${fmtSec(focus.seconds||0)}</b><small>/ ${fmtSec(focus.target_seconds||3600)}</small><button class="btn primary" id="v197-focus-toggle">เริ่มจับเวลาฝึก</button></div></section>
    <section class="v197-main-grid">
      <div class="card v197-stage-panel"><div class="v197-section-head"><div><span class="v14-kicker">100 STAGES</span><h2>เลือกด่านฝึก</h2></div><div class="v197-filters"><select id="v197-lang" class="input"><option value="html">HTML</option><option value="python">Python</option></select><select id="v197-diff" class="input"><option value="">ทุกระดับ</option><option value="easy">พื้นฐาน</option><option value="medium">ปานกลาง</option><option value="hard">ยาก</option></select></div></div><div id="v197-stage-list" class="v197-stage-list"></div></div>
      <div class="v197-side-stack">
        <section class="card"><div class="v197-section-head"><div><span class="v14-kicker">TEACHER QUESTS</span><h2>🎯 ภารกิจจากครู</h2></div></div><div class="v197-quest-list">${(home.quests||[]).map(questCard).join('')||'<div class="v14-empty">ยังไม่มีภารกิจ</div>'}</div></section>
        <section class="card" ${settings.leaderboard_enabled===false?'hidden':''}><div class="v197-section-head"><div><span class="v14-kicker">CLASS RANKING</span><h2>🏆 อันดับในห้อง</h2></div><button class="btn sm" id="v197-rank-overall">ดูรวมทุกห้อง</button></div><div id="v197-rank-list">${rankTable(classRanks)}</div></section>
      </div>
    </section>
    <section class="card v197-official" ${settings.official_enabled===false?'hidden':''}><div class="v197-section-head"><div><span class="v14-kicker">OFFICIAL CHALLENGE • 30 STAGES / 40 ACTIVITY POINTS</span><h2>🏅 ชุดกิจกรรมทางการ</h2><p>คัดจากต้นแบบ 30 ด่าน • คะแนนส่วนนี้เป็นคะแนนกิจกรรมพิเศษเท่านั้น <b>ไม่รวมกับคะแนนรายวิชา 100 คะแนน</b></p></div><div class="v197-official-total"><b>${Number(home.official?.live_score||0).toFixed(2)}/40</b><small>${Number(home.official?.completed||0)}/30 ด่าน</small></div></div><div class="v197-official-list">${official.map(o=>officialCard(o)).join('')}</div><div class="v197-official-actions"><button class="btn primary" id="v197-submit-official" ${Number(home.official?.completed||0)<30?'disabled':''}>ส่งผลกิจกรรมทางการ</button>${home.official?.submitted?`<span class="v197-ok">✓ ส่งผลล่าสุด ${Number(home.official.submitted_score||0).toFixed(2)}/40</span>`:''}</div></section>
  </section>`;
  if(settings.enabled!==false){bindUser(root,s,catalogData,home,progress,official)}
}
function trackCard(lang,icon,name,stages,progress){const list=stages.filter(x=>x.language===lang),done=list.filter(x=>progress.get(x.id)?.completed).length;return `<article class="card v197-track"><div><span>${icon}</span><div><h2>${name}</h2><small>${done}/50 ด่าน</small></div></div><div class="v197-progress"><i style="width:${done*2}%"></i></div><button class="btn" data-v197-track="${lang}">เปิดด่าน ${name}</button></article>`}
function questCard(q){const obj=q.objective_type==='accuracy'?`Accuracy ≥ ${q.target_value}%`:q.objective_type==='time'?`เวลา ≤ ${q.target_value} วินาที`:'ผ่านด่าน';return `<div class="v197-quest ${q.completed?'done':''} ${q.locked?'locked':''}"><div><b>${q.completed?'✓ ':''}${esc(q.title)}</b><small>${esc(q.description||'')} • ${esc(obj)}</small></div><span>+${Number(q.reward_tokens||0)} 🪙</span></div>`}
function rankTable(rows){return `<div class="v197-rank-table">${rows.slice(0,15).map(x=>`<div class="v197-rank-row"><b>#${x.rank_no}</b><span>${esc(x.student_code||'')} ${esc(x.full_name||'')}</span>${tierBadge(x.tier)}<strong>${Number(x.rating||0).toFixed(1)}</strong></div>`).join('')||'<div class="v14-empty">ยังไม่มีข้อมูล Ranking</div>'}</div>`}
function officialCard(o){return `<div class="v197-official-row ${o.completed?'done':''}"><span class="v197-official-no">${o.official_stage_no}</span><div><b>${esc(o.title)}</b><small>${o.language.toUpperCase()} Stage ${o.source_stage} • เต็ม ${o.max_score}</small></div><div class="v197-official-state">${o.completed?`✓ ${Number(o.best_score||0).toFixed(2)}/${o.max_score}`:'ยังไม่ผ่าน'}</div><button class="btn sm" data-v197-official-stage="${o.official_stage_no}" data-stage-id="${esc(o.stage_id)}">${o.completed?'ฝึกใหม่':'เริ่ม'}</button></div>`}

function bindUser(root,s,catalogData,home,progress,official){
  let lang='html',diff='';const stages=catalogData.stages||[];
  const drawStages=()=>{const list=stages.filter(x=>x.language===lang&&(!diff||x.difficulty===diff));$('#v197-stage-list',root).innerHTML=list.map(st=>{const p=progress.get(st.id)||{},locked=!p.unlocked;return `<article class="v197-stage ${p.completed?'done':''} ${locked?'locked':''}"><div class="v197-stage-no">${st.stage}</div><div><b>${esc(st.title)}</b><small>${difficultyLabel(st.difficulty)} • ${st.timeLimit||st.time_limit_seconds||'-'} วินาที${p.completed?` • Best ${Number(p.best_wpm||0).toFixed(1)} WPM`:''}</small></div><div class="v197-stage-actions"><button class="btn sm" data-v197-stage="${st.id}" data-mode="practice" ${locked?'disabled':''}>ฝึก</button><button class="btn sm primary" data-v197-stage="${st.id}" data-mode="ranking" ${locked||home.settings?.leaderboard_enabled===false?'disabled':''}>Ranking</button></div></article>`}).join('')};
  drawStages();
  $('#v197-lang',root).onchange=e=>{lang=e.target.value;drawStages()};$('#v197-diff',root).onchange=e=>{diff=e.target.value;drawStages()};
  $$('[data-v197-track]',root).forEach(b=>b.onclick=()=>{lang=b.dataset.v197Track;$('#v197-lang',root).value=lang;drawStages();$('#v197-stage-list',root).scrollIntoView({behavior:'smooth',block:'start'})});
  root.addEventListener('click',async e=>{
    const st=e.target.closest('[data-v197-stage]');if(st){const item=stages.find(x=>x.id===st.dataset.v197Stage);if(item)openTyping(s,item,st.dataset.mode,null);return}
    const os=e.target.closest('[data-v197-official-stage]');if(os){const item=stages.find(x=>x.id===os.dataset.stageId);if(item)openTyping(s,item,'official',Number(os.dataset.v197OfficialStage));return}
  });
  $('#v197-rank-overall',root)?.addEventListener('click',async()=>{const r=await getClient().rpc('programming_activity_leaderboard_v197',{p_subject_id:s.id,p_scope:'overall'});if(r.error)return toast(errText(r.error),true);$('#v197-rank-list',root).innerHTML=rankTable(r.data||[])});
  $('#v197-submit-official',root)?.addEventListener('click',async()=>{const r=await getClient().rpc('submit_programming_official_v197',{p_subject_id:s.id});if(r.error)return toast(errText(r.error),true);toast(`ส่งผลกิจกรรมทางการแล้ว ${Number(r.data?.total_score||0).toFixed(2)}/40`);openSpecial(s.id)});
  bindFocus(root,s,home.focus||{});
}
function bindFocus(root,s,focus){let running=false;const btn=$('#v197-focus-toggle',root),label=$('#v197-focus-time',root);if(!btn)return;let seconds=Number(focus.seconds||0);const repaint=()=>label&&(label.textContent=fmtSec(seconds));repaint();btn.onclick=()=>{running=!running;btn.textContent=running?'หยุดพัก':'เริ่มจับเวลาฝึก';btn.classList.toggle('red',running);if(running)startFocusHeartbeat()};
 function startFocusHeartbeat(){cleanupFocus();focusTimer=setInterval(async()=>{if(!running||document.hidden||!$('#v197-root'))return;const r=await getClient().rpc('update_programming_focus_v197',{p_subject_id:s.id,p_heartbeat_seconds:30});if(r.error){running=false;cleanupFocus();toast(errText(r.error),true);return}seconds=Number(r.data?.seconds||seconds);repaint();if(r.data?.reward_tokens>0)toast(`สำเร็จเป้าหมายวันนี้ +${r.data.reward_tokens} Token`)},30000)}
}

async function openTyping(s,stage,mode,officialNo){
  try{
    const r=await getClient().rpc('start_programming_stage_v197',{p_subject_id:s.id,p_stage_id:stage.id,p_mode:mode,p_official_stage_no:officialNo});if(r.error)throw r.error;
    const sess=r.data,overlay=document.createElement('div');overlay.id='v197-typing-overlay';let valid='',mistakes=0,start=performance.now();
    overlay.innerHTML=`<div class="v197-typing-shell" style="--v197-accent:${esc(s.color_hex||'#EF6C00')}"><header><div><span class="v14-kicker">${mode==='official'?`OFFICIAL ${officialNo}/30`:mode.toUpperCase()}</span><h2>${esc(stage.language.toUpperCase())} Stage ${stage.stage} • ${esc(stage.title)}</h2><p>${esc(stage.description||stage.usage||'พิมพ์โค้ดให้ตรงกับต้นฉบับ')}</p></div><button class="btn" data-v197-close-typing>ปิด</button></header><div class="v197-typing-stats"><span>เวลา <b id="v197-type-time">0:00</b></span><span>WPM <b id="v197-type-wpm">0</b></span><span>ผิด <b id="v197-type-mistakes">0</b></span><span>ความคืบหน้า <b id="v197-type-progress">0%</b></span></div><div class="v197-typing-grid"><div><label>โค้ดต้นฉบับ</label><pre>${esc(stage.code)}</pre></div><div><label>พิมพ์โค้ดที่นี่</label><textarea id="v197-type-input" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="เริ่มพิมพ์จากบรรทัดแรก..."></textarea></div></div><div class="v197-type-bar"><i id="v197-type-bar-fill"></i></div><footer><span class="muted">ระบบตรวจผลและเวลาโดย Server • ปิด Paste เพื่อความยุติธรรม</span><button class="btn primary" id="v197-type-submit" disabled>ส่งผลด่าน</button></footer></div>`;
    document.body.appendChild(overlay);const ta=$('#v197-type-input',overlay),submit=$('#v197-type-submit',overlay);ta.focus();
    const tick=()=>{if(!overlay.isConnected)return;const sec=(performance.now()-start)/1000;$('#v197-type-time',overlay).textContent=fmtSec(sec);$('#v197-type-wpm',overlay).textContent=((valid.length/5)/(Math.max(1,sec)/60)).toFixed(1);requestAnimationFrame(tick)};requestAnimationFrame(tick);
    ta.addEventListener('paste',e=>{e.preventDefault();mistakes++;$('#v197-type-mistakes',overlay).textContent=mistakes});
    ta.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const nv=ta.value+'    ';if(stage.code.startsWith(nv)){valid=nv;ta.value=nv;update()}else{mistakes++;$('#v197-type-mistakes',overlay).textContent=mistakes}}});
    ta.addEventListener('input',()=>{const v=ta.value;if(stage.code.startsWith(v)){valid=v}else{mistakes++;ta.value=valid;$('#v197-type-mistakes',overlay).textContent=mistakes}update()});
    function update(){const pct=Math.round(valid.length/Math.max(1,stage.code.length)*100);$('#v197-type-progress',overlay).textContent=`${pct}%`;$('#v197-type-bar-fill',overlay).style.width=`${pct}%`;submit.disabled=valid!==stage.code}
    $('[data-v197-close-typing]',overlay).onclick=()=>overlay.remove();
    submit.onclick=async()=>{submit.disabled=true;submit.textContent='กำลังตรวจ...';const sr=await getClient().rpc('submit_programming_stage_v197',{p_session_id:sess.session_id,p_typed_text:valid,p_mistakes:mistakes,p_request_key:crypto.randomUUID()});if(sr.error){submit.disabled=false;submit.textContent='ส่งผลด่าน';return toast(errText(sr.error),true)}const d=sr.data||{};overlay.querySelector('.v197-typing-shell').innerHTML=`<div class="v197-result"><span>${d.passed?'✅':'⚠️'}</span><h2>${d.passed?'ผ่านด่าน':'ยังไม่ผ่านเกณฑ์'}</h2><div class="v197-result-grid"><div><small>WPM</small><b>${Number(d.wpm||0).toFixed(1)}</b></div><div><small>Accuracy</small><b>${Number(d.accuracy||0).toFixed(1)}%</b></div><div><small>เวลา</small><b>${fmtSec(d.elapsed_seconds||0)}</b></div><div><small>Token</small><b>+${Number(d.reward_tokens||0)+Number(d.quest_reward_tokens||0)}</b></div></div>${mode==='official'?`<p>คะแนนกิจกรรมด่านนี้ ${Number(d.official_stage_score||0).toFixed(2)} คะแนน</p>`:''}<button class="btn primary" id="v197-result-close">กลับกิจกรรม</button></div>`;$('#v197-result-close',overlay).onclick=()=>{overlay.remove();openSpecial(s.id)}};
  }catch(e){toast(errText(e),true)}
}

async function renderAdmin(root,s,catalogData,p){
  const c=getClient();const [homeR,dashR,questR]=await Promise.all([
    c.rpc('my_programming_activity_home_v197',{p_subject_id:s.id}),c.rpc('admin_programming_activity_dashboard_v197',{p_subject_id:s.id}),c.rpc('admin_programming_quests_v197',{p_subject_id:s.id})
  ]);for(const r of [homeR,dashR,questR])if(r.error)throw r.error;const settings=homeR.data?.settings||{},rows=dashR.data||[],quests=questR.data||[];
  root.innerHTML=`<section class="v14-page v197-page" id="v197-root" style="--v197-accent:${esc(s.color_hex||'#EF6C00')}"><div class="v197-topline">${backButton(s.id)}<span class="v197-safe-note">Admin • กิจกรรมพิเศษแยกจากคะแนนรายวิชา</span></div><header class="v197-hero"><div><span class="v14-kicker">ADMIN SPECIAL ACTIVITY • ${esc(s.code)}</span><h1>⌨️ Code Typing Academy</h1><p>บริหารกิจกรรม HTML 50 + Python 50 ด่าน • Quest • Ranking • Focus • Official Challenge 30 ด่าน/40 คะแนนกิจกรรม</p></div><div class="v197-admin-count"><b>${rows.length}</b><span>นักศึกษาในรายวิชา</span></div></header>
  <section class="card"><div class="v197-section-head"><div><span class="v14-kicker">SYSTEM CONTROL</span><h2>⚙️ ตั้งค่ากิจกรรม</h2></div><span class="v197-safe-note">ไม่เปลี่ยนคะแนน 100 คะแนนของรายวิชา</span></div><form id="v197-settings" class="v197-settings-grid">${settingCheck('enabled','เปิดกิจกรรม',settings.enabled)}${settingCheck('leaderboard_enabled','Ranking',settings.leaderboard_enabled)}${settingCheck('official_enabled','Official Challenge',settings.official_enabled)}${settingCheck('quests_enabled','Teacher Quest',settings.quests_enabled)}${settingCheck('focus_enabled','Daily Focus',settings.focus_enabled)}${settingCheck('sequential_unlock','ปลดล็อกทีละด่าน',settings.sequential_unlock)}<label>Accuracy ผ่านขั้นต่ำ<input class="input" name="min_accuracy" type="number" min="70" max="100" value="${Number(settings.min_accuracy||90)}"></label><label>Focus เป้าหมาย (นาที)<input class="input" name="focus_target_minutes" type="number" min="5" max="180" value="${Number(settings.focus_target_minutes||60)}"></label><label>Focus Token<input class="input" name="focus_reward_tokens" type="number" min="0" max="500" value="${Number(settings.focus_reward_tokens||15)}"></label><button class="btn primary" type="submit">บันทึกการตั้งค่า</button></form></section>
  <section class="card"><div class="v197-section-head"><div><span class="v14-kicker">CLASS ACTIVITY DASHBOARD</span><h2>📊 ความคืบหน้านักศึกษา</h2></div></div><div class="table-wrap"><table class="v197-admin-table"><thead><tr><th>#</th><th>รหัส/ชื่อ</th><th>ห้อง</th><th>ผ่าน</th><th>HTML</th><th>Python</th><th>ครั้ง</th><th>WPM</th><th>Acc.</th><th>Rating</th><th>Tier</th><th>Token</th><th>Official</th><th>Focus วันนี้</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.student_code||'-')}</b><br>${esc(x.full_name||'')}</td><td>${esc(x.class_name||'-')}</td><td>${x.completed_stages}/100</td><td>${x.html_best_stage}/50</td><td>${x.python_best_stage}/50</td><td>${x.total_attempts}</td><td>${Number(x.best_wpm||0).toFixed(1)}</td><td>${Number(x.avg_accuracy||0).toFixed(1)}%</td><td>${Number(x.rating||0).toFixed(1)}</td><td>${tierBadge(x.tier)}</td><td>${x.tokens}</td><td>${x.official_completed}/30 • ${Number(x.official_score||0).toFixed(2)}/40${x.official_submitted?' ✓':''}</td><td>${fmtSec(x.focus_today_seconds||0)}</td></tr>`).join('')||'<tr><td colspan="14" class="empty">ยังไม่มีนักศึกษาในกิจกรรม</td></tr>'}</tbody></table></div></section>
  <section class="v197-main-grid"><div class="card"><div class="v197-section-head"><div><span class="v14-kicker">TEACHER QUEST</span><h2>🎯 ภารกิจจากครู</h2></div></div><div class="v197-admin-quests">${quests.map(q=>`<div class="v197-admin-quest"><div><b>${esc(q.title)}</b><small>${q.language.toUpperCase()} Stage ${q.stage_no} • ${esc(q.objective_type)} ${q.target_value||''} • +${q.reward_tokens} Token • Tier ${esc(q.min_tier)}</small></div><button class="btn sm ${q.active?'red':'green'}" data-v197-quest-toggle="${q.id}" data-active="${q.active?'false':'true'}">${q.active?'ปิด':'เปิด'}</button></div>`).join('')||'<div class="v14-empty">ยังไม่มี Quest</div>'}</div></div><div class="card"><div class="v197-section-head"><div><span class="v14-kicker">CREATE QUEST</span><h2>＋ สร้างภารกิจ</h2></div></div><form id="v197-quest-form" class="v197-quest-form"><input class="input" name="title" placeholder="ชื่อภารกิจ" required><input class="input" name="description" placeholder="รายละเอียด"><div class="row"><select class="input" name="language"><option value="html">HTML</option><option value="python">Python</option></select><input class="input" name="stage_no" type="number" min="1" max="50" value="1"></div><div class="row"><select class="input" name="objective_type"><option value="pass">ผ่านด่าน</option><option value="accuracy">Accuracy</option><option value="time">เวลา</option></select><input class="input" name="target_value" type="number" min="0" value="0"></div><div class="row"><input class="input" name="reward_tokens" type="number" min="0" max="500" value="5"><select class="input" name="min_tier"><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option><option value="diamond">Diamond</option><option value="master">Master</option></select></div><button class="btn primary" type="submit">สร้าง Quest</button></form></div></section></section>`;
  bindAdmin(root,s);
}
function settingCheck(name,label,val){return `<label class="v197-switch"><input type="checkbox" name="${name}" ${val!==false?'checked':''}><span>${esc(label)}</span></label>`}
function bindAdmin(root,s){
  $('#v197-settings',root)?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const checked=n=>e.target.elements[n].checked;const r=await getClient().rpc('admin_set_programming_activity_settings_v197',{p_subject_id:s.id,p_enabled:checked('enabled'),p_leaderboard_enabled:checked('leaderboard_enabled'),p_official_enabled:checked('official_enabled'),p_quests_enabled:checked('quests_enabled'),p_focus_enabled:checked('focus_enabled'),p_sequential_unlock:checked('sequential_unlock'),p_min_accuracy:Number(f.get('min_accuracy')),p_focus_target_minutes:Number(f.get('focus_target_minutes')),p_focus_reward_tokens:Number(f.get('focus_reward_tokens'))});if(r.error)return toast(errText(r.error),true);toast('บันทึกการตั้งค่ากิจกรรมแล้ว');openSpecial(s.id)});
  $('#v197-quest-form',root)?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const r=await getClient().rpc('admin_upsert_programming_quest_v197',{p_subject_id:s.id,p_quest_id:null,p_title:String(f.get('title')||''),p_description:String(f.get('description')||''),p_language:String(f.get('language')),p_stage_no:Number(f.get('stage_no')),p_objective_type:String(f.get('objective_type')),p_target_value:Number(f.get('target_value')||0),p_reward_tokens:Number(f.get('reward_tokens')||0),p_min_tier:String(f.get('min_tier')),p_open_at:null,p_due_at:null,p_active:true});if(r.error)return toast(errText(r.error),true);toast('สร้าง Quest แล้ว');openSpecial(s.id)});
  $$('[data-v197-quest-toggle]',root).forEach(b=>b.onclick=async()=>{const r=await getClient().rpc('admin_set_programming_quest_active_v197',{p_quest_id:b.dataset.v197QuestToggle,p_active:b.dataset.active==='true'});if(r.error)return toast(errText(r.error),true);openSpecial(s.id)});
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-v197-special]');if(b){e.preventDefault();e.stopPropagation();openSpecial(b.dataset.v197Special);return}
  const back=e.target.closest?.('[data-v197-back]');if(back){e.preventDefault();navigateBack(back.dataset.v197Back)}
},true);
window.addEventListener('pagehide',cleanupFocus);
window.DOCNR_V197=Object.freeze({open:openSpecial,version:'V19.7-PROGRAMMING-SPECIAL-ACTIVITY'});
