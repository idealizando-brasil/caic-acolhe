"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CheckCircle2, HeartHandshake, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "./contract.css";

const initial={school:"",inep:"",name:"",email:"",phone:"",city:"",state:"",website:""};

export default function Contratar(){
 const [form,setForm]=useState(initial);
 const [busy,setBusy]=useState(false);
 const [done,setDone]=useState(false);
 const [error,setError]=useState("");

 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");
  const {error:requestError}=await createClient().rpc("submit_school_application",{
   p_school_name:form.school,p_inep_code:form.inep,p_contact_name:form.name,
   p_contact_email:form.email,p_contact_phone:form.phone,p_city:form.city,
   p_state:form.state,p_website:form.website
  });
  if(requestError){setError(requestError.message.includes("já recebida")?requestError.message:"Não foi possível enviar agora. Confira os dados e tente novamente.");setBusy(false);return}
  setDone(true);setBusy(false);
 }

 return <main className="contract-shell">
  <section className="contract-intro">
   <Link href="/login" className="contract-brand"><HeartHandshake/> <span>Idealizando <b>Acolhe</b></span></Link>
   <p className="eyebrow">PLATAFORMA PARA ESCOLAS</p>
   <h1>Acolhimento escolar organizado e seguro.</h1>
   <p>Um ambiente próprio para sua escola gerenciar alunos, encaminhamentos, agenda e atendimentos.</p>
   <div className="contract-price"><strong>R$ 49,90</strong><span>por mês, por escola</span></div>
   <ul><li><CheckCircle2/> Ambiente separado para cada escola</li><li><CheckCircle2/> Gestão de equipe por função</li><li><CheckCircle2/> Implantação acompanhada</li></ul>
   <small><ShieldCheck/> O envio deste formulário não realiza cobrança.</small>
  </section>
  <section className="contract-form-wrap">
   {done?<div className="card contract-success"><CheckCircle2/><h2>Solicitação recebida</h2><p>Vamos conferir os dados antes de liberar qualquer pagamento ou criar a escola.</p><Link href="/login">Voltar ao acesso institucional</Link></div>:
   <form className="card contract-form" onSubmit={submit}>
    <p className="eyebrow green">CONTRATAR</p><h2>Dados da escola</h2><p className="muted">Após a conferência, a equipe entrará em contato para ativação.</p>
    <label>Nome da escola<input value={form.school} onChange={e=>setForm({...form,school:e.target.value})} minLength={3} required/></label>
    <div className="contract-row"><label>Código INEP (opcional)<input value={form.inep} onChange={e=>setForm({...form,inep:e.target.value})}/></label><label>Estado<input value={form.state} onChange={e=>setForm({...form,state:e.target.value.toUpperCase()})} maxLength={2} placeholder="CE" required/></label></div>
    <label>Cidade<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} required/></label>
    <h3>Responsável pela contratação</h3>
    <label>Nome completo<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} minLength={3} required/></label>
    <div className="contract-row"><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Telefone/WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required/></label></div>
    <input className="website-field" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} aria-hidden="true"/>
    {error&&<p className="error">{error}</p>}<button disabled={busy}>{busy?"Enviando…":"Solicitar contratação"}</button>
    <small>Mensalidade aprovada: R$ 49,90. Nenhum débito é feito nesta etapa.</small>
   </form>}
  </section>
 </main>;
}

