export const fmtDate=(v?:string|null)=>v?new Date(v).toLocaleString('th-TH'):'-';
export const toInputDate=(v?:string|null)=>v?new Date(v).toISOString().slice(0,16):'';
export const csvDownload=(rows:(string|number|null|undefined)[][],name='report.csv')=>{const body='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();URL.revokeObjectURL(a.href)};
export const classNames=(...v:(string|false|null|undefined)[])=>v.filter(Boolean).join(' ');
