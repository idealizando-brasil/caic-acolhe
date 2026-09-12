import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const allowedRoles=["school_admin","director","coordinator","psychologist","social_worker","teacher"];
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 try{
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token=req.headers.get("Authorization")?.replace("Bearer ","");
  if(!token)return json({error:"Não autorizado"},401);
  const {data:{user}}=await admin.auth.getUser(token);
  if(!user)return json({error:"Sessão inválida"},401);
  const {data:caller}=await admin.from("profiles").select("platform_admin").eq("id",user.id).single();
  if(!caller?.platform_admin)return json({error:"Somente o administrador central pode gerenciar usuários"},403);

  const body=await req.json();
  const {data:membership,error:membershipError}=await admin.from("school_memberships").select("id,user_id,school_id").eq("id",body.membership_id).eq("school_id",body.school_id).single();
  if(membershipError||!membership)throw new Error("Usuário não encontrado nesta escola");

  if(body.action==="delete"){
   if(membership.user_id===user.id)throw new Error("A conta administrativa não pode excluir a si própria");
   const {error:deleteMembershipError}=await admin.from("school_memberships").delete().eq("id",membership.id);
   if(deleteMembershipError)throw deleteMembershipError;
   const {count}=await admin.from("school_memberships").select("id",{count:"exact",head:true}).eq("user_id",membership.user_id);
   if((count||0)===0){
    await admin.from("profiles").delete().eq("id",membership.user_id);
    const {error:deleteUserError}=await admin.auth.admin.deleteUser(membership.user_id);
    if(deleteUserError)throw deleteUserError;
   }
   return json({success:true});
  }

  if(body.action==="update"){
   const fullName=String(body.full_name||"").trim();
   const email=String(body.email||"").trim().toLowerCase();
   if(!fullName||!email||!allowedRoles.includes(body.role))throw new Error("Preencha nome, e-mail e função corretamente");
   const {error:authError}=await admin.auth.admin.updateUserById(membership.user_id,{email,email_confirm:true});
   if(authError)throw authError;
   const {error:profileError}=await admin.from("profiles").update({full_name:fullName,email}).eq("id",membership.user_id);
   if(profileError)throw profileError;
   const {error:roleError}=await admin.from("school_memberships").update({role:body.role}).eq("id",membership.id);
   if(roleError)throw roleError;
   return json({success:true});
  }

  throw new Error("Ação inválida");
 }catch(error){return json({error:error instanceof Error?error.message:"Erro interno"},400)}
});
