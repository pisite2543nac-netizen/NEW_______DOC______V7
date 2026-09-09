import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const OWNER_USERNAME = "Pisit2000";
const ownerEmail = `${OWNER_USERNAME.toLowerCase()}@docfullnr.local`;

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function show(text,kind="error"){
  const box=document.querySelector("#authmsg");
  if(box)box.innerHTML=`<div class="alert ${kind}">${esc(text)}</div>`;
}
function emailFor(value){
  const v=String(value||"").trim();
  return v.includes("@")?v.toLowerCase():`${v.toLowerCase()}@docfullnr.local`;
}

function patch(){
  const form=document.querySelector("#login");
  if(!form||form.dataset.usernameReady==="1")return;
  form.dataset.usernameReady="1";
  const input=form.querySelector('input[name="email"]');
  const pass=form.querySelector('input[name="password"]');
  const btn=form.querySelector('#loginbtn');
  if(!input||!pass||!btn)return;

  input.type="text";
  input.autocomplete="username";
  input.placeholder="เช่น Pisit2000";
  const label=input.closest('.field')?.querySelector('label');
  if(label)label.textContent="ชื่อผู้ใช้หรืออีเมล";

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const loginId=input.value.trim();
    const password=pass.value;
    const email=emailFor(loginId);
    btn.disabled=true;
    btn.textContent="กำลังเข้าสู่ระบบ...";
    show("","");

    let r=await sb.auth.signInWithPassword({email,password});
    if(!r.error){location.reload();return}

    if(loginId.toLowerCase()===OWNER_USERNAME.toLowerCase()){
      btn.textContent="กำลังสร้างบัญชีผู้ดูแลครั้งแรก...";
      const created=await sb.auth.signUp({
        email:ownerEmail,
        password,
        options:{data:{username:OWNER_USERNAME,full_name:OWNER_USERNAME}}
      });

      if(!created.error&&created.data.session){
        const boot=await sb.functions.invoke("bootstrap-admin",{body:{}});
        if(boot.error||boot.data?.error){
          const t=String(boot.data?.error||boot.error?.message||"ตั้งค่า Admin ไม่สำเร็จ");
          if(!t.toLowerCase().includes("already exists")){
            show(`สร้างบัญชีแล้ว แต่ตั้ง Admin ไม่สำเร็จ: ${t}`);
            btn.disabled=false;btn.textContent="เข้าสู่ระบบ";return;
          }
        }
        location.reload();return;
      }

      if(!created.error&&!created.data.session){
        show("สร้างบัญชีเจ้าของระบบแล้ว แต่ Supabase รอการยืนยันบัญชีครั้งแรก ส่งภาพหน้านี้กลับมา แล้วจะเปิดสิทธิ์ให้ต่อโดยตรง","warn");
        btn.disabled=false;btn.textContent="เข้าสู่ระบบ";return;
      }

      if(created.error&&String(created.error.message||"").toLowerCase().includes("already")){
        r=await sb.auth.signInWithPassword({email,password});
        if(!r.error){location.reload();return}
      }
    }

    show("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    btn.disabled=false;
    btn.textContent="เข้าสู่ระบบ";
  },true);
}

new MutationObserver(patch).observe(document.documentElement,{childList:true,subtree:true});
patch();
