"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LoginMode = "login" | "checking-invite" | "confirm-invite" | "set-password";

export default function Login(){
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 const [inviteToken,setInviteToken]=useState("");
 const [mode,setMode]=useState<LoginMode>("login");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const router=useRouter();

 useEffect(()=>{
  const query=new URLSearchParams(window.location.search);
  const tokenHash=query.get("token_hash");
  if(query.get("type")==="invite"&&tokenHash){
   setInviteToken(tokenHash);
   setMode("confirm-invite");
   return;
  }

  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  const supabase=createClient();
  let active=true;
  async function checkInvite(){
   const [{data:{session},error:sessionError},{data:{user}}]=await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser()
   ]);
   if(!active)return;
   const firstAccess=hash.get("type")==="invite"||
    user?.user_metadata?.first_access_required===true||
    session?.user.user_metadata?.first_access_required===true;
   if(!firstAccess){setMode("login");return}
   if(sessionError||!session){
    setError("Este convite é inválido ou expirou. Solicite um novo convite à administração.");
    setMode("login");
    return;
   }
   setEmail(user?.email||session.user.email||"");
   setMode("set-password");
  }
  setMode("checking-invite");
  void checkInvite();
  return()=>{active=false};
 },[]);

 async function confirmInvite(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");
  const {data,error:verifyError}=await createClient().auth.verifyOtp({
   token_hash:inviteToken,
   type:"invite"
  });
  if(verifyError||!data.session){
   setError("Este convite é inválido ou expirou. Solicite um novo convite.");
   setLoading(false);
   return;
  }
  setEmail(data.user?.email||"");
  setMode("set-password");
  setLoading(false);
 }

 async function submitLogin(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");
  const {error:loginError}=await createClient().auth.signInWithPassword({email,password});
  if(loginError){setError("E-mail ou senha inválidos.");setLoading(false);return}
  router.push("/dashboard");router.refresh();
 }

 async function createFirstPassword(e:FormEvent){
  e.preventDefault();setError("");
  if(password.length<8){setError("A senha deve ter pelo menos 8 caracteres.");return}
  if(password!==confirmPassword){setError("As senhas digitadas não são iguais.");return}
  setLoading(true);
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const {error:updateError}=await supabase.auth.updateUser({
   password,
   data:{...(user?.user_metadata||{}),first_access_required:false}
  });
  if(updateError){
   setError("Não foi possível criar a senha. Solicite um novo convite.");
   setLoading(false);
   return;
  }
  router.replace("/dashboard");router.refresh();
 }

 const firstAccess=mode==="set-password";
 const confirming=mode==="confirm-invite";
 const formHandler=confirming?confirmInvite:firstAccess?createFirstPassword:submitLogin;

 return <main className="login-shell">
  <section className="brand-panel">
   <div className="brand"><span className="brand-mark"><HeartHandshake/></span><span>CAIC <b>Acolhe</b></span></div>
   <div><p className="eyebrow">CUIDAR PARA EDUCAR</p><h1>Acolhimento que aproxima escola, família e cuidado.</h1><p className="lead">Organize encaminhamentos e acompanhamento multiprofissional com segurança e humanidade.</p></div>
   <div className="security-note"><ShieldCheck/><span>Dados protegidos e acessos definidos por função.</span></div>
  </section>
  <section className="login-panel">
   <form className="card login-card" onSubmit={formHandler}>
    <p className="eyebrow green">{confirming?"CONVITE RECEBIDO":firstAccess?"PRIMEIRO ACESSO":"ACESSO INSTITUCIONAL"}</p>
    <h2>{confirming?"Confirme seu acesso":firstAccess?"Crie sua senha":"Bem-vindo(a)"}</h2>
    <p className="muted">{confirming?"Clique abaixo para validar o convite e criar sua senha.":firstAccess?"Defina uma senha pessoal para concluir seu cadastro.":"Entre com o convite enviado pela administração."}</p>
    {mode==="checking-invite"?<p className="muted">Validando convite...</p>:confirming?
     <>{error&&<p className="error">{error}</p>}<button disabled={loading}>{loading?"Validando convite...":"Continuar para criar senha"}</button></>:
     <>{firstAccess?<label>E-mail<input type="email" value={email} disabled/></label>:<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@escola.edu.br" required/></label>}<label>{firstAccess?"Nova senha":"Senha"}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength={firstAccess?8:undefined} required/></label>{firstAccess&&<label>Confirmar nova senha<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={8} required/></label>}{error&&<p className="error">{error}</p>}<button disabled={loading}>{loading?(firstAccess?"Criando acesso...":"Entrando..."):(firstAccess?"Criar senha e entrar":"Entrar na plataforma")}</button>{!firstAccess&&<small>O cadastro público está desativado. Novos acessos são feitos por convite.</small>}</>}
   </form>
  </section>
 </main>;
}
