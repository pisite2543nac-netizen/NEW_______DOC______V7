import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

export const SUPABASE_URL="https://thjscmfqunlaqxlievna.supabase.co";
export const SUPABASE_KEY="sb_publishable_ZBMlwjpRKAL1egtnj-cqsQ_Etrjh_L_";
export const PROJECT_REF="thjscmfqunlaqxlievna";
export const STORAGE_KEY=`sb-${PROJECT_REF}-auth-token`;

let client=null;
export function getClient(){
  if(!client){
    client=createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
      realtime:{params:{eventsPerSecond:12}}
    });
    window.DOCNR_SUPABASE_SINGLETON=client;
  }
  return client;
}
export async function getSession(){
  return (await getClient().auth.getSession()).data?.session||null;
}
export async function getUserId(){
  return (await getSession())?.user?.id||null;
}
