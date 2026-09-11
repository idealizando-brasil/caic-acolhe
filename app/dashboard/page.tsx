"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Bell, CalendarDays, ClipboardList, Clock3, FileText, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/app-shell";
import "./dashboard.css";

type School={id:string;name:string};
type Referral={id:string;reason_summary:string;priority:"routine"|"attention"|"urgent";status:string;students:{full_name:string;classes:{name:string}|null}|null};
type Appointment={id:string;starts_at:string;kind:string;status:string;students:{full_name:string}|null;profiles:{full_name:string|null;email:string}|null};
type ReportRequest={id:string;teacher_reports:{submitted_at:string|null}[]|null};
const priorityLabels={routine:"Rotina",attention:"Atenção",urgent:"Urgente"};
const statusLabels:Record<string,string>={received:"Recebido",triage:"Em triagem",awaiting_schedule:"Aguardando agenda",scheduled:"Agendado",in_follow_up:"Em acompanhamento",awaiting_school_action:"Aguardando escola",external_referral:"Encaminhado à rede",reopened:"Reaberto"};
const appointmentDate=new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"short",timeZone:"America/Fortaleza"});
const appointmentTime=new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Fortaleza"});

export default function Dashboard(){
 const [supabase]=useState(()=>createClient()); const router=useRouter();
 const [email,setEmail]=useState(""); const [school,setSchool]=useState<School|null>(null); const [studentsCount,setStudentsCount]=useState(0); const [activeCount,setActiveCount]=useState(0); const [todayCount,setTodayCount]=useState(0); const [urgentCount,setUrgentCount]=useState(0); const [pendingReports,setPendingReports]=useState(0); const [referrals,setReferrals]=useState<Referral[]>([]); const [appointments,setAppointments]=useState<Appointment[]>([]);
 const load=useCallback(async()=>{
  const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/login");return} setEmail(user.email||"");
  const {data:membership}=await supabase.from("school_memberships").select("school_id,schools(id,name)").eq("user_id",user.id).eq("active",true).limit(1).single();
  const raw=membership?.schools as unknown; const current=(Array.isArray(raw)?raw[0]:raw) as School|undefined; if(!current)return; setSchool(current);
  const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
  const [studentResult,referralResult,urgentResult,appointmentResult,requestResult]=await Promise.all([
   supabase.from("students").select("id",{count:"exact",head:true}).eq("school_id",current.id).eq("active",true),
   supabase.from("referrals").select("id,reason_summary,priority,status,students(full_name,classes(name))",{count:"exact"}).eq("school_id",current.id).neq("status","completed").order("created_at",{ascending:false}).limit(5),
   supabase.from("referrals").select("id",{count:"exact",head:true}).eq("school_id",current.id).neq("status","completed").in("priority",["attention","urgent"]),
   supabase.from("appointments").select("id,starts_at,kind,status,students(full_name),profiles!appointments_professional_id_fkey(full_name,email)").eq("school_id",current.id).gte("starts_at",start.toISOString()).order("starts_at").limit(20),
   supabase.from("teacher_requests").select("id,teacher_reports(submitted_at)").eq("school_id",current.id)
  ]);
  setStudentsCount(studentResult.count||0);setActiveCount(referralResult.count||0);setReferrals((referralResult.data||[]) as unknown as Referral[]);setUrgentCount(urgentResult.count||0);
  const allAppointments=(appointmentResult.data||[]) as unknown as Appointment[];setTodayCount(allAppointments.filter(item=>new Date(item.starts_at)<end&&item.status==="scheduled").length);setAppointments(allAppointments.filter(item=>item.status==="scheduled").slice(0,4));
  const reportRequests=(requestResult.data||[]) as unknown as ReportRequest[];setPendingReports(reportRequests.filter(item=>!item.teacher_reports?.[0]?.submitted_at).length);
 },[router,supabase]);
 useEffect(()=>{load()},[load]);
 const notice=useMemo(()=>studentsCount===0?{title:"Turmas configuradas — aguardando os alunos",text:"Envie o PDF das turmas para fazermos a importação automática.",href:"/dashboard/alunos",action:"Ver alunos e turmas"}:{title:"Ambiente institucional em funcionamento",text:`${studentsCount} estudantes cadastrados e disponíveis para acompanhamento.`,href:"/dashboard/encaminhamentos",action:"Novo encaminhamento"},[studentsCount]);
 if(!school)return <main className="loading">Carregando ambiente seguro…</main>;
 return <AppShell email={email}><header><div><p className="eyebrow green">{school.name.toUpperCase()} · 2026</p><h1>Olá, equipe do CAIC</h1><p className="muted">Aqui está o panorama atualizado do acolhimento escolar.</p></div><div className="notification-button"><Bell/>{urgentCount>0&&<span>{urgentCount}</span>}</div></header>
 <section className="notice"><div><b>{notice.title}</b><p>{notice.text}</p></div><Link className="button-link" href={notice.href}>{notice.action} <ArrowUpRight/></Link></section>
 <section className="stats"><article><span>Encaminhamentos ativos</span><strong>{activeCount}</strong><small>{activeCount?"Casos que precisam de acompanhamento":"Nenhum caso em andamento"}</small></article><article><span>Atendimentos hoje</span><strong>{todayCount}</strong><small>{todayCount?"Compromissos previstos para hoje":"Agenda sem compromissos hoje"}</small></article><article><span>Relatórios pendentes</span><strong>{pendingReports}</strong><small>{pendingReports?"Aguardando resposta docente":"Nenhuma solicitação pendente"}</small></article><article className={urgentCount?"priority-stat":""}><span>Casos prioritários</span><strong>{urgentCount}</strong><small>{urgentCount?"Casos de atenção ou urgência":"Sem alertas no momento"}</small></article></section>
 <section className="dashboard-grid"><article className="card dashboard-panel"><div className="section-title"><div><h2>Fila de acolhimento</h2><p className="muted">Encaminhamentos recentes e prioridades</p></div><Link className="button-link" href="/dashboard/encaminhamentos">Ver fila</Link></div>{!referrals.length?<div className="empty"><ClipboardList/><h3>Nenhum encaminhamento ainda</h3><p>Os novos casos aparecerão aqui para triagem.</p></div>:<div className="dashboard-referrals">{referrals.map(item=><Link href="/dashboard/encaminhamentos" key={item.id}><span className={`dashboard-priority ${item.priority}`}>{priorityLabels[item.priority]}</span><div><b>{item.students?.full_name||"Aluno"}</b><small>{item.students?.classes?.name||"Sem turma"} · {statusLabels[item.status]||item.status}</small><p>{item.reason_summary}</p></div><ArrowUpRight/></Link>)}</div>}</article>
 <article className="card dashboard-panel"><div className="section-title"><div><h2>Próximos atendimentos</h2><p className="muted">Agenda da equipe multiprofissional</p></div><CalendarDays/></div>{!appointments.length?<div className="empty compact"><Clock3/><h3>Agenda livre</h3><p>Os próximos atendimentos aparecerão aqui.</p></div>:<div className="dashboard-appointments">{appointments.map(item=><Link href="/dashboard/agenda" key={item.id}><div className="appointment-clock"><b>{appointmentTime.format(new Date(item.starts_at))}</b><small>{appointmentDate.format(new Date(item.starts_at))}</small></div><div><strong>{item.students?.full_name||"Aluno"}</strong><span>{item.kind}</span><small>{item.profiles?.full_name||item.profiles?.email||"Profissional"}</small></div></Link>)}</div>}</article></section>
 <section className="quick-access"><Link href="/dashboard/alunos"><UsersRound/><span><b>Alunos e turmas</b><small>{studentsCount} estudantes cadastrados</small></span></Link><Link href="/dashboard/relatorios"><FileText/><span><b>Relatórios docentes</b><small>{pendingReports} pendentes</small></span></Link><Link href="/dashboard/encaminhamentos"><AlertTriangle/><span><b>Casos prioritários</b><small>{urgentCount} precisam de atenção</small></span></Link></section>
 </AppShell>;
}
