import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGIN="https://pisite2543nac-netizen.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const LEVELS=new Set(['ปวช.1','ปวช.2','ปวช.3','ปวส.1','ปวส.2']);
const ROOMS=new Set(['/1','/2','/3','/4','/5','/6']);
const DEPARTMENTS=new Set(['คอมพิวเตอร์','อิเล็กทรอนิก']);
const MAJORS_LOW=new Set(['เทคโนโลยีสารสนเทศ (ทส.)','เทคโนโลยีธุรกิจดิจิทัล (ทธ.)','คอมพิวเตอร์ธุรกิจ (คธ.)']);
const MAJORS_HIGH=new Set(['เทคโนโลยีสารสนเทศ (ส.ทส.)','เทคโนโลยีธุรกิจดิจิทัล (ส.ทธ.)','คอมพิวเตอร์ธุรกิจ (ส.คท.)']);
const majorAllowed=(level:string,major:string)=>level.startsWith('ปวส.')?MAJORS_HIGH.has(major):MAJORS_LOW.has(major);

function secret(){try{const raw=Deno.env.get('SUPABASE_SECRET_KEYS');if(raw)return JSON.parse(raw).default}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const clean=(v:unknown)=>String(v||'').trim().replace(/[^A-Za-z0-9._-]/g,'').slice(0,64);
function thaiText(v:unknown,max=160){const s=String(v||'').trim();return !!s&&s.length<=max&&/[\u0E00-\u0E7F]/.test(s)&&!/[A-Za-z]/.test(s)}
function normalizePhone(input:unknown){const raw=String(input||'').trim().replace(/[\s()-]/g,'');if(!raw)return null;if(/^0\d{9}$/.test(raw))return '+66'+raw.slice(1);if(/^\+66\d{9}$/.test(raw))return raw;return '__INVALID__'}
function validBirthDate(v:unknown){const s=String(v||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(`${s}T00:00:00Z`);return Number.isFinite(d.getTime())&&d<=new Date()&&d.getUTCFullYear()>=1900}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const svc=createClient(Deno.env.get('SUPABASE_URL')!,secret(),{auth:{persistSession:false,autoRefreshToken:false}});
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:u,error:ue}=await svc.auth.getUser(token);if(ue||!u.user)return json({error:'Unauthorized'},401);
    const {data:ap}=await svc.from('profiles').select('role,active,approval_status').eq('id',u.user.id).single();
    if(!ap||ap.role!=='admin'||!ap.active||ap.approval_status!=='approved')return json({error:'Forbidden'},403);

    const b=await req.json();
    const role=b.role==='admin'?'admin':'user';
    const password=String(b.password||'');
    if(password.length<8)return json({error:'INVALID_USER_DATA'},400);

    let username='',studentCode:string|null=null,fullName='',nickname:string|null=null,birthDate:string|null=null,phone:string|null=null;
    let gradeLevel:string|null=null,roomLabel:string|null=null,department:string|null=null,major:string|null=null,className:string|null=null,contact:string|null=null;
    const seatNumber=b.seat_number?Number(b.seat_number):null;

    if(role==='user'){
      studentCode=String(b.student_code||'').trim();username=studentCode;fullName=String(b.full_name||'').trim();nickname=String(b.display_name||b.nickname||'').trim();birthDate=String(b.birth_date||'').trim();
      gradeLevel=String(b.grade_level||'').trim();roomLabel=String(b.room_label||'').trim();department=String(b.department||'').trim();major=String(b.major||'').trim();phone=normalizePhone(b.phone);
      if(!/^\d{1,15}$/.test(studentCode)||!thaiText(fullName)||!thaiText(nickname,40)||!validBirthDate(birthDate)||!LEVELS.has(gradeLevel)||!ROOMS.has(roomLabel)||!DEPARTMENTS.has(department)||!majorAllowed(gradeLevel,major))return json({error:'INVALID_USER_DATA'},400);
      if(phone==='__INVALID__'||!phone)return json({error:'INVALID_PHONE'},400);
      if(seatNumber!==null&&(!Number.isInteger(seatNumber)||seatNumber<1||seatNumber>999))return json({error:'INVALID_SEAT_NUMBER'},400);
      className=`${gradeLevel}${roomLabel}`;
    }else{
      username=clean(b.username);fullName=String(b.full_name||'').trim();contact=String(b.email||'').trim().toLowerCase()||null;
      if(username.length<4||!fullName)return json({error:'INVALID_USER_DATA'},400);
      if(contact&&!/^\S+@\S+\.\S+$/.test(contact))return json({error:'INVALID_CONTACT_EMAIL'},400);
      if(username.toLowerCase()==='pisit2000')return json({error:'USERNAME_RESERVED'},409);
    }

    const dup=await svc.from('profiles').select('id').or(`username.ilike.${username}${studentCode?`,student_code.eq.${studentCode}`:''}`).limit(1);
    if(dup.error)return json({error:dup.error.message},500);if((dup.data||[]).length)return json({error:'USERNAME_EXISTS'},409);
    if(phone){const pd=await svc.from('profiles').select('id').eq('phone',phone).limit(1);if(pd.error)return json({error:pd.error.message},500);if((pd.data||[]).length)return json({error:'PHONE_EXISTS'},409)}

    const authEmail=role==='admin'&&contact?contact:`${username.toLowerCase()}@docfullnr.local`;
    const {data:created,error}=await svc.auth.admin.createUser({email:authEmail,password,email_confirm:true,user_metadata:{full_name:fullName,nickname,username,student_code:studentCode}});
    if(error)return json({error:error.message},400);
    const id=created.user.id,now=new Date().toISOString();

    let classroomId:string|null=null;
    if(role==='user'&&className){
      const {data:period}=await svc.from('system_settings').select('value').eq('key','academic_period').maybeSingle();
      const academicYear=String(period?.value?.academic_year||'2569'),semester=String(period?.value?.semester||'1');
      const found=await svc.from('classrooms').select('id').eq('name',className).eq('academic_year',academicYear).eq('semester',semester).maybeSingle();
      if(found.error){await svc.auth.admin.deleteUser(id);return json({error:'CLASSROOM_LOOKUP_FAILED'},500)}
      classroomId=found.data?.id||null;
      if(!classroomId){
        const ins=await svc.from('classrooms').insert({name:className,level:gradeLevel,academic_year:academicYear,semester,active:true,description:'สร้างอัตโนมัติจาก Admin สร้างนักศึกษา'}).select('id').single();
        if(ins.error){const retry=await svc.from('classrooms').select('id').eq('name',className).eq('academic_year',academicYear).eq('semester',semester).maybeSingle();classroomId=retry.data?.id||null}else classroomId=ins.data.id;
      }
    }

    const profilePayload:any={full_name:fullName,display_name:nickname||fullName,username,role,class_name:className,student_code:studentCode,grade_level:gradeLevel,room_label:roomLabel,department,major,seat_number:Number.isFinite(seatNumber)?seatNumber:null,phone,phone_verified_at:null,birth_date:birthDate,contact_email:contact,active:true,approval_status:'approved',approval_requested_at:now,approved_at:now,approved_by:u.user.id,academic_status:'studying'};
    const {error:pe}=await svc.from('profiles').update(profilePayload).eq('id',id);
    if(pe){await svc.auth.admin.deleteUser(id);return json({error:pe.message},500)}

    if(classroomId){const me=await svc.from('classroom_memberships').upsert({classroom_id:classroomId,user_id:id,seat_number:Number.isFinite(seatNumber)?seatNumber:null,active:true},{onConflict:'classroom_id,user_id'});if(me.error){await svc.auth.admin.deleteUser(id);return json({error:me.error.message},500)}}

    await svc.from('audit_logs').insert({actor_id:u.user.id,action:'CREATE_USER',entity_type:'profile',entity_id:id,metadata:{username,role,classroom_id:classroomId,student_code:studentCode,approval_status:'approved',created_by_admin:true}});
    return json({ok:true,id,username,approval_status:'approved',classroom_id:classroomId});
  }catch(e){return json({error:e instanceof Error?e.message:'Server error'},500)}
});
