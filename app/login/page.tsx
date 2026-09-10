"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HeartHandshake, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
export default function Login(){
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false); const router=useRouter();
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError("");const {error}=await createClient().auth.signInWithPassword({email,password});if(error){setError("E-mail ou senha inválidos.");setLoading(false);return}router.push("/dashboard");router.refresh()}
 return <main className="login-shell"><section className="brand-panel"><div className="brand"><span className="brand-mark"><HeartHandshake/></span><span>CAIC <b>Acolhe</b></span></div><div><p className="eyebrow">CUIDAR PARA EDUCAR</p><h1>Acolhimento que aproxima escola, família e cuidado.</h1><p className="lead">Organize encaminhamentos e acompanhamento multiprofissional com segurança e humanidade.</p></div><div className="security-note"><ShieldCheck/><span>Dados protegidos e acessos definidos por função.</span></div></section><section className="login-panel"><form className="card login-card" onSubmit={submit}><p className="eyebrow green">ACESSO INSTITUCIONAL</p><h2>Bem-vindo(a)</h2><p className="muted">Entre com o convite enviado pela administração.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@escola.edu.br" required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></label>{error&&<p className="error">{error}</p>}<button disabled={loading}>{loading?"Entrando...":"Entrar na plataforma"}</button><small>O cadastro público está desativado. Novos acessos são feitos por convite.</small></form></section></main>
}
