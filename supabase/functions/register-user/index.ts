import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const ORIGIN="https://pisite2543nac-netizen.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve((req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  // Production self-registration is camera-only. app.js calls this route, while
  // camera-registration.js safely reroutes the request with a live JPEG.
  return json({error:"CAMERA_REGISTRATION_REQUIRED"},400);
});
