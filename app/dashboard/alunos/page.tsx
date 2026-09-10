"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, UserRound, UsersRound, X } from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import "./students.css";

type School = { id: string; name: string };
type ClassRow = { id: string; name: string; school_year: number };
type StudentRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_id: string | null;
  classes: { name: string; school_year: number } | null;
};

const emptyForm = { full_name: "", birth_date: "", class_id: "", guardian_name: "", guardian_phone: "" };

export default function AlunosETurmas() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [school, setSchool] = useState<School | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setEmail(user.email || "");
    const { data: membership } = await supabase
      .from("school_memberships")
      .select("school_id,schools(id,name)")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .single();
    const rawSchool = membership?.schools as unknown;
    const current = (Array.isArray(rawSchool) ? rawSchool[0] : rawSchool) as School | undefined;
    if (!current) return;
    setSchool(current);
    const [{ data: classData }, { data: studentData }] = await Promise.all([
      supabase.from("classes").select("id,name,school_year").eq("school_id", current.id).eq("active", true).order("school_year", { ascending: false }).order("name"),
      supabase.from("students").select("id,full_name,birth_date,guardian_name,guardian_phone,class_id,classes(name,school_year)").eq("school_id", current.id).eq("active", true).order("full_name")
    ]);
    setClasses((classData || []) as ClassRow[]);
    setStudents((studentData || []) as unknown as StudentRow[]);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return students.filter(student => {
      const matchesText = !term || student.full_name.toLocaleLowerCase("pt-BR").includes(term) ||
        (student.guardian_name || "").toLocaleLowerCase("pt-BR").includes(term);
      return matchesText && (!classFilter || student.class_id === classFilter);
    });
  }, [classFilter, search, students]);

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach(student => { if (student.class_id) counts.set(student.class_id, (counts.get(student.class_id) || 0) + 1); });
    return counts;
  }, [students]);

  function closeForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function editStudent(student: StudentRow) {
    setForm({
      full_name: student.full_name,
      birth_date: student.birth_date || "",
      class_id: student.class_id || "",
      guardian_name: student.guardian_name || "",
      guardian_phone: student.guardian_phone || ""
    });
    setEditingId(student.id);
    setShowForm(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    if (!school || !form.full_name.trim() || !form.class_id) return;
    setBusy(true);
    setMessage("");
    const values = {
      school_id: school.id,
      full_name: form.full_name.trim(),
      birth_date: form.birth_date || null,
      class_id: form.class_id,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      active: true
    };
    const { error } = editingId
      ? await supabase.from("students").update(values).eq("id", editingId).eq("school_id", school.id)
      : await supabase.from("students").insert(values);
    if (error) {
      setMessage("Não foi possível salvar o aluno. Confira os campos e tente novamente.");
    } else {
      setMessage(editingId ? "Cadastro do aluno atualizado." : "Aluno cadastrado com sucesso.");
      closeForm();
      await load();
    }
    setBusy(false);
  }

  async function removeStudent(student: StudentRow) {
    if (!school || !confirm(`Excluir o cadastro de ${student.full_name}?`)) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("students").delete().eq("id", student.id).eq("school_id", school.id);
    setMessage(error ? "Não foi possível excluir este aluno." : "Cadastro do aluno excluído.");
    if (!error) await load();
    setBusy(false);
  }

  if (!school) return <main className="loading">Carregando alunos e turmas…</main>;

  return <AppShell email={email}>
    <header className="students-header">
      <div><p className="eyebrow green">ANO LETIVO 2026</p><h1>Alunos e turmas</h1><p className="muted">Organize os estudantes do {school.name} e seus responsáveis.</p></div>
      <button className="primary-button" onClick={() => { closeForm(); setShowForm(true); }}><Plus /> Cadastrar aluno</button>
    </header>

    {message && <div className="feedback" role="status">{message}</div>}

    {showForm && <form className="card student-form" onSubmit={saveStudent}>
      <div className="form-heading"><div><h2>{editingId ? "Editar aluno" : "Cadastrar aluno"}</h2><p className="muted">Preencha os dados básicos e selecione a turma.</p></div><button type="button" className="close-button" onClick={closeForm} title="Fechar"><X /></button></div>
      <div className="student-form-grid">
        <label>Nome completo<input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required autoFocus /></label>
        <label>Turma<select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} required><option value="">Selecione a turma</option>{classes.map(item => <option value={item.id} key={item.id}>{item.name} — {item.school_year}</option>)}</select></label>
        <label>Data de nascimento<input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></label>
        <label>Nome do responsável<input value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} /></label>
        <label>Telefone do responsável<input type="tel" value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} placeholder="(88) 99999-9999" /></label>
      </div>
      <div className="student-form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button disabled={busy}>{busy ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar aluno"}</button></div>
    </form>}

    <section className="student-stats">
      <article><UsersRound /><div><strong>{students.length}</strong><span>alunos cadastrados</span></div></article>
      <article><UserRound /><div><strong>{classes.length}</strong><span>turmas ativas em 2026</span></div></article>
    </section>

    <section className="card students-card">
      <div className="students-toolbar">
        <div><h2>Lista de alunos</h2><p className="muted">{filtered.length} {filtered.length === 1 ? "registro encontrado" : "registros encontrados"}</p></div>
        <div className="student-filters"><label className="search-box"><Search /><input aria-label="Pesquisar alunos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar aluno ou responsável" /></label><select aria-label="Filtrar por turma" value={classFilter} onChange={e => setClassFilter(e.target.value)}><option value="">Todas as turmas</option>{classes.map(item => <option value={item.id} key={item.id}>{item.name} ({classCounts.get(item.id) || 0})</option>)}</select></div>
      </div>
      {filtered.length === 0 ? <div className="empty"><UsersRound /><h3>{students.length ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}</h3><p>{students.length ? "Altere a pesquisa ou o filtro de turma." : "Use o botão “Cadastrar aluno” para começar."}</p></div> : <div className="students-table-wrap"><table className="students-table"><thead><tr><th>Aluno</th><th>Turma</th><th>Nascimento</th><th>Responsável</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filtered.map(student => <tr key={student.id}><td><strong>{student.full_name}</strong></td><td>{student.classes ? `${student.classes.name} · ${student.classes.school_year}` : "Sem turma"}</td><td>{student.birth_date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${student.birth_date}T12:00:00Z`)) : "—"}</td><td><span>{student.guardian_name || "—"}</span>{student.guardian_phone && <small>{student.guardian_phone}</small>}</td><td><div className="row-actions"><button onClick={() => editStudent(student)} title="Editar aluno"><Pencil /></button><button className="delete" disabled={busy} onClick={() => removeStudent(student)} title="Excluir aluno"><Trash2 /></button></div></td></tr>)}</tbody></table></div>}
    </section>
  </AppShell>;
}
