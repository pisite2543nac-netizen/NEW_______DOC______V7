import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://pisite2543nac-netizen.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
function secret(){try{const raw=Deno.env.get('SUPABASE_SECRET_KEYS');if(raw)return JSON.parse(raw).default}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})}
function csvCell(v:unknown){const s=String(v??'');return /[\",\n\r]/.test(s)?`\"${s.replaceAll('\"','\"\"')}\"`:s}
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function cleanUsername(v:unknown){return String(v||'').trim().replace(/[^A-Za-z0-9._-]/g,'').slice(0,64)}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,secret(),{auth:{persistSession:false,autoRefreshToken:false}});
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');const {data:ud,error:ue}=await admin.auth.getUser(token);if(ue||!ud.user)return json({error:'Unauthorized'},401);
    const {data:p}=await admin.from('profiles').select('role,active,approval_status').eq('id',ud.user.id).single();if(!p||p.role!=='admin'||!p.active||p.approval_status!=='approved')return json({error:'Forbidden'},403);
    const b=await req.json();

    if(b.action==='health'){
      const tables=['profiles','classrooms','subjects','worksheets','worksheet_answer_keys','submissions','submission_grades','worksheet_assignments','subject_enrollments','exam_attempts','attendance_records'];const counts:any={};
      for(const t of tables){const r=await admin.from(t).select('*',{count:'exact',head:true});if(r.error)throw r.error;counts[t]=r.count||0}
      const {data:reg}=await admin.from('system_settings').select('value').eq('key','registration').maybeSingle();return json({ok:true,counts,registration_enabled:reg?.value?.enabled===true,server_time:new Date().toISOString()});
    }

    if(b.action==='update_user'){
      const userId=String(b.user_id||'');if(!userId)return json({error:'User id required'},400);
      const allowed:any={};for(const k of ['full_name','display_name','student_code','class_name','grade_level','room_label','seat_number','phone','contact_email','department','major'])if(k in b)allowed[k]=b[k];
      if(b.role==='admin'||b.role==='user')allowed.role=b.role;allowed.updated_at=new Date().toISOString();
      const {error}=await admin.from('profiles').update(allowed).eq('id',userId);if(error)throw error;
      await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'UPDATE_USER',entity_type:'profile',entity_id:userId,metadata:{fields:Object.keys(allowed)}});return json({ok:true});
    }

    if(b.action==='reset_password'){
      const userId=String(b.user_id||''),password=String(b.password||'');if(!userId||password.length<8)return json({error:'Password must be at least 8 characters'},400);
      const {data:target}=await admin.from('profiles').select('id,role').eq('id',userId).single();if(!target)return json({error:'User not found'},404);if(target.role==='admin'&&userId!==ud.user.id)return json({error:'Cannot reset another admin password'},403);
      const {error}=await admin.auth.admin.updateUserById(userId,{password});if(error)return json({error:error.message},400);await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'RESET_PASSWORD',entity_type:'profile',entity_id:userId,metadata:{self:userId===ud.user.id}});return json({ok:true});
    }

    if(b.action==='set_registration'){
      const enabled=b.enabled===true;const {data:old}=await admin.from('system_settings').select('value').eq('key','registration').maybeSingle();let codeHash=String(old?.value?.code_sha256||'');
      if(typeof b.registration_code==='string'&&b.registration_code.trim()){const code=b.registration_code.trim();if(code.length<6)return json({error:'Registration code must be at least 6 characters'},400);codeHash=await sha256(code)}if(enabled&&!codeHash)return json({error:'Registration code required'},400);
      const value={enabled,code_sha256:codeHash,min_password_length:8};const {error}=await admin.from('system_settings').upsert({key:'registration',value,updated_by:ud.user.id,updated_at:new Date().toISOString()});if(error)throw error;await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'SET_REGISTRATION',entity_type:'system_setting',metadata:{enabled,code_changed:typeof b.registration_code==='string'&&!!b.registration_code.trim()}});return json({ok:true,enabled});
    }

    if(b.action==='initialize_system'){
      const testPassword=String(b.test_user_password||'');if(testPassword.length<8)return json({error:'Test user password must be at least 8 characters'},400);const testUsername=cleanUsername(b.test_username||'User2000')||'User2000',roomName=String(b.room_name||'ห้องทดสอบระบบ').trim()||'ห้องทดสอบระบบ';
      let room:any=(await admin.from('classrooms').select('*').eq('name',roomName).maybeSingle()).data;if(!room){const rr=await admin.from('classrooms').insert({name:roomName,level:'ทดสอบ',academic_year:'2569',semester:'1',description:'ห้องสำหรับตรวจสอบระบบก่อนใช้งานจริง',active:true}).select().single();if(rr.error)throw rr.error;room=rr.data}
      let user:any=(await admin.from('profiles').select('*').ilike('username',testUsername).maybeSingle()).data;const now=new Date().toISOString();
      if(!user){const cr=await admin.auth.admin.createUser({email:`${testUsername.toLowerCase()}@docfullnr.local`,password:testPassword,email_confirm:true,user_metadata:{full_name:'ผู้ใช้ทดสอบระบบ',username:testUsername}});if(cr.error)return json({error:cr.error.message},400);const id=cr.data.user.id;const pr=await admin.from('profiles').update({username:testUsername,full_name:'ผู้ใช้ทดสอบระบบ',display_name:'ผู้ใช้ทดสอบระบบ',role:'user',student_code:'TEST001',class_name:roomName,active:true,approval_status:'approved',approval_requested_at:now,approved_at:now,approved_by:ud.user.id,academic_status:'studying'}).eq('id',id).select().single();if(pr.error){await admin.auth.admin.deleteUser(id);throw pr.error}user=pr.data}else{const ur=await admin.auth.admin.updateUserById(user.id,{password:testPassword,email_confirm:true});if(ur.error)return json({error:ur.error.message},400);await admin.from('profiles').update({role:'user',active:true,approval_status:'approved',approved_at:now,approved_by:ud.user.id,academic_status:'studying',class_name:roomName}).eq('id',user.id)}
      const mem=await admin.from('classroom_memberships').upsert({classroom_id:room.id,user_id:user.id,active:true},{onConflict:'classroom_id,user_id'});if(mem.error)throw mem.error;
      const {data:subject,error:se}=await admin.from('subjects').select('id,code,name').eq('active',true).eq('subject_type','subject').order('code').limit(1).single();if(se)throw se;
      let ws:any=(await admin.from('worksheets').select('*').eq('reference_code','SYSTEM-TEST-001').maybeSingle()).data;const open=new Date(Date.now()-5*60000).toISOString(),due=new Date(Date.now()+7*86400000).toISOString();const questions=[{id:'q1',type:'singleChoice',text:'ข้อใดเป็นรหัสยืนยันว่าระบบทำงาน?',points:1,required:true,options:['READY','STOP']},{id:'q2',type:'shortAnswer',text:'พิมพ์คำว่า TEST เพื่อทดสอบการบันทึกคำตอบ',points:1,required:true,options:[]}];
      if(!ws){const wr=await admin.from('worksheets').insert({subject_id:subject.id,classroom_id:room.id,title:'ใบงานทดสอบระบบ DOC-FULL-NR',description:'ใช้ตรวจสอบกระบวนการตั้งแต่ผู้เรียนรับงานจนถึงครูตรวจงาน',instructions:'ตอบ 2 ข้อ แล้วกดส่งงาน',mode:'digital',status:'published',questions,open_at:open,due_at:due,allow_late:false,allow_resubmit:true,max_attempts:3,allow_draft:true,copy_paste_allowed:true,reference_code:'SYSTEM-TEST-001',published_at:now,created_by:ud.user.id}).select().single();if(wr.error)throw wr.error;ws=wr.data}else{const wr=await admin.from('worksheets').update({subject_id:subject.id,classroom_id:room.id,status:'published',questions,open_at:open,due_at:due,closed_at:null,archived_at:null,published_at:now}).eq('id',ws.id).select().single();if(wr.error)throw wr.error;ws=wr.data}
      const ak=await admin.from('worksheet_answer_keys').upsert({worksheet_id:ws.id,answer_key:{q1:'READY',q2:'TEST'},rubric:{title:'System Test',max_score:2},updated_by:ud.user.id,updated_at:now});if(ak.error)throw ak.error;const asg=await admin.from('worksheet_assignments').upsert({worksheet_id:ws.id,user_id:user.id,assigned_by:ud.user.id,assignment_source:'manual'},{onConflict:'worksheet_id,user_id'});if(asg.error)throw asg.error;await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'INITIALIZE_SYSTEM_TEST',entity_type:'system',metadata:{room_id:room.id,test_user_id:user.id,worksheet_id:ws.id}});return json({ok:true,test_username:testUsername,room_id:room.id,user_id:user.id,worksheet_id:ws.id,worksheet_title:ws.title});
    }

    if(b.action==='grade_submission'){
      const submissionId=String(b.submission_id||''),score=Number(b.score),maxScore=Number(b.max_score);if(!submissionId||!Number.isFinite(score)||!Number.isFinite(maxScore)||score<0||maxScore<0||score>maxScore)return json({error:'Invalid score'},400);const {data:s,error:se}=await admin.from('submissions').select('id,status').eq('id',submissionId).single();if(se||!s)return json({error:'Submission not found'},404);
      const now=new Date().toISOString(),payload={submission_id:submissionId,score,max_score:maxScore,grade:b.grade?String(b.grade):null,rubric_result:b.rubric_result||{},admin_comment:b.admin_comment?String(b.admin_comment):null,graded_by:ud.user.id,graded_at:now,grading_status:'final',finalized_at:now,updated_at:now};const gr=await admin.from('submission_grades').upsert(payload);if(gr.error)throw gr.error;const sr=await admin.from('submissions').update({status:'graded'}).eq('id',submissionId);if(sr.error)throw sr.error;await admin.from('audit_logs').insert({actor_id:ud.user.id,action:s.status==='graded'?'UPDATE_GRADE':'GRADE_SUBMISSION',entity_type:'submission',entity_id:submissionId,metadata:{score,max_score:maxScore}});return json({ok:true});
    }

    if(b.action==='create_override'){
      const worksheetId=String(b.worksheet_id||''),userId=String(b.user_id||''),reason=String(b.reason||'').trim();if(!worksheetId||!userId||!reason)return json({error:'Worksheet, user and reason required'},400);const expires=b.expires_at?new Date(String(b.expires_at)).toISOString():null,allowLate=b.allow_late!==false,allowResubmit=b.allow_resubmit!==false,extra=Math.max(0,Math.min(20,Number(b.extra_attempts??1)||0));
      await admin.from('submission_overrides').update({active:false,revoked_at:new Date().toISOString(),revoked_by:ud.user.id}).eq('worksheet_id',worksheetId).eq('user_id',userId).eq('active',true);const rr=await admin.from('submission_overrides').insert({worksheet_id:worksheetId,user_id:userId,reason,expires_at:expires,active:true,allow_late:allowLate,allow_resubmit:allowResubmit,extra_attempts:extra,created_by:ud.user.id}).select().single();if(rr.error)throw rr.error;await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'CREATE_OVERRIDE',entity_type:'submission_override',entity_id:rr.data.id,metadata:{worksheet_id:worksheetId,user_id:userId,expires_at:expires,allow_late:allowLate,allow_resubmit:allowResubmit,extra_attempts:extra}});return json({ok:true,id:rr.data.id});
    }
    if(b.action==='revoke_override'){const id=String(b.override_id||'');if(!id)return json({error:'Override id required'},400);const rr=await admin.from('submission_overrides').update({active:false,revoked_at:new Date().toISOString(),revoked_by:ud.user.id}).eq('id',id);if(rr.error)throw rr.error;await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'REVOKE_OVERRIDE',entity_type:'submission_override',entity_id:id});return json({ok:true});}

    if(b.action==='export_report'){
      const {data,error}=await admin.from('submissions').select('id,status,submitted_at,confirmed_at,is_late,attempt_count,profiles(full_name,student_code,class_name),worksheets(title,subjects(name,code)),submission_grades(score,max_score,grade)').order('updated_at',{ascending:false});if(error)throw error;
      const header=['ชื่อผู้เรียน','รหัสผู้เรียน','ห้อง','รหัสวิชา','รายวิชา','ใบงาน','สถานะ','เวลาส่ง','ส่งช้า','จำนวนครั้ง','คะแนน','คะแนนเต็ม','เกรด'],lines=[header.map(csvCell).join(',')];for(const r of data||[]){const pr:any=r.profiles,ws:any=r.worksheets,gr:any=r.submission_grades;lines.push([pr?.full_name,pr?.student_code,pr?.class_name,ws?.subjects?.code,ws?.subjects?.name,ws?.title,r.status,r.submitted_at||r.confirmed_at,r.is_late?'ใช่':'ไม่',r.attempt_count,gr?.score,gr?.max_score,gr?.grade].map(csvCell).join(','))}
      const stamp=new Date().toISOString().replace(/[:.]/g,'-');await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'EXPORT_REPORT',entity_type:'report',metadata:{rows:data?.length||0}});return json({csv:'\uFEFF'+lines.join('\r\n'),filename:`nangrong-report-${stamp}.csv`});
    }
    return json({error:'Unknown action'},400);
  }catch(e){return json({error:e instanceof Error?e.message:'Server error'},500)}
});
