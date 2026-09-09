import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
const sb=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const OWNER_USERNAME="Pisit2000";
const OWNER_EMAIL="pisite.2543nac@gmail.com";
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function show(text,kind="error"){const box=document.querySelector("#authmsg");if(box)box.innerHTML=text?`<div class="alert ${kind}">${esc(text)}</div>`:""}
function emailFor(value){const v=String(value||"").trim();if(v.includes("@"))return v.toLowerCase();if(v.toLowerCase()===OWNER_USERNAME.toLowerCase())return OWNER_EMAIL;return `${v.toLowerCase()}@docfullnr.local`}
function patch(){
 const form=document.querySelector("#login");if(!form||form.dataset.usernameReady==="1")return;form.dataset.usernameReady="1";
 const input=form.querySelector('input[name="email"]'),pass=form.querySelector('input[name="password"]'),btn=form.querySelector('#loginbtn');if(!input||!pass||!btn)return;
 input.type="text";input.autocomplete="username";input.placeholder="เช่น Pisit2000";const label=input.closest('.field')?.querySelector('label');if(label)label.textContent="ชื่อผู้ใช้หรืออีเมล";
 form.addEventListener("submit",async e=>{e.preventDefault();e.stopImmediatePropagation();const loginId=input.value.trim(),password=pass.value;if(!loginId||!password){show("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");return}btn.disabled=true;btn.textContent="กำลังเข้าสู่ระบบ...";show("");const {error}=await sb.auth.signInWithPassword({email:emailFor(loginId),password});if(!error){location.reload();return}show("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");btn.disabled=false;btn.textContent="เข้าสู่ระบบ"},true);
}
new MutationObserver(patch).observe(document.documentElement,{childList:true,subtree:true});patch();
