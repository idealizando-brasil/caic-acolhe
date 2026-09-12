import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const authHeader=req.headers.get("Authorization");
  if(!authHeader)return new Response(JSON.stringify({error:"Não autorizado"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const {data:{user}}=await admin.auth.getUser(authHeader.replace("Bearer ",""));
  if(!user)return new Response(JSON.stringify({error:"Sessão inválida"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const body=await req.json();
  const allowedRoles=["school_admin","director","coordinator","psychologist","social_worker","teacher"];
  if(!body.email||!body.full_name||!body.school_id||!allowedRoles.includes(body.role))throw new Error("Dados inválidos");
  const {data:caller}=await admin.from("school_memberships").select("role").eq("school_id",body.school_id).eq("user_id",user.id).eq("active",true).single();
  const {data:profile}=await admin.from("profiles").select("platform_admin").eq("id",user.id).single();
  if(!profile?.platform_admin&&!["matrix_admin","school_admin","director"].includes(caller?.role||""))return new Response(JSON.stringify({error:"Sem permissão para convidar"}),{status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const {data,error}=await admin.auth.admin.inviteUserByEmail(body.email,{data:{full_name:body.full_name},redirectTo:"https://acolhe.idealizandoedu.com.br/login"});
  if(error)throw error;if(!data.user)throw new Error("Usuário não criado");
  await admin.from("profiles").upsert({id:data.user.id,full_name:body.full_name,email:body.email});
  const {error:memberError}=await admin.from("school_memberships").upsert({school_id:body.school_id,user_id:data.user.id,role:body.role,active:true},{onConflict:"school_id,user_id"});
  if(memberError)throw memberError;
  return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
 }catch(error){
  return new Response(JSON.stringify({error:error instanceof Error?error.message:"Erro interno"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
 }
});
