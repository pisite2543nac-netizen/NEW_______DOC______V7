import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://pisite2543nac-netizen.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const LEVELS=new Set(['ปวช.1','ปวช.2','ปวช.3','ปวส.1','ปวส.2']);
const ROOMS=new Set(['/1','/2','/3','/4','/5','/6']);
const DEPARTMENTS=new Set(['คอมพิวเตอร์','อิเล็กทรอนิก']);
const MAJORS=new Set(['เทคโนโลยีสารสนเทศ (ทส.)','เทคโนโลยีธุรกิจดิจิทัล (ทธ.)','คอมพิวเตอร์ธุรกิจ (คธ.)']);
const MAX_PHOTO_BYTES=1024*1024;
function secret(){try{const raw=Deno.env.get('SUPABASE_SECRET_KEYS');if(raw)return JSON.parse(raw).default}catch{}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})}
function normalizePhone(input:unknown){const raw=String(input||'').trim().replace(/[\s()-]/g,'');if(!raw)return null;if(/^0\d{9}$/.test(raw))return '+66'+raw.slice(1);if(/^\+66\d{9}$/.test(raw))return raw;return '__INVALID__'}
function thaiText(input:unknown,max=120){const v=String(input||'').trim();return !!v&&v.length<=max&&/[\u0E00-\u0E7F]/.test(v)&&!/[A-Za-z]/.test(v)}
function decodeJpeg(input:unknown){const raw=String(input||'').trim();if(!raw)return {error:'PROFILE_PHOTO_REQUIRED'} as const;if(!raw.startsWith('data:image/jpeg;base64,'))return {error:'PROFILE_PHOTO_MUST_BE_CAMERA_JPEG'} as const;const b64=raw.slice('data:image/jpeg;base64,'.length);if(b64.length>Math.ceil(MAX_PHOTO_BYTES*4/3)+16)return {error:'PROFILE_PHOTO_TOO_LARGE'} as const;try{const bin=atob(b64);if(bin.length<1000||bin.length>MAX_PHOTO_BYTES)return {error:'PROFILE_PHOTO_INVALID_SIZE'} as const;const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)return {error:'PROFILE_PHOTO_INVALID_JPEG'} as const;return {bytes} as const}catch{return {error:'PROFILE_PHOTO_INVALID_BASE64'} as const}}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const svc=createClient(Deno.env.get('SUPABASE_URL')!,secret(),{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json();
    const studentCode=String(body.student_code||body.username||'').trim(),username=studentCode,password=String(body.password||''),fullName=String(body.full_name||'').trim(),nickname=String(body.nickname||'').trim(),birthDate=String(body.birth_date||'').trim();
    const registrationCode=String(body.registration_code||'').trim(),gradeLevel=String(body.grade_level||'').trim(),roomLabel=String(body.room_label||'').trim(),department=String(body.department||'').trim(),major=String(body.major||'').trim();
    const phone=normalizePhone(body.phone),photoSource=String(body.profile_photo_source||''),photo=decodeJpeg(body.profile_photo_jpeg),contact=null;
    if(!/^\d{1,15}$/.test(studentCode)||password.length<8||!fullName||!nickname||!LEVELS.has(gradeLevel)||!ROOMS.has(roomLabel)||!DEPARTMENTS.has(department)||!MAJORS.has(major))return json({error:'INVALID_REGISTRATION_DATA'},400);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||new Date(birthDate+'T00:00:00Z').getTime()>Date.now())return json({error:'INVALID_BIRTH_DATE'},400);
    if(!thaiText(fullName,160)||!thaiText(nickname,40))return json({error:'REGISTRATION_THAI_ONLY'},400);
    if(username.toLowerCase()==='pisit2000')return json({error:'USERNAME_RESERVED'},409);
    if(phone==='__INVALID__')return json({error:'INVALID_PHONE'},400);
    if(photoSource!=='camera_live')return json({error:'PROFILE_PHOTO_CAMERA_ONLY'},400);if('error' in photo)return json({error:photo.error},400);
    const {data:cfg,error:ce}=await svc.from('system_settings').select('value').eq('key','registration').single();
    if(ce||!cfg?.value?.enabled)return json({error:'REGISTRATION_DISABLED'},403);
    if(await sha256(registrationCode)!==String(cfg.value.code_sha256||''))return json({error:'INVALID_REGISTRATION_CODE'},403);
    const dup=await svc.from('profiles').select('id').or(`username.ilike.${username},student_code.eq.${studentCode}`).limit(1);if(dup.error)return json({error:dup.error.message},500);if((dup.data||[]).length)return json({error:'USERNAME_EXISTS'},409);
    if(phone){const pd=await svc.from('profiles').select('id').eq('phone',phone).limit(1);if(pd.error)return json({error:pd.error.message},500);if((pd.data||[]).length)return json({error:'PHONE_EXISTS'},409)}
    const authEmail=`${studentCode.toLowerCase()}@docfullnr.local`;
    const {data:created,error}=await svc.auth.admin.createUser({email:authEmail,password,email_confirm:true,user_metadata:{full_name:fullName,nickname,username,student_code:studentCode,profile_photo_source:'camera_live'}});if(error)return json({error:error.message},400);
    const id=created.user.id,className=`${gradeLevel}${roomLabel}`,avatarPath=`${id}/profile.jpg`;
    const uploaded=await svc.storage.from('avatars').upload(avatarPath,photo.bytes,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});if(uploaded.error){await svc.auth.admin.deleteUser(id);return json({error:'PROFILE_PHOTO_UPLOAD_FAILED'},500)}
    const now=new Date().toISOString();
    const {error:pe}=await svc.from('profiles').update({full_name:fullName,display_name:nickname,username,role:'user',student_code:studentCode,birth_date:birthDate,class_name:className,grade_level:gradeLevel,room_label:roomLabel,department,major,phone,phone_verified_at:null,contact_email:null,avatar_path:avatarPath,active:false,approval_status:'pending',approval_requested_at:now,academic_status:'studying'}).eq('id',id);
    if(pe){await svc.storage.from('avatars').remove([avatarPath]);await svc.auth.admin.deleteUser(id);return json({error:pe.message},500)}
    const {data:period}=await svc.from('system_settings').select('value').eq('key','academic_period').maybeSingle();const academicYear=String(period?.value?.academic_year||'2569'),semester=String(period?.value?.semester||'1');
    let roomId:string|null=null;const found=await svc.from('classrooms').select('id').eq('name',className).eq('academic_year',academicYear).eq('semester',semester).maybeSingle();if(found.error){await svc.storage.from('avatars').remove([avatarPath]);await svc.auth.admin.deleteUser(id);return json({error:'CLASSROOM_LOOKUP_FAILED'},500)}
    roomId=found.data?.id||null;
    if(!roomId){const ins=await svc.from('classrooms').insert({name:className,level:gradeLevel,academic_year:academicYear,semester,active:true,description:'สร้างอัตโนมัติจากการลงทะเบียนนักศึกษา'}).select('id').single();if(ins.error){const retry=await svc.from('classrooms').select('id').eq('name',className).eq('academic_year',academicYear).eq('semester',semester).maybeSingle();roomId=retry.data?.id||null}else roomId=ins.data?.id||null}
    if(roomId){const mr=await svc.from('classroom_memberships').upsert({classroom_id:roomId,user_id:id,active:true},{onConflict:'classroom_id,user_id'});if(mr.error){await svc.storage.from('avatars').remove([avatarPath]);await svc.auth.admin.deleteUser(id);return json({error:'CLASSROOM_MEMBERSHIP_FAILED'},500)}}
    await svc.from('audit_logs').insert({actor_id:null,action:'REGISTER_USER',entity_type:'profile',entity_id:id,metadata:{self_registration:true,approval_status:'pending',student_code:studentCode,nickname,birth_date:birthDate,grade_level:gradeLevel,room_label:roomLabel,department,major,phone_provided:!!phone,phone_verified:false,profile_photo:'camera_live',avatar_path:avatarPath,classroom_id:roomId,academic_year:academicYear,semester}});
    return json({ok:true,username:studentCode,nickname,birth_date:birthDate,approval_status:'pending',avatar_path:avatarPath,phone,phone_verified:false,classroom_id:roomId,academic_year:academicYear,semester});
  }catch(e){return json({error:e instanceof Error?e.message:'Server error'},500)}
});
