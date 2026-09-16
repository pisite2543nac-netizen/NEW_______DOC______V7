const DB_NAME="docfullnr-v18";
const DB_VERSION=1;
const DRAFTS="worksheet_drafts";
const OUTBOX="submission_outbox";

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains(DRAFTS)){
        const s=db.createObjectStore(DRAFTS,{keyPath:"key"});
        s.createIndex("updated_at","updated_at");
      }
      if(!db.objectStoreNames.contains(OUTBOX)){
        const s=db.createObjectStore(OUTBOX,{keyPath:"request_key"});
        s.createIndex("user_id","user_id");
        s.createIndex("created_at","created_at");
      }
    };
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
  });
}
async function tx(store,mode,fn){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(store,mode),s=t.objectStore(store);
    let out;
    try{out=fn(s)}catch(e){reject(e);return}
    t.oncomplete=()=>resolve(out?.result??out);
    t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
  }).finally(()=>db.close());
}
const draftKey=(uid,wid)=>`${uid}:${wid}`;
export async function putDraft(uid,worksheetId,answers,attachment_paths=[]){
  if(!uid||!worksheetId)return;
  const row={key:draftKey(uid,worksheetId),user_id:uid,worksheet_id:worksheetId,answers,attachment_paths,updated_at:Date.now()};
  await tx(DRAFTS,"readwrite",s=>s.put(row));return row;
}
export async function getDraft(uid,worksheetId){
  if(!uid||!worksheetId)return null;
  return await tx(DRAFTS,"readonly",s=>s.get(draftKey(uid,worksheetId)))||null;
}
export async function deleteDraft(uid,worksheetId){
  if(!uid||!worksheetId)return;
  await tx(DRAFTS,"readwrite",s=>s.delete(draftKey(uid,worksheetId)));
}
export async function queueFinal(row){
  if(!row?.request_key||!row?.user_id||!row?.worksheet_id)throw new Error("INVALID_OUTBOX_ITEM");
  await tx(OUTBOX,"readwrite",s=>s.put({...row,created_at:row.created_at||Date.now(),attempts:Number(row.attempts||0)}));
}
export async function listFinals(uid){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(OUTBOX,"readonly"),s=t.objectStore(OUTBOX),rows=[];
    const r=s.openCursor();
    r.onsuccess=()=>{const c=r.result;if(!c)return; if(!uid||c.value.user_id===uid)rows.push(c.value);c.continue()};
    r.onerror=()=>reject(r.error);t.oncomplete=()=>resolve(rows.sort((a,b)=>a.created_at-b.created_at));t.onerror=()=>reject(t.error);
  }).finally(()=>db.close());
}
export async function deleteFinal(requestKey){
  await tx(OUTBOX,"readwrite",s=>s.delete(requestKey));
}
export async function cleanup(ttlDays=30){
  const cutoff=Date.now()-ttlDays*86400000,db=await openDB();
  for(const store of [DRAFTS,OUTBOX]){
    await new Promise((resolve,reject)=>{
      const t=db.transaction(store,"readwrite"),s=t.objectStore(store),r=s.openCursor();
      r.onsuccess=()=>{const c=r.result;if(!c)return;if(Number(c.value.updated_at||c.value.created_at||0)<cutoff)c.delete();c.continue()};
      r.onerror=()=>reject(r.error);t.oncomplete=resolve;t.onerror=()=>reject(t.error);
    });
  }
  db.close();
}
