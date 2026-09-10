"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, CalendarDays, Bell, ArrowUpRight, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/app-shell";

export default function Dashboard(){
 const router=useRouter(); const [email,setEmail]=useState(""); const [ready,setReady]=useState(false);
 useEffect(()=>{createClient().auth.getUser().then(({data})=>{if(!data.user){router.replace("/login");return}setEmail(data.user.email||"");setReady(true)})},[router]);
 if(!ready)return <main className="loading">Carregando ambiente seguro…</main>;
 return <AppShell email={email}><header><div><p className="eyebrow green">ESCOLA PILOTO</p><h1>Olá, equipe do CAIC</h1><p className="muted">Aqui está o panorama do acolhimento escolar.</p></div><button className="icon-btn"><Bell/></button></header><section className="notice"><div><b>Ambiente institucional configurado</b><p>Comece cadastrando turmas, profissionais e fluxos de atendimento.</p></div><Link className="button-link" href="/dashboard/configuracoes">Configurar escola <ArrowUpRight/></Link></section><section className="stats"><article><span>Encaminhamentos ativos</span><strong>0</strong><small>Prontos para receber registros</small></article><article><span>Atendimentos hoje</span><strong>0</strong><small>Agenda sem compromissos</small></article><article><span>Relatórios pendentes</span><strong>0</strong><small>Nenhuma solicitação docente</small></article><article><span>Casos prioritários</span><strong>0</strong><small>Sem alertas no momento</small></article></section><section className="grid"><article className="card"><div className="section-title"><div><h2>Fila de acolhimento</h2><p className="muted">Encaminhamentos recentes e prioridades</p></div><button>Novo encaminhamento</button></div><div className="empty"><ClipboardList/><h3>Nenhum encaminhamento ainda</h3><p>Os novos casos aparecerão aqui para triagem.</p></div></article><article className="card"><div className="section-title"><div><h2>Próximos atendimentos</h2><p className="muted">Agenda da equipe multiprofissional</p></div><CalendarDays/></div><div className="empty compact"><Clock3/><h3>Agenda livre</h3><p>Cadastre o primeiro atendimento.</p></div></article></section></AppShell>
}
