"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, GraduationCap, Pencil, UserPlus, Trash2, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./settings.css";

type School={id:string;name:string;city:string|null;state:string|null};
type ClassRow={id:string;name:string;school_year:number};
type Member={id:string;user_id:string;role:string;profiles:{full_name:string|null;email:string}|null};
const roles=[["director","Direção"],["coordinator","Coordenação"],["psychologist","Psicologia"],["social_worker","Serviço Social"],["teacher","Professor(a)"],["school_admin","Administrador(a)"]] as const;

export default function Configuracoes(){
 const [supabase]=useState(()=>createClient());
 const router=useRouter();
 const [email,setEmail]=useState("");
 const [school,setSchool]=useState<School|null>(null);
 const [classes,setClasses]=useState<ClassRow[]>([]);
 const [members,setMembers]=useState<Member[]>([]);
 const [tab,setTab]=useState<"escola"|"turmas"|"equipe">("escola");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [platformAdmin,setPlatformAdmin]=useState(false);
 const [editing,setEditing]=useState<Member|null>(null);
 const [className,setClassName]=useState("");
 const [year,setYear]=useState(2026);
 const [inviteEmail,setInviteEmail]=useState("");
 const [fullName,setFullName]=useState("");
 const [role,setRole]=useState("teacher");

 const load=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){router.replace("/login");return}
  setEmail(user.email||"");
  const [{data:membership},{data:profile}]=await Promise.all([
   supabase.from("school_memberships").select("school_id,schools(id,name,city,state)").eq("user_id",user.id).limit(1).single(),
   supabase.from("profiles").select("platform_admin").eq("id",user.id).single()
  ]);
  setPlatformAdmin(Boolean(profile?.platform_admin));
  const raw=membership?.schools as unknown;
  const current=(Array.isArray(raw)?raw[0]:raw) as School|undefined;
  if(!current)return;
  setSchool(current);
  const [{data:c},{data:m}]=await Promise.all([
   supabase.from("classes").select("id,name,school_year").eq("school_id",current.id).order("name"),
   supabase.from("school_memberships").select("id,user_id,role,profiles(full_name,email)").eq("school_id",current.id).order("role")
  ]);
  setClasses((c||[]) as ClassRow[]);
  setMembers((m||[]) as unknown as Member[]);
 },[router,supabase]);
 useEffect(()=>{void load()},[load]);

 async function saveSchool(e:FormEvent){
  e.preventDefault();if(!school)return;setBusy(true);setMessage("");
  const {error}=await supabase.from("schools").update({name:school.name,city:school.city,state:school.state}).eq("id",school.id);
  setMessage(error?"Não foi possível salvar.":"Dados da escola salvos.");setBusy(false);
 }
 async function addClass(e:FormEvent){
  e.preventDefault();if(!school||!className.trim())return;setBusy(true);
  const {error}=await supabase.from("classes").insert({school_id:school.id,name:className.trim(),school_year:year});
  setMessage(error?error.message:"Turma cadastrada.");
  if(!error){setClassName("");await load()}setBusy(false);
 }
 async function removeClass(id:string){
  if(!confirm("Remover esta turma?"))return;
  const {error}=await supabase.from("classes").delete().eq("id",id);
  setMessage(error?"A turma possui vínculos e não pode ser removida.":"Turma removida.");
  if(!error)await load();
 }
 async function invite(e:FormEvent){
  e.preventDefault();if(!school)return;setBusy(true);setMessage("");
  const {error}=await supabase.functions.invoke("invite-user",{body:{email:inviteEmail,full_name:fullName,role,school_id:school.id}});
  setMessage(error?"Não foi possível convidar. Verifique se o e-mail já está cadastrado.":"Convite enviado e profissional adicionado.");
  if(!error){setInviteEmail("");setFullName("");await load()}setBusy(false);
 }
 async function updateMember(e:FormEvent){
  e.preventDefault();if(!school||!editing?.profiles)return;setBusy(true);setMessage("");
  const {error}=await supabase.functions.invoke("manage-user",{body:{action:"update",membership_id:editing.id,school_id:school.id,full_name:editing.profiles.full_name,email:editing.profiles.email,role:editing.role}});
  setMessage(error?"Não foi possível atualizar o usuário.":"Usuário atualizado com sucesso.");
  if(!error){setEditing(null);await load()}setBusy(false);
 }
 async function deleteMember(member:Member){
  if(!school||!confirm(`Excluir completamente o acesso de ${member.profiles?.full_name||member.profiles?.email||"este usuário"}?`))return;
  setBusy(true);setMessage("");
  const {error}=await supabase.functions.invoke("manage-user",{body:{action:"delete",membership_id:member.id,school_id:school.id}});
  setMessage(error?"Não foi possível excluir o usuário.":"Usuário excluído com sucesso.");
  if(!error)await load();setBusy(false);
 }

 if(!school)return <main className="loading">Carregando configurações…</main>;
 return <AppShell email={email}>
  <header><div><p className="eyebrow green">CONFIGURAÇÃO INICIAL</p><h1>Organização da escola</h1><p className="muted">Cadastre a estrutura e a equipe que utilizará a plataforma.</p></div></header>
  <div className="tabs">
   <button className={tab==="escola"?"selected":""} onClick={()=>setTab("escola")}><Building2/> Escola</button>
   <button className={tab==="turmas"?"selected":""} onClick={()=>setTab("turmas")}><GraduationCap/> Turmas</button>
   <button className={tab==="equipe"?"selected":""} onClick={()=>setTab("equipe")}><UserPlus/> Equipe</button>
  </div>
  {message&&<div className="feedback">{message}</div>}
  {tab==="escola"&&<form className="card settings-card" onSubmit={saveSchool}>
   <h2>Dados da escola</h2><p className="muted">Informações exibidas no ambiente institucional.</p>
   <div className="form-grid"><label>Nome da escola<input value={school.name} onChange={e=>setSchool({...school,name:e.target.value})} required/></label><label>Cidade<input value={school.city||""} onChange={e=>setSchool({...school,city:e.target.value})}/></label><label>Estado<input maxLength={2} value={school.state||""} onChange={e=>setSchool({...school,state:e.target.value.toUpperCase()})} placeholder="CE"/></label></div>
   <div className="form-actions"><button disabled={busy}>{busy?"Salvando…":"Salvar alterações"}</button></div>
  </form>}
  {tab==="turmas"&&<div className="settings-stack">
   <form className="card settings-card" onSubmit={addClass}><h2>Cadastrar turma</h2><div className="form-grid two"><label>Identificação da turma<input value={className} onChange={e=>setClassName(e.target.value)} placeholder="Ex.: 1º Ano A" required/></label><label>Ano letivo<input type="number" value={year} onChange={e=>setYear(Number(e.target.value))} min="2026" max="2100" required/></label></div><div className="form-actions"><button disabled={busy}>Adicionar turma</button></div></form>
   <section className="card settings-card"><h2>Turmas cadastradas</h2>{classes.length===0?<div className="empty compact"><GraduationCap/><h3>Nenhuma turma cadastrada</h3></div>:<div className="data-list">{classes.map(c=><div key={c.id}><span><b>{c.name}</b><small>Ano letivo {c.school_year}</small></span><button className="danger-icon" onClick={()=>removeClass(c.id)} title="Remover"><Trash2/></button></div>)}</div>}</section>
  </div>}
  {tab==="equipe"&&<div className="settings-stack">
   <form className="card settings-card" onSubmit={invite}><h2>Convidar profissional</h2><p className="muted">A pessoa receberá um convite para criar o acesso.</p><div className="form-grid"><label>Nome completo<input value={fullName} onChange={e=>setFullName(e.target.value)} required/></label><label>E-mail<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} required/></label><label>Função<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label></div><div className="form-actions"><button disabled={busy}>Enviar convite</button></div></form>
   {editing?.profiles&&<form className="card settings-card" onSubmit={updateMember}>
    <div className="settings-title"><div><h2>Editar usuário</h2><p className="muted">Atualize os dados e a função deste profissional.</p></div><button type="button" className="icon-button" onClick={()=>setEditing(null)}><X/></button></div>
    <div className="form-grid"><label>Nome completo<input value={editing.profiles.full_name||""} onChange={e=>setEditing({...editing,profiles:{...editing.profiles!,full_name:e.target.value}})} required/></label><label>E-mail<input type="email" value={editing.profiles.email} onChange={e=>setEditing({...editing,profiles:{...editing.profiles!,email:e.target.value}})} required/></label><label>Função<select value={editing.role} onChange={e=>setEditing({...editing,role:e.target.value})}>{roles.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label></div>
    <div className="form-actions"><button disabled={busy}>Salvar usuário</button></div>
   </form>}
   <section className="card settings-card"><h2>Equipe cadastrada</h2><p className="muted">{platformAdmin?"O administrador central pode editar ou excluir acessos.":"Consulte o administrador central para alterar acessos."}</p><div className="data-list">{members.map(m=><div key={m.id}><span><b>{m.profiles?.full_name||"Usuário"}</b><small>{m.profiles?.email}</small></span><span className="member-actions"><em>{roles.find(r=>r[0]===m.role)?.[1]||"Administrador da matriz"}</em>{platformAdmin&&<><button className="icon-button" onClick={()=>setEditing(m)} title="Editar usuário"><Pencil/></button><button className="danger-icon" onClick={()=>deleteMember(m)} title="Excluir usuário"><Trash2/></button></>}</span></div>)}</div></section>
  </div>}
 </AppShell>;
}
