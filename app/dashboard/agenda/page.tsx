"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./agenda.css";

type School = { id: string; name: string };
type Student = { id: string; full_name: string; classes: { name: string } | null };
type Professional = { user_id: string; role: string; profiles: { full_name: string | null; email: string } | null };
type Referral = { id: string; student_id: string; reason_summary: string };
type Appointment = { id: string; student_id: string; referral_id: string | null; professional_id: string; starts_at: string; ends_at: string; kind: string; status: string; location: string | null; students: { full_name: string; classes: { name: string } | null } | null; profiles: { full_name: string | null; email: string } | null };

const roleLabels: Record<string, string> = { matrix_admin: "Administração", school_admin: "Administração", director: "Direção", coordinator: "Coordenação", psychologist: "Psicologia", social_worker: "Serviço Social" };
const statusLabels: Record<string, string> = { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", absent: "Não compareceu" };
const emptyForm = { student_id: "", referral_id: "", professional_id: "", date: "", time: "08:00", duration: "50", kind: "Acolhimento individual", location: "Sala da Equipe Multiprofissional" };
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "America/Fortaleza" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });

export default function Agenda() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<"upcoming" | "all">("upcoming");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setEmail(user.email || "");
    const { data: membership } = await supabase.from("school_memberships").select("school_id,schools(id,name)").eq("user_id", user.id).eq("active", true).limit(1).single();
    const rawSchool = membership?.schools as unknown;
    const current = (Array.isArray(rawSchool) ? rawSchool[0] : rawSchool) as School | undefined;
    if (!current) return;
    setSchool(current);
    const [{ data: studentData }, { data: professionalData }, { data: referralData }, { data: appointmentData }] = await Promise.all([
      supabase.from("students").select("id,full_name,classes(name)").eq("school_id", current.id).eq("active", true).order("full_name"),
      supabase.from("school_memberships").select("user_id,role,profiles(full_name,email)").eq("school_id", current.id).eq("active", true).in("role", ["matrix_admin", "school_admin", "director", "coordinator", "psychologist", "social_worker"]),
      supabase.from("referrals").select("id,student_id,reason_summary").eq("school_id", current.id).neq("status", "completed").order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,student_id,referral_id,professional_id,starts_at,ends_at,kind,status,location,students(full_name,classes(name)),profiles!appointments_professional_id_fkey(full_name,email)").eq("school_id", current.id).order("starts_at")
    ]);
    setStudents((studentData || []) as unknown as Student[]);
    setProfessionals((professionalData || []) as unknown as Professional[]);
    setReferrals((referralData || []) as Referral[]);
    setAppointments((appointmentData || []) as unknown as Appointment[]);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  const visibleAppointments = useMemo(() => {
    if (view === "all") return appointments;
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    return appointments.filter(item => new Date(item.starts_at) >= startOfToday && item.status === "scheduled");
  }, [appointments, view]);
  const todayCount = appointments.filter(item => new Date(item.starts_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) === new Date().toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }) && item.status === "scheduled").length;

  function closeForm() { setForm(emptyForm); setEditingId(null); setShowForm(false); }
  function editAppointment(item: Appointment) {
    const start = new Date(item.starts_at); const end = new Date(item.ends_at);
    const localParts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Fortaleza" }).formatToParts(start);
    const part = (type: string) => localParts.find(row => row.type === type)?.value || "";
    setForm({ student_id: item.student_id, referral_id: item.referral_id || "", professional_id: item.professional_id, date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}`, duration: String(Math.round((end.getTime() - start.getTime()) / 60000)), kind: item.kind, location: item.location || "" });
    setEditingId(item.id); setShowForm(true); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAppointment(event: FormEvent) {
    event.preventDefault();
    if (!school || !form.student_id || !form.professional_id || !form.date || !form.time) return;
    setBusy(true); setMessage("");
    const start = new Date(`${form.date}T${form.time}:00`); const end = new Date(start.getTime() + Number(form.duration) * 60000);
    const conflictQuery = supabase.from("appointments").select("id").eq("school_id", school.id).eq("professional_id", form.professional_id).eq("status", "scheduled").lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString());
    const { data: conflicts } = editingId ? await conflictQuery.neq("id", editingId) : await conflictQuery;
    if (conflicts?.length) { setMessage("Este profissional já possui atendimento nesse horário."); setBusy(false); return; }
    const values = { school_id: school.id, student_id: form.student_id, referral_id: form.referral_id || null, professional_id: form.professional_id, starts_at: start.toISOString(), ends_at: end.toISOString(), kind: form.kind.trim(), status: "scheduled", location: form.location.trim() || null };
    const { error } = editingId ? await supabase.from("appointments").update(values).eq("id", editingId).eq("school_id", school.id) : await supabase.from("appointments").insert(values);
    if (error) setMessage("Não foi possível salvar o atendimento. Confira os dados.");
    else { setMessage(editingId ? "Agendamento atualizado." : "Atendimento agendado com sucesso."); closeForm(); await load(); }
    setBusy(false);
  }

  async function setStatus(item: Appointment, status: string) {
    if (!school) return; setBusy(true); setMessage("");
    const { error } = await supabase.from("appointments").update({ status }).eq("id", item.id).eq("school_id", school.id);
    setMessage(error ? "Não foi possível atualizar o atendimento." : `Atendimento marcado como ${statusLabels[status].toLowerCase()}.`);
    if (!error) await load(); setBusy(false);
  }
  async function removeAppointment(item: Appointment) {
    if (!school || !confirm(`Excluir o agendamento de ${item.students?.full_name || "este aluno"}?`)) return;
    setBusy(true); const { error } = await supabase.from("appointments").delete().eq("id", item.id).eq("school_id", school.id);
    setMessage(error ? "Não foi possível excluir o agendamento." : "Agendamento excluído."); if (!error) await load(); setBusy(false);
  }

  if (!school) return <main className="loading">Carregando agenda…</main>;
  const canSchedule = students.length > 0 && professionals.length > 0;

  return <AppShell email={email}>
    <header className="agenda-header"><div><p className="eyebrow green">EQUIPE MULTIPROFISSIONAL</p><h1>Agenda</h1><p className="muted">Organize os acolhimentos e atendimentos da equipe.</p></div><button className="primary-button" disabled={!canSchedule} onClick={() => { closeForm(); setShowForm(true); }}><Plus /> Agendar atendimento</button></header>
    {!students.length && <div className="agenda-warning"><UserRound /><div><b>A agenda será liberada após o cadastro dos alunos.</b><p>O senhor poderá enviar o PDF das turmas para a importação automática.</p></div><Link href="/dashboard/alunos">Alunos e turmas</Link></div>}
    {message && <div className="feedback" role="status">{message}</div>}
    {showForm && <form className="card appointment-form" onSubmit={saveAppointment}><div className="form-heading"><div><h2>{editingId ? "Editar agendamento" : "Agendar atendimento"}</h2><p className="muted">Defina quem será atendido, quando e por qual profissional.</p></div><button type="button" className="close-button" onClick={closeForm}><X /></button></div><div className="appointment-form-grid">
      <label>Aluno<select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value, referral_id: "" })} required><option value="">Selecione o aluno</option>{students.map(student => <option value={student.id} key={student.id}>{student.full_name}{student.classes?.name ? ` — ${student.classes.name}` : ""}</option>)}</select></label>
      <label>Profissional<select value={form.professional_id} onChange={e => setForm({ ...form, professional_id: e.target.value })} required><option value="">Selecione o profissional</option>{professionals.map(person => <option value={person.user_id} key={person.user_id}>{person.profiles?.full_name || person.profiles?.email} — {roleLabels[person.role]}</option>)}</select></label>
      <label>Encaminhamento relacionado<select value={form.referral_id} onChange={e => setForm({ ...form, referral_id: e.target.value })}><option value="">Sem vínculo</option>{referrals.filter(item => item.student_id === form.student_id).map(item => <option value={item.id} key={item.id}>{item.reason_summary.slice(0, 70)}</option>)}</select></label>
      <label>Data<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></label><label>Horário<input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required /></label><label>Duração<select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}><option value="30">30 minutos</option><option value="50">50 minutos</option><option value="60">1 hora</option><option value="90">1h30</option></select></label>
      <label>Tipo de atendimento<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option>Acolhimento individual</option><option>Atendimento com a família</option><option>Reunião com professor</option><option>Acompanhamento em sala</option><option>Discussão de caso</option><option>Contato com a rede de proteção</option></select></label><label className="wide-field">Local<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
    </div><div className="appointment-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button disabled={busy}>{busy ? "Salvando…" : "Salvar agendamento"}</button></div></form>}

    <section className="agenda-stats"><article><CalendarDays /><div><strong>{todayCount}</strong><span>atendimentos hoje</span></div></article><article><Clock3 /><div><strong>{appointments.filter(item => item.status === "scheduled").length}</strong><span>agendamentos ativos</span></div></article></section>
    <section className="card agenda-card"><div className="agenda-toolbar"><div><h2>Compromissos</h2><p className="muted">Agenda da equipe multiprofissional</p></div><div className="view-toggle"><button className={view === "upcoming" ? "selected" : ""} onClick={() => setView("upcoming")}>Próximos</button><button className={view === "all" ? "selected" : ""} onClick={() => setView("all")}>Todos</button></div></div>
      {!visibleAppointments.length ? <div className="empty"><CalendarDays /><h3>Agenda livre</h3><p>Os próximos atendimentos aparecerão aqui.</p></div> : <div className="appointment-list">{visibleAppointments.map(item => <article className={`appointment-item status-${item.status}`} key={item.id}><div className="appointment-date"><b>{dateFormatter.format(new Date(item.starts_at))}</b><strong>{timeFormatter.format(new Date(item.starts_at))}</strong><span>até {timeFormatter.format(new Date(item.ends_at))}</span></div><div className="appointment-info"><div><span className="status-pill">{statusLabels[item.status] || item.status}</span><h3>{item.students?.full_name || "Aluno"}</h3><small>{item.students?.classes?.name || "Sem turma"}</small></div><p>{item.kind}{item.location ? ` · ${item.location}` : ""}</p><span>Profissional: {item.profiles?.full_name || item.profiles?.email || "não definido"}</span></div><div className="appointment-actions">{item.status === "scheduled" && <button className="complete" disabled={busy} onClick={() => setStatus(item, "completed")}><CheckCircle2 /> Concluir</button>}<button onClick={() => editAppointment(item)} title="Editar"><Pencil /></button><button className="delete" onClick={() => removeAppointment(item)} title="Excluir"><Trash2 /></button></div></article>)}</div>}
    </section>
  </AppShell>;
}
