"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HeartHandshake, LayoutDashboard, UsersRound, ClipboardList, CalendarDays, FileHeart, GraduationCap, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const menu=[
  ["Visão geral","/dashboard",LayoutDashboard],
  ["Alunos e turmas","/dashboard/alunos",UsersRound],
  ["Encaminhamentos","/dashboard/encaminhamentos",ClipboardList],
  ["Agenda","/dashboard/agenda",CalendarDays],
  ["Atendimentos","/dashboard/atendimentos",FileHeart],
  ["Relatórios docentes","/dashboard/relatorios",GraduationCap],
  ["Configurações","/dashboard/configuracoes",Settings],
] as const;

export default function AppShell({children,email}:{children:React.ReactNode,email:string}){
 const pathname=usePathname(); const router=useRouter();
 async function logout(){await createClient().auth.signOut();router.replace("/login")}
 return <div className="app-shell"><aside><div className="brand"><span className="brand-mark"><HeartHandshake/></span><span>CAIC <b>Acolhe</b></span></div><nav>{menu.map(([label,href,Icon])=><Link className={pathname===href?"active":""} href={href} key={href}><Icon/>{label}</Link>)}</nav><div className="user"><div className="avatar">{email[0]?.toUpperCase()}</div><div><b>Administração</b><small>{email}</small></div><button onClick={logout} title="Sair"><LogOut/></button></div></aside><main className="content">{children}</main></div>
}
