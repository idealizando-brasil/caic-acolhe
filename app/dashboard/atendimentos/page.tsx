"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileHeart, LockKeyhole, Plus, Search, UserRound, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./attendances.css";

type School = { id: string; name: string };
type Student = { id: string; full_name: string; classes: { name: string } | null };
type Referral = { id: string; student_id: string; reason_summary: string };
type Appointment = { id: string; student_id: string; starts_at: string; kind: string; status: string };
type Attendance = { id: string; student_id: string; referral_id: string | null; author_id: string; guidance_referrals: string; created_at: string; students: { full_name: string; classes: { name: string } | null } | null; profiles: { full_name: string | null; email: string } | null; referrals: { reason_summary: string } | null };
type PrivateDemand = { attendance_id: string; author_id: string; demand: string };

const allowedRoles = ["director", "coordinator", "psychologist", "social_worker"];
const emptyForm = { student_id: "", referral_id: "", appointment_id: "", demand: "", guidance_referrals: "", finishAppointment: true };
const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
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
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [privateDemands, setPrivateDemands] = useState<Record<string,string>>({});
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("");
  const [search, setSearch] = useState("");
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
    const currentRole = membership?.role || "";
    setSchool(current); setRole(currentRole);
    if (!allowedRoles.includes(currentRole)) return;
    const [{ data: studentData }, { data: referralData }, { data: appointmentData }, { data: attendanceData }, { data: demandData }] = await Promise.all([
      supabase.from("students").select("id,full_name,classes(name)").eq("school_id", current.id).eq("active", true).order("full_name"),
      supabase.from("referrals").select("id,student_id,reason_summary").eq("school_id", current.id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,student_id,starts_at,kind,status").eq("school_id", current.id).eq("status", "scheduled").order("starts_at", { ascending: false }),
      supabase.from("attendances").select("id,student_id,referral_id,author_id,guidance_referrals,created_at,students(full_name,classes(name)),profiles!attendances_author_id_fkey(full_name,email),referrals(reason_summary)").eq("school_id", current.id).order("created_at", { ascending: false }),
      supabase.from("attendance_private_demands").select("attendance_id,author_id,demand").eq("school_id", current.id)
    ]);
    setStudents((studentData || []) as unknown as Student[]);
    setReferrals((referralData || []) as Referral[]);
    setAppointments((appointmentData || []) as Appointment[]);
    setAttendances((attendanceData || []) as unknown as Attendance[]);
    setPrivateDemands(Object.fromEntries(((demandData || []) as PrivateDemand[]).map(item => [item.attendance_id, item.demand])));
  }, [router, supabase]);
  useEffect(() => { load(); }, [load]);

  const studentClasses = useMemo(() => Array.from(new Set(students.map(student => student.classes?.name).filter((name): name is string => Boolean(name)))).sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true})), [students]);
  const selectedStudent = useMemo(() => students.find(student => student.id === form.student_id) || null, [form.student_id, students]);
  const studentResults = useMemo(() => {
    const term = normalizeText(studentSearch.trim());
    if (!term && !studentClassFilter) return [];
    return students.filter(student => (!term || normalizeText(student.full_name).includes(term)) && (!studentClassFilter || student.classes?.name === studentClassFilter)).slice(0,30);
  }, [studentClassFilter, studentSearch, students]);
  const filtered = useMemo(() => {
    const term = normalizeText(search.trim());
    return attendances.filter(item => !term || normalizeText(`${item.students?.full_name || ""} ${item.guidance_referrals}`).includes(term));
  }, [attendances, search]);

  function closeForm() { setForm(emptyForm); setShowForm(false); setStudentSearch(""); setStudentClassFilter(""); }

  const isMultiprofessional = role === "psychologist" || role === "social_worker";

  async function saveAttendance(event: FormEvent) {
    event.preventDefault();
    if (!school || !userId || !allowedRoles.includes(role) || !form.student_id || !form.guidance_referrals.trim() || (isMultiprofessional && !form.demand.trim())) return;
    setBusy(true); setMessage("");
    const { data: attendance, error: attendanceError } = await supabase.from("attendances").insert({
      school_id: school.id, student_id: form.student_id, referral_id: form.referral_id || null,
      appointment_id: form.appointment_id || null, author_id: userId, guidance_referrals: form.guidance_referrals.trim()
    }).select("id").single();
    if (attendanceError || !attendance) {
      setMessage("Não foi possível salvar o atendimento. Verifique sua permissão e tente novamente."); setBusy(false); return;
    }
    if (isMultiprofessional) {
      const { error: demandError } = await supabase.from("attendance_private_demands").insert({
        attendance_id: attendance.id, school_id: school.id, author_id: userId, demand: form.demand.trim()
      });
      if (demandError) {
        await supabase.from("attendances").delete().eq("id", attendance.id).eq("author_id", userId);
        setMessage("O atendimento não foi salvo porque o registro sigiloso não pôde ser protegido. Tente novamente."); setBusy(false); return;
      }
    }
    if (form.appointment_id && form.finishAppointment) await supabase.from("appointments").update({ status: "completed" }).eq("id", form.appointment_id);
    setMessage("Atendimento registrado com sucesso."); closeForm(); await load(); setBusy(false);
  }

  if (!school) return <main className="loading">Carregando atendimentos…</main>;
  if (!allowedRoles.includes(role)) return <AppShell email={email}><section className="card empty"><LockKeyhole /><h2>Acesso restrito</h2><p>Atendimentos são exclusivos da Direção, Coordenação Pedagógica, Psicologia e Assistência Social.</p></section></AppShell>;

  return <AppShell email={email}>
    <header className="attendance-header"><div><p className="eyebrow green">HISTÓRICO DE ACOLHIMENTO</p><h1>Atendimentos</h1><p className="muted">Escuta protegida e continuidade compartilhada entre a equipe autorizada.</p></div><button className="primary-button" disabled={!students.length} onClick={() => { closeForm(); setShowForm(true); }}><Plus /> Registrar atendimento</button></header>
    {message && <div className="feedback" role="status">{message}</div>}
    {showForm && <form className="card attendance-form" onSubmit={saveAttendance}>
      <div className="form-heading"><div><h2>Registrar atendimento</h2><p className="muted">{isMultiprofessional ? "Registre a escuta sigilosa da equipe e a devolutiva institucional." : "Registre somente orientações e encaminhamentos institucionais."}</p></div><button type="button" className="close-button" onClick={closeForm}><X /></button></div>
      <div className="attendance-form-grid">
        <div className="student-picker"><span className="field-label">Aluno</span>{selectedStudent ? <div className="selected-student"><div><strong>{selectedStudent.full_name}</strong><small>{selectedStudent.classes?.name || "Sem turma"}</small></div><button type="button" onClick={() => { setForm({...form,student_id:"",referral_id:"",appointment_id:""}); setStudentSearch(""); }}>Trocar aluno</button></div> : <><select value={studentClassFilter} onChange={e=>setStudentClassFilter(e.target.value)}><option value="">Todas as turmas</option>{studentClasses.map(c=><option value={c} key={c}>{c}</option>)}</select><label className="student-search"><Search /><input value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Digite o nome do aluno" autoComplete="off" /></label><div className="student-results">{studentResults.map(student=><button type="button" key={student.id} onClick={()=>{setForm({...form,student_id:student.id,referral_id:"",appointment_id:""});setStudentSearch(student.full_name);}}><strong>{student.full_name}</strong><small>{student.classes?.name || "Sem turma"}</small></button>)}</div></>}</div>
        <label>Encaminhamento relacionado<select value={form.referral_id} onChange={e=>setForm({...form,referral_id:e.target.value})}><option value="">Sem vínculo</option>{referrals.filter(r=>r.student_id===form.student_id).map(r=><option value={r.id} key={r.id}>{r.reason_summary.slice(0,80)}</option>)}</select></label>
        <label>Agendamento relacionado<select value={form.appointment_id} onChange={e=>setForm({...form,appointment_id:e.target.value})}><option value="">Sem agendamento</option>{appointments.filter(a=>a.student_id===form.student_id).map(a=><option value={a.id} key={a.id}>{dateTime.format(new Date(a.starts_at))} — {a.kind}</option>)}</select></label>
        {isMultiprofessional && <label className="content-field"><b>1. Registro sigiloso — Equipe Multiprofissional</b><textarea rows={7} value={form.demand} onChange={e=>setForm({...form,demand:e.target.value})} required placeholder="Registre a escuta e a demanda apresentada." /><small>🔒 Visível somente para Psicologia e Serviço Social. Apenas o autor poderá editar.</small></label>}
        <label className="content-field"><b>{isMultiprofessional ? "2. Orientações e Encaminhamentos" : "Orientações e Encaminhamentos"}</b><textarea rows={7} value={form.guidance_referrals} onChange={e=>setForm({...form,guidance_referrals:e.target.value})} required placeholder="Registre orientações, providências e encaminhamentos necessários." /><small>Visível para Direção, Coordenação Pedagógica, Psicologia e Assistência Social.</small></label>
        {form.appointment_id && <label className="check-field"><input type="checkbox" checked={form.finishAppointment} onChange={e=>setForm({...form,finishAppointment:e.target.checked})} /> Marcar o agendamento como concluído</label>}
      </div>
      <div className="privacy-note"><LockKeyhole /><span>{isMultiprofessional ? "O registro sigiloso é compartilhado somente entre Psicologia e Serviço Social. Direção e Coordenação recebem apenas as orientações institucionais." : "Este perfil não acessa nem registra o conteúdo técnico sigiloso da Equipe Multiprofissional."}</span></div>
      <div className="attendance-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button disabled={busy}>{busy ? "Salvando…" : "Salvar atendimento"}</button></div>
    </form>}

    <section className="attendance-summary"><article><FileHeart /><div><strong>{attendances.length}</strong><span>atendimentos</span></div></article><article><UserRound /><div><strong>{new Set(attendances.map(a=>a.student_id)).size}</strong><span>estudantes acompanhados</span></div></article></section>
    <section className="card attendance-card"><div className="attendance-toolbar"><div><h2>Histórico de atendimentos</h2><p className="muted">{filtered.length} registros disponíveis</p></div><label className="search-box"><Search /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar aluno ou orientações" /></label></div>
      {!filtered.length ? <div className="empty"><FileHeart /><h3>Nenhum atendimento registrado</h3><p>Os novos atendimentos aparecerão aqui.</p></div> : <div className="notes-list">{filtered.map(item=><article className="note-item" key={item.id}><div className="note-heading"><div><span className="note-type">Atendimento</span><h3>{item.students?.full_name || "Aluno"}</h3><small>{item.students?.classes?.name || "Sem turma"}</small></div></div>{isMultiprofessional ? <div className="note-referral confidential-demand"><b>1. Registro sigiloso — Equipe Multiprofissional</b><p className="note-content">{privateDemands[item.id] || "Nenhum registro sigiloso vinculado."}</p></div> : <div className="privacy-note"><LockKeyhole /><span>Registro técnico protegido: visível somente para Psicologia e Serviço Social.</span></div>}<div className="note-referral"><b>2. Orientações e Encaminhamentos</b><p className="note-content">{item.guidance_referrals}</p></div>{item.referrals?.reason_summary && <div className="note-referral"><b>Encaminhamento relacionado:</b> {item.referrals.reason_summary}</div>}<footer><span>Registrado por {item.profiles?.full_name || item.profiles?.email || "Profissional"}</span><time>{dateTime.format(new Date(item.created_at))}</time></footer></article>)}</div>}
    </section>
  </AppShell>;
}
