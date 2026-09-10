"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./referrals.css";

type School = { id: string; name: string };
type Student = { id: string; full_name: string; classes: { name: string } | null };
type Professional = { user_id: string; role: string; profiles: { full_name: string | null; email: string } | null };
type Priority = "routine" | "attention" | "urgent";
type Status = "received" | "triage" | "awaiting_schedule" | "scheduled" | "in_follow_up" | "awaiting_school_action" | "external_referral" | "completed" | "reopened";
type Referral = {
  id: string; student_id: string; assigned_to: string | null; reason_summary: string; priority: Priority;
  status: Status; school_actions: string | null; due_date: string | null; created_at: string;
  students: { full_name: string; classes: { name: string } | null } | null;
  profiles: { full_name: string | null; email: string } | null;
};

const priorities: [Priority, string][] = [["routine", "Rotina"], ["attention", "Atenção"], ["urgent", "Urgente"]];
const statuses: [Status, string][] = [["received", "Recebido"], ["triage", "Em triagem"], ["awaiting_schedule", "Aguardando agenda"], ["scheduled", "Agendado"], ["in_follow_up", "Em acompanhamento"], ["awaiting_school_action", "Aguardando ação da escola"], ["external_referral", "Encaminhado à rede"], ["completed", "Concluído"], ["reopened", "Reaberto"]];
const emptyForm = { student_id: "", assigned_to: "", reason_summary: "", priority: "routine" as Priority, status: "received" as Status, school_actions: "", due_date: "" };

export default function Encaminhamentos() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setEmail(user.email || ""); setUserId(user.id);
    const { data: membership } = await supabase.from("school_memberships").select("school_id,schools(id,name)").eq("user_id", user.id).eq("active", true).limit(1).single();
    const rawSchool = membership?.schools as unknown;
    const current = (Array.isArray(rawSchool) ? rawSchool[0] : rawSchool) as School | undefined;
    if (!current) return;
    setSchool(current);
    const [{ data: studentData }, { data: professionalData }, { data: referralData }] = await Promise.all([
      supabase.from("students").select("id,full_name,classes(name)").eq("school_id", current.id).eq("active", true).order("full_name"),
      supabase.from("school_memberships").select("user_id,role,profiles(full_name,email)").eq("school_id", current.id).eq("active", true).in("role", ["psychologist", "social_worker", "coordinator", "director"]),
      supabase.from("referrals").select("id,student_id,assigned_to,reason_summary,priority,status,school_actions,due_date,created_at,students(full_name,classes(name)),profiles!referrals_assigned_to_fkey(full_name,email)").eq("school_id", current.id).order("created_at", { ascending: false })
    ]);
    setStudents((studentData || []) as unknown as Student[]);
    setProfessionals((professionalData || []) as unknown as Professional[]);
    setReferrals((referralData || []) as unknown as Referral[]);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return referrals.filter(item => {
      const text = `${item.students?.full_name || ""} ${item.reason_summary}`.toLocaleLowerCase("pt-BR");
      return (!term || text.includes(term)) && (!statusFilter || item.status === statusFilter);
    });
  }, [referrals, search, statusFilter]);

  const activeCount = referrals.filter(item => item.status !== "completed").length;
  const urgentCount = referrals.filter(item => item.priority === "urgent" && item.status !== "completed").length;

  function closeForm() { setForm(emptyForm); setEditingId(null); setShowForm(false); }
  function editReferral(item: Referral) {
    setForm({ student_id: item.student_id, assigned_to: item.assigned_to || "", reason_summary: item.reason_summary, priority: item.priority, status: item.status, school_actions: item.school_actions || "", due_date: item.due_date || "" });
    setEditingId(item.id); setShowForm(true); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveReferral(event: FormEvent) {
    event.preventDefault();
    if (!school || !userId || !form.student_id || !form.reason_summary.trim()) return;
    setBusy(true); setMessage("");
    const values = { school_id: school.id, student_id: form.student_id, assigned_to: form.assigned_to || null, reason_summary: form.reason_summary.trim(), priority: form.priority, status: form.status, school_actions: form.school_actions.trim() || null, due_date: form.due_date || null, updated_at: new Date().toISOString() };
    const { error } = editingId
      ? await supabase.from("referrals").update(values).eq("id", editingId).eq("school_id", school.id)
      : await supabase.from("referrals").insert({ ...values, created_by: userId });
    if (error) setMessage("Não foi possível salvar o encaminhamento. Tente novamente.");
    else { setMessage(editingId ? "Encaminhamento atualizado." : "Encaminhamento registrado com sucesso."); closeForm(); await load(); }
    setBusy(false);
  }

  async function updateStatus(item: Referral, status: Status) {
    if (!school) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("referrals").update({ status, updated_at: new Date().toISOString() }).eq("id", item.id).eq("school_id", school.id);
    setMessage(error ? "Não foi possível atualizar o andamento." : "Andamento atualizado.");
    if (!error) await load(); setBusy(false);
  }

  async function removeReferral(item: Referral) {
    if (!school || !confirm(`Excluir o encaminhamento de ${item.students?.full_name || "este aluno"}?`)) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.from("referrals").delete().eq("id", item.id).eq("school_id", school.id);
    setMessage(error ? "Não foi possível excluir. O caso pode possuir atendimentos vinculados." : "Encaminhamento excluído.");
    if (!error) await load(); setBusy(false);
  }

  if (!school) return <main className="loading">Carregando encaminhamentos…</main>;

  return <AppShell email={email}>
    <header className="referrals-header"><div><p className="eyebrow green">ACOLHIMENTO ESCOLAR</p><h1>Encaminhamentos</h1><p className="muted">Registre as demandas e acompanhe cada caso até a conclusão.</p></div><button className="primary-button" disabled={!students.length} onClick={() => { closeForm(); setShowForm(true); }}><Plus /> Novo encaminhamento</button></header>
    {!students.length && <div className="no-students"><AlertTriangle /><div><b>Cadastre os alunos antes de criar um encaminhamento.</b><p>Quando o PDF das turmas for enviado, os alunos poderão ser importados automaticamente.</p></div><Link href="/dashboard/alunos">Ir para Alunos e turmas</Link></div>}
    {message && <div className="feedback" role="status">{message}</div>}

    {showForm && <form className="card referral-form" onSubmit={saveReferral}>
      <div className="form-heading"><div><h2>{editingId ? "Editar encaminhamento" : "Novo encaminhamento"}</h2><p className="muted">Registre apenas informações necessárias ao acolhimento.</p></div><button type="button" className="close-button" onClick={closeForm}><X /></button></div>
      <div className="referral-form-grid">
        <label>Aluno<select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required disabled={Boolean(editingId)}><option value="">Selecione o aluno</option>{students.map(student => <option value={student.id} key={student.id}>{student.full_name}{student.classes?.name ? ` — ${student.classes.name}` : ""}</option>)}</select></label>
        <label>Prioridade<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>{priorities.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Andamento<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Responsável pelo acompanhamento<select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}><option value="">Ainda não definido</option>{professionals.map(person => <option value={person.user_id} key={person.user_id}>{person.profiles?.full_name || person.profiles?.email || "Profissional"}</option>)}</select></label>
        <label>Prazo para retorno<input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></label>
        <label className="full-field">Motivo do encaminhamento<textarea value={form.reason_summary} onChange={e => setForm({ ...form, reason_summary: e.target.value })} rows={4} required placeholder="Descreva objetivamente a situação observada e a necessidade de acolhimento." /></label>
        <label className="full-field">Ações já realizadas pela escola<textarea value={form.school_actions} onChange={e => setForm({ ...form, school_actions: e.target.value })} rows={3} placeholder="Ex.: conversa com a família, acolhimento em sala, contato com a coordenação." /></label>
      </div>
      <div className="referral-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button disabled={busy}>{busy ? "Salvando…" : "Salvar encaminhamento"}</button></div>
    </form>}

    <section className="referral-stats"><article><ClipboardList /><div><strong>{activeCount}</strong><span>casos em andamento</span></div></article><article className={urgentCount ? "urgent" : ""}><AlertTriangle /><div><strong>{urgentCount}</strong><span>casos urgentes</span></div></article></section>

    <section className="card referrals-card">
      <div className="referrals-toolbar"><div><h2>Fila de acolhimento</h2><p className="muted">{filtered.length} {filtered.length === 1 ? "encaminhamento" : "encaminhamentos"}</p></div><div className="referral-filters"><label className="search-box"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno ou motivo" /></label><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Todos os andamentos</option>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></div>
      {!filtered.length ? <div className="empty"><ClipboardList /><h3>{referrals.length ? "Nenhum caso encontrado" : "Nenhum encaminhamento ainda"}</h3><p>{referrals.length ? "Altere a pesquisa ou o filtro." : "Os novos casos aparecerão aqui para triagem."}</p></div> : <div className="referral-list">{filtered.map(item => <article key={item.id} className={`referral-item priority-${item.priority}`}><div className="referral-main"><div className="referral-title"><span className={`priority-label ${item.priority}`}>{priorities.find(row => row[0] === item.priority)?.[1]}</span><h3>{item.students?.full_name || "Aluno"}</h3><small>{item.students?.classes?.name || "Sem turma"}</small></div><p>{item.reason_summary}</p>{item.school_actions && <div className="school-actions"><b>Ações da escola:</b> {item.school_actions}</div>}<div className="referral-meta"><span>Responsável: {item.profiles?.full_name || item.profiles?.email || "não definido"}</span><span>Prazo: {item.due_date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${item.due_date}T12:00:00Z`)) : "não definido"}</span></div></div><div className="referral-controls"><select aria-label="Atualizar andamento" value={item.status} disabled={busy} onChange={e => updateStatus(item, e.target.value as Status)}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><div><button onClick={() => editReferral(item)} title="Editar"><Pencil /></button><button className="delete" onClick={() => removeReferral(item)} title="Excluir"><Trash2 /></button></div></div></article>)}</div>}
    </section>
  </AppShell>;
}
