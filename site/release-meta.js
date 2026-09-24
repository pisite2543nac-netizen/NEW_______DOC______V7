// Single visible release source for DOC-FULL-NR production UI.
export const RELEASE_VERSION="V21.0";
export const RELEASE_NAME="V21.0 MAJOR STABILITY • UNIFIED RUNTIME • PRODUCTION READY";
export const RELEASE_DATE="2026-09-24";
export const RELEASE_CACHE="20260924-v21-0";
if(typeof window!=="undefined")window.DOCNR_RELEASE_META=Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,date:RELEASE_DATE,cache:RELEASE_CACHE});
