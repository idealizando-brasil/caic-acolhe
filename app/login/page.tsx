"use client";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type LoginMode = "login" | "checking-invite" | "set-password";

export default function Login(){
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 const [mode,setMode]=useState<LoginMode>("login");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const router=useRouter();

 useEffect(()=>{
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
  if(hash.get("type")!=="invite")return;
  setMode("checking-invite");
  const supabase=createClient();
  let active=true;
  async function checkInvite(){
   const {data:{session},error:sessionError}=await supabase.auth.getSession();
   if(!active)return;
   if(sessionError||!session){
    setError("Este convite é inválido ou expirou. Solicite um novo convite à administração.");
    setMode("login");
    return;
   }
   setEmail(session.user.email||"");
   setMode("set-password");
  }
  void checkInvite();
  return()=>{active=false};
 },[]);

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
  const {error:updateError}=await createClient().auth.updateUser({password});
  if(updateError){setError("Não foi possível criar a senha. Solicite um novo convite.");setLoading(false);return}
  router.replace("/dashboard");router.refresh();
 }

 const firstAccess=mode==="set-password";
 return <main className="login-shell"><section className="brand-panel"><div className="brand"><span className="brand-mark"><HeartHandshake/></span><span>CAIC <b>Acolhe</b></span></div><div><p className="eyebrow">CUIDAR PARA EDUCAR</p><h1>Acolhimento que aproxima escola, família e cuidado.</h1><p className="lead">Organize encaminhamentos e acompanhamento multiprofissional com segurança e humanidade.</p></div><div className="security-note"><ShieldCheck/><span>Dados protegidos e acessos definidos por função.</span></div></section><section className="login-panel"><form className="card login-card" onSubmit={firstAccess?createFirstPassword:submitLogin}><p className="eyebrow green">{firstAccess?"PRIMEIRO ACESSO":"ACESSO INSTITUCIONAL"}</p><h2>{firstAccess?"Crie sua senha":"Bem-vindo(a)"}</h2><p className="muted">{firstAccess?"Defina uma senha pessoal para concluir seu cadastro.":"Entre com o convite enviado pela administração."}</p>{mode==="checking-invite"?<p className="muted">Validando convite...</p>:<>{firstAccess?<label>E-mail<input type="email" value={email} disabled/></label>:<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@escola.edu.br" required/></label>}<label>{firstAccess?"Nova senha":"Senha"}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength={firstAccess?8:undefined} required/></label>{firstAccess&&<label>Confirmar nova senha<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={8} required/></label>}{error&&<p className="error">{error}</p>}<button disabled={loading}>{loading?(firstAccess?"Criando acesso...":"Entrando..."):(firstAccess?"Criar senha e entrar":"Entrar na plataforma")}</button>{!firstAccess&&<small>O cadastro público está desativado. Novos acessos são feitos por convite.</small>}</>}</form></section></main>
}
