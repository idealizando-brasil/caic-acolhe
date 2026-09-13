"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Inbox } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./admin.css";

type Application={id:string;school_name:string;contact_name:string;contact_email:string;contact_phone:string;city:string;state:string;monthly_price:number;status:string;created_at:string};
type Subscription={id:string;monthly_price:number;status:string;next_due_date:string|null;schools:{name:string}|null};
const statusLabels:Record<string,string>={pending:"Nova",contacted:"Contatada",awaiting_payment:"Aguardando pagamento",paid:"Paga",approved:"Aprovada",rejected:"Recusada",cancelled:"Cancelada",pilot:"Piloto",active:"Ativa",onboarding:"Implantação",trial:"Teste",overdue:"Em atraso",suspended:"Suspensa"};

export default function Administracao(){
 const [supabase]=useState(()=>createClient());const router=useRouter();
 const [email,setEmail]=useState("");const [applications,setApplications]=useState<Application[]>([]);const [subscriptions,setSubscriptions]=useState<Subscription[]>([]);const [ready,setReady]=useState(false);const [message,setMessage]=useState("");
 const load=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/login");return}setEmail(user.email||"");
  const {data:profile}=await supabase.from("profiles").select("platform_admin").eq("id",user.id).single();if(!profile?.platform_admin){router.replace("/dashboard");return}
  const [{data:a},{data:s}]=await Promise.all([
   supabase.from("school_applications").select("id,school_name,contact_name,contact_email,contact_phone,city,state,monthly_price,status,created_at").order("created_at",{ascending:false}),
   supabase.from("school_subscriptions").select("id,monthly_price,status,next_due_date,schools(name)").order("created_at",{ascending:false})
  ]);setApplications((a||[]) as Application[]);setSubscriptions((s||[]) as unknown as Subscription[]);setReady(true);
 },[router,supabase]);
 useEffect(()=>{void load()},[load]);
 async function setStatus(id:string,status:string){const {error}=await supabase.from("school_applications").update({status,updated_at:new Date().toISOString()}).eq("id",id);setMessage(error?"Não foi possível atualizar.":"Situação atualizada.");if(!error)await load()}
 if(!ready)return <main className="loading">Validando acesso administrativo…</main>;
 return <AppShell email={email}><header><div><p className="eyebrow green">IDEALIZANDO BRASIL</p><h1>Administração das escolas</h1><p className="muted">Contratações, assinaturas e implantação em um único lugar.</p></div></header>
  {message&&<div className="feedback admin-feedback">{message}</div>}
  <section className="admin-stats"><article><Inbox/><span>Solicitações</span><strong>{applications.filter(a=>a.status==="pending").length}</strong></article><article><Building2/><span>Escolas cadastradas</span><strong>{subscriptions.length}</strong></article><article><CreditCard/><span>Mensalidade</span><strong>R$ 49,90</strong></article></section>
  <section className="card admin-card"><h2>Solicitações de contratação</h2>{applications.length===0?<div className="empty compact"><Inbox/><h3>Nenhuma solicitação</h3><p>Os cadastros enviados em /contratar aparecerão aqui.</p></div>:<div className="admin-list">{applications.map(item=><article key={item.id}><div><b>{item.school_name}</b><span>{item.city}/{item.state} · {item.contact_name}</span><small>{item.contact_email} · {item.contact_phone}</small></div><div><em>{statusLabels[item.status]||item.status}</em><select value={item.status} onChange={e=>void setStatus(item.id,e.target.value)}><option value="pending">Nova</option><option value="contacted">Contatada</option><option value="awaiting_payment">Aguardando pagamento</option><option value="paid">Paga</option><option value="approved">Aprovada</option><option value="rejected">Recusada</option></select></div></article>)}</div>}</section>
  <section className="card admin-card"><h2>Assinaturas</h2><div className="admin-list">{subscriptions.map(item=><article key={item.id}><div><b>{item.schools?.name||"Escola"}</b><span>{statusLabels[item.status]||item.status}</span></div><strong>{Number(item.monthly_price)===0?"Piloto sem cobrança":`R$ ${Number(item.monthly_price).toFixed(2).replace(".",",")}/mês`}</strong></article>)}</div></section>
 </AppShell>;
}

