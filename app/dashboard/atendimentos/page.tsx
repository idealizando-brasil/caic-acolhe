"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileHeart, LockKeyhole, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./attendances.css";

type NoteType = "shared" | "confidential_psychology" | "confidential_social";
type School = { id: string; name: string };
type Student = { id: string; full_name: string; classes: { name: string } | null };
type Referral = { id: string; student_id: string; reason_summary: string };
type Appointment = { id: string; student_id: string; starts_at: string; kind: string; status: string };
type Note = { id: string; student_id: string; referral_id: string | null; author_id: string; note_type: NoteType; content: string; created_at: string; updated_at: string; students: { full_name: string; classes: { name: string } | null } | null; profiles: { full_name: string | null; email: string } | null; referrals: { reason_summary: string } | null };

const typeLabels: Record<NoteType, string> = { shared: "Registro compartilhado", confidential_psychology: "Sigiloso — Psicologia", confidential_social: "Sigiloso — Serviço Social" };
const emptyForm = { student_id: "", referral_id: "", appointment_id: "", note_type: "shared" as NoteType, content: "", finishAppointment: true };
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });

export default function Atendimentos() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setEmail(user.email || ""); setUserId(user.id);
    const { data: membership } = await supabase.from("school_memberships").select("school_id,role,schools(id,name)").eq("user_id", user.id).eq("active", true).limit(1).single();
    const rawSchool = membership?.schools as unknown;
    const current = (Array.isArray(rawSchool) ? rawSchool[0] : rawSchool) as School | undefined;
    if (!current) return;
    setSchool(current); setRole(membership?.role || "");
    const [{ data: studentData }, { data: referralData }, { data: appointmentData }, { data: noteData }] = await Promise.all([
      supabase.from("students").select("id,full_name,classes(name)").eq("school_id", current.id).eq("active", true).order("full_name"),
      supabase.from("referrals").select("id,student_id,reason_summary").eq("school_id", current.id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,student_id,starts_at,kind,status").eq("school_id", current.id).eq("status", "scheduled").order("starts_at", { ascending: false }),
      supabase.from("case_notes").select("id,student_id,referral_id,author_id,note_type,content,created_at,updated_at,students(full_name,classes(name)),profiles!case_notes_author_id_fkey(full_name,email),referrals(reason_summary)").eq("school_id", current.id).order("created_at", { ascending: false })
    ]);
    setStudents((studentData || []) as unknown as Student[]); setReferrals((referralData || []) as Referral[]); setAppointments((appointmentData || []) as Appointment[]); setNotes((noteData || []) as unknown as Note[]);
  }, [router, supabase]);
  useEffect(() => { load(); }, [load]);

  const allowedTypes: NoteType[] = role === "psychologist" ? ["shared", "confidential_psychology"] : role === "social_worker" ? ["shared", "confidential_social"] : ["shared"];
  const filtered = useMemo(() => { const term = search.trim().toLocaleLowerCase("pt-BR"); return notes.filter(note => (!studentFilter || note.student_id === studentFilter) && (!term || `${note.students?.full_name || ""} ${note.content}`.toLocaleLowerCase("pt-BR").includes(term))); }, [notes, search, studentFilter]);

  function closeForm() { setForm(emptyForm); setEditingId(null); setShowForm(false); }
  function editNote(note: Note) { setForm({ student_id: note.student_id, referral_id: note.referral_id || "", appointment_id: "", note_type: note.note_type, content: note.content, finishAppointment: false }); setEditingId(note.id); setShowForm(true); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function saveNote(event: FormEvent) {
    event.preventDefault(); if (!school || !userId || !form.student_id || !form.content.trim() || !allowedTypes.includes(form.note_type)) return;
    setBusy(true); setMessage("");
    const values = { school_id: school.id, student_id: form.student_id, referral_id: form.referral_id || null, author_id: userId, note_type: form.note_type, content: form.content.trim(), updated_at: new Date().toISOString() };
    const { error } = editingId ? await supabase.from("case_notes").update(values).eq("id", editingId).eq("author_id", userId) : await supabase.from("case_notes").insert(values);
    if (error) setMessage("Não foi possível salvar o registro. Verifique sua permissão e tente novamente.");
    else { if (!editingId && form.appointment_id && form.finishAppointment) await supabase.from("appointments").update({ status: "completed" }).eq("id", form.appointment_id); setMessage(editingId ? "Registro atualizado." : "Atendimento registrado com sucesso."); closeForm(); await load(); }
    setBusy(false);
  }

  if (!school) return <main className="loading">Carregando atendimentos…</main>;
  return <AppShell email={email}>
    <header className="attendance-header"><div><p className="eyebrow green">HISTÓRICO DE ACOLHIMENTO</p><h1>Atendimentos</h1><p className="muted">Registre as ações realizadas e acompanhe a evolução dos estudantes.</p></div><button className="primary-button" disabled={!students.length} onClick={() => { closeForm(); setShowForm(true); }}><Plus /> Registrar atendimento</button></header>
    {!students.length && <div className="attendance-warning"><UserRound /><div><b>Os atendimentos serão liberados após o cadastro dos alunos.</b><p>Depois da importação do PDF, o histórico poderá ser iniciado.</p></div><Link href="/dashboard/alunos">Alunos e turmas</Link></div>}
    {message && <div className="feedback" role="status">{message}</div>}
    {showForm && <form className="card attendance-form" onSubmit={saveNote}><div className="form-heading"><div><h2>{editingId ? "Editar registro" : "Registrar atendimento"}</h2><p className="muted">Registre informações objetivas, necessárias e relacionadas ao acompanhamento.</p></div><button type="button" className="close-button" onClick={closeForm}><X /></button></div><div className="attendance-form-grid">
      <label>Aluno<select value={form.student_id} disabled={Boolean(editingId)} onChange={e => setForm({ ...form, student_id: e.target.value, referral_id: "", appointment_id: "" })} required><option value="">Selecione o aluno</option>{students.map(student => <option value={student.id} key={student.id}>{student.full_name}{student.classes?.name ? ` — ${student.classes.name}` : ""}</option>)}</select></label>
      <label>Encaminhamento relacionado<select value={form.referral_id} onChange={e => setForm({ ...form, referral_id: e.target.value })}><option value="">Sem vínculo</option>{referrals.filter(item => item.student_id === form.student_id).map(item => <option value={item.id} key={item.id}>{item.reason_summary.slice(0, 80)}</option>)}</select></label>
      {!editingId && <label>Agendamento relacionado<select value={form.appointment_id} onChange={e => setForm({ ...form, appointment_id: e.target.value })}><option value="">Sem agendamento</option>{appointments.filter(item => item.student_id === form.student_id).map(item => <option value={item.id} key={item.id}>{dateTime.format(new Date(item.starts_at))} — {item.kind}</option>)}</select></label>}
      <label>Visibilidade<select value={form.note_type} onChange={e => setForm({ ...form, note_type: e.target.value as NoteType })}>{allowedTypes.map(type => <option value={type} key={type}>{typeLabels[type]}</option>)}</select></label>
      <label className="content-field">Registro do atendimento<textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} required placeholder="Descreva o acolhimento, as orientações realizadas, os encaminhamentos combinados e os próximos passos." /></label>
      {!editingId && form.appointment_id && <label className="check-field"><input type="checkbox" checked={form.finishAppointment} onChange={e => setForm({ ...form, finishAppointment: e.target.checked })} /> Marcar o agendamento como concluído</label>}
    </div><div className="privacy-note"><LockKeyhole /><span>Registros sigilosos só podem ser visualizados pelo profissional da área que os criou.</span></div><div className="attendance-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button disabled={busy}>{busy ? "Salvando…" : "Salvar registro"}</button></div></form>}
    <section className="attendance-summary"><article><FileHeart /><div><strong>{notes.length}</strong><span>registros de atendimento</span></div></article><article><UserRound /><div><strong>{new Set(notes.map(note => note.student_id)).size}</strong><span>estudantes acompanhados</span></div></article></section>
    <section className="card attendance-card"><div className="attendance-toolbar"><div><h2>Histórico de atendimentos</h2><p className="muted">{filtered.length} {filtered.length === 1 ? "registro disponível" : "registros disponíveis"}</p></div><div className="attendance-filters"><label className="search-box"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar no histórico" /></label><select value={studentFilter} onChange={e => setStudentFilter(e.target.value)}><option value="">Todos os alunos</option>{students.map(student => <option value={student.id} key={student.id}>{student.full_name}</option>)}</select></div></div>
      {!filtered.length ? <div className="empty"><FileHeart /><h3>Nenhum atendimento registrado</h3><p>Os registros realizados pela equipe aparecerão aqui.</p></div> : <div className="notes-list">{filtered.map(note => <article className={`note-item ${note.note_type !== "shared" ? "confidential" : ""}`} key={note.id}><div className="note-heading"><div><span className="note-type">{note.note_type !== "shared" && <LockKeyhole />}{typeLabels[note.note_type]}</span><h3>{note.students?.full_name || "Aluno"}</h3><small>{note.students?.classes?.name || "Sem turma"}</small></div>{note.author_id === userId && <button onClick={() => editNote(note)} title="Editar meu registro"><Pencil /></button>}</div><p className="note-content">{note.content}</p>{note.referrals?.reason_summary && <div className="note-referral"><b>Encaminhamento:</b> {note.referrals.reason_summary}</div>}<footer><span>Registrado por {note.profiles?.full_name || note.profiles?.email || "Profissional"}</span><time>{dateTime.format(new Date(note.created_at))}</time></footer></article>)}</div>}
    </section>
  </AppShell>;
}
