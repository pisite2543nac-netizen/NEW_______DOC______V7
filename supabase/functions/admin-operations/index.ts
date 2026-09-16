import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://pisite2543nac-netizen.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
function secret(){try{const raw=Deno.env.get('SUPABASE_SECRET_KEYS');if(raw)return JSON.parse(raw).default}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})}
function csvCell(v:unknown){const s=String(v??'');return /[\",\n\r]/.test(s)?`\"${s.replaceAll('\"','\"\"')}\"`:s}
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function cleanUsername(v:unknown){return String(v||'').trim().replace(/[^A-Za-z0-9._-]/g,'').slice(0,64)}
const LEVELS=new Set(['ปวช.1','ปวช.2','ปวช.3','ปวส.1','ปวส.2']);
const ROOMS=new Set(['/1','/2','/3','/4','/5','/6']);
const DEPARTMENTS=new Set(['คอมพิวเตอร์','อิเล็กทรอนิก']);
const MAJORS_LOW=new Set(['เทคโนโลยีสารสนเทศ (ทส.)','เทคโนโลยีธุรกิจดิจิทัล (ทธ.)','คอมพิวเตอร์ธุรกิจ (คธ.)']);
const MAJORS_HIGH=new Set(['เทคโนโลยีสารสนเทศ (ส.ทส.)','เทคโนโลยีธุรกิจดิจิทัล (ส.ทธ.)','คอมพิวเตอร์ธุรกิจ (ส.คท.)']);
const majorAllowed=(level:string,major:string)=>level.startsWith('ปวส.')?MAJORS_HIGH.has(major):MAJORS_LOW.has(major);
function thaiText(v:unknown,max=160){const s=String(v||'').trim();return !!s&&s.length<=max&&/[\u0E00-\u0E7F]/.test(s)&&!/[A-Za-z]/.test(s)}
function normalizePhone(input:unknown){const raw=String(input||'').trim().replace(/[\s()-]/g,'');if(!raw)return null;if(/^0\d{9}$/.test(raw))return '+66'+raw.slice(1);if(/^\+66\d{9}$/.test(raw))return raw;return '__INVALID__'}
function validBirthDate(v:unknown){const s=String(v||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(`${s}T00:00:00Z`);return Number.isFinite(d.getTime())&&d<=new Date()&&d.getUTCFullYear()>=1900}
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
      const {data:target,error:te}=await admin.from('profiles').select('*').eq('id',userId).single();if(te||!target)return json({error:'User not found'},404);
      const now=new Date().toISOString();
      const allowed:any={};
      if('full_name' in b)allowed.full_name=String(b.full_name||'').trim();
      if('contact_email' in b)allowed.contact_email=String(b.contact_email||'').trim().toLowerCase()||null;
      if(target.role==='user'){
        const fullName=String(b.full_name??target.full_name??'').trim(),nickname=String(b.display_name??target.display_name??'').trim(),studentCode=String(b.student_code??target.student_code??'').trim();
        const birthDate=String(b.birth_date??target.birth_date??'').trim(),gradeLevel=String(b.grade_level??target.grade_level??'').trim(),roomLabel=String(b.room_label??target.room_label??'').trim(),department=String(b.department??target.department??'').trim(),major=String(b.major??target.major??'').trim();
        const phone=normalizePhone(b.phone??target.phone),seatRaw=b.seat_number??target.seat_number,seatNumber=seatRaw===null||seatRaw===''?null:Number(seatRaw);
        if(!/^\d{1,15}$/.test(studentCode)||!thaiText(fullName)||!thaiText(nickname,40)||!validBirthDate(birthDate)||!LEVELS.has(gradeLevel)||!ROOMS.has(roomLabel)||!DEPARTMENTS.has(department)||!majorAllowed(gradeLevel,major))return json({error:'INVALID_USER_DATA'},400);
        if(phone==='__INVALID__'||!phone)return json({error:'INVALID_PHONE'},400);if(seatNumber!==null&&(!Number.isInteger(seatNumber)||seatNumber<1||seatNumber>999))return json({error:'INVALID_SEAT_NUMBER'},400);
        const dup=await admin.from('profiles').select('id').eq('student_code',studentCode).neq('id',userId).limit(1);if(dup.error)throw dup.error;if((dup.data||[]).length)return json({error:'STUDENT_CODE_EXISTS'},409);
        const pd=await admin.from('profiles').select('id').eq('phone',phone).neq('id',userId).limit(1);if(pd.error)throw pd.error;if((pd.data||[]).length)return json({error:'PHONE_EXISTS'},409);
        const className=`${gradeLevel}${roomLabel}`;
        Object.assign(allowed,{full_name:fullName,display_name:nickname,username:studentCode,student_code:studentCode,birth_date:birthDate,grade_level:gradeLevel,room_label:roomLabel,class_name:className,department,major,phone,seat_number:seatNumber,contact_email:null});
        const authUser=await admin.auth.admin.getUserById(userId);if(authUser.error)return json({error:authUser.error.message},400);
        const oldMeta=authUser.data.user?.user_metadata||{};
        const authUpdate=await admin.auth.admin.updateUserById(userId,{email:`${studentCode.toLowerCase()}@docfullnr.local`,email_confirm:true,user_metadata:{...oldMeta,full_name:fullName,nickname,username:studentCode,student_code:studentCode}});if(authUpdate.error)return json({error:authUpdate.error.message},400);
        const {data:period}=await admin.from('system_settings').select('value').eq('key','academic_period').maybeSingle();const academicYear=String(period?.value?.academic_year||'2569'),semester=String(period?.value?.semester||'1');
        let roomId:string|null=null;const found=await admin.from('classrooms').select('id').eq('name',className).eq('academic_year',academicYear).eq('semester',semester).maybeSingle();if(found.error)throw found.error;roomId=found.data?.id||null;
        if(!roomId){const ins=await admin.from('classrooms').insert({name:className,level:gradeLevel,academic_year:academicYear,semester,active:true,description:'สร้างอัตโนมัติจาก Admin แก้ข้อมูลนักศึกษา'}).select('id').single();if(ins.error){const retry=await admin.from('classrooms').select('id').eq('name',className).eq('academic_year',academicYear).eq('semester',semester).maybeSingle();roomId=retry.data?.id||null}else roomId=ins.data.id}
        if(!roomId)return json({error:'CLASSROOM_LOOKUP_FAILED'},500);
        await admin.from('classroom_memberships').update({active:false}).eq('user_id',userId).eq('active',true);
        const mem=await admin.from('classroom_memberships').upsert({classroom_id:roomId,user_id:userId,seat_number:seatNumber,active:true},{onConflict:'classroom_id,user_id'});if(mem.error)throw mem.error;
      }else{
        if(!allowed.full_name)allowed.full_name=target.full_name;
        if(!allowed.full_name)return json({error:'INVALID_USER_DATA'},400);
      }
      allowed.updated_at=now;
      const {error}=await admin.from('profiles').update(allowed).eq('id',userId);if(error)throw error;
      await admin.from('audit_logs').insert({actor_id:ud.user.id,action:'UPDATE_USER',entity_type:'profile',entity_id:userId,metadata:{fields:Object.keys(allowed),old_student_code:target.student_code,new_student_code:allowed.student_code||target.student_code,login_synced:target.role==='user'}});return json({ok:true,username:allowed.username||target.username,class_name:allowed.class_name||target.class_name});
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

    if(b.action==='initialize_system')return json({error:'LEGACY_INITIALIZE_SYSTEM_DISABLED_USE_RELEASE_TESTS'},410);

    if(b.action==='grade_submission')return json({error:'LEGACY_GRADE_DISABLED_USE_ADMIN_GRADE_SUBMISSION_V18'},410);

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
