"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ClassRow = { id: string; name: string; school_year: number };
type ExistingStudent = { id: string; enrollment_number: string | null; full_name: string; class_id: string | null };
type PreviewRow = {
  key: string;
  full_name: string;
  enrollment_number: string | null;
  birth_date: string | null;
  class_id: string;
  source_line: string;
};

type PdfTextItem = { str: string; transform: number[]; width?: number };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<{ getTextContent: () => Promise<{ items: PdfTextItem[] }> }> }> };
};

declare global {
  interface Window { pdfjsLib?: PdfJs }
}

const PDFJS_VERSION = "3.11.174";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[º°ª]/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
}

function normalizeName(value: string) {
  return normalize(value).replace(/\s+/g, " ");
}

function parseDate(value: string) {
  const match = value.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = Number(day), m = Number(month), y = Number(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > new Date().getFullYear()) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const forbidden = new Set([
  "ALUNO", "ALUNOS", "NOME", "NOMES", "TURMA", "SERIE", "ANO", "MATRICULA", "MATRICULAS", "NASCIMENTO", "DATA",
  "ESCOLA", "RESPONSAVEL", "RELATORIO", "LISTA", "ORDEM", "CODIGO", "SITUACAO", "TOTAL", "PAGINA", "ENSINO", "FUNDAMENTAL"
]);

function looksLikeName(value: string) {
  const cleaned = value.replace(/^\s*\d{1,12}[.)\-]?\s*/, "").replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}\b/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8 || cleaned.length < 6 || cleaned.length > 80) return false;
  if (words.some(word => forbidden.has(normalize(word)))) return false;
  return words.every(word => /^[A-Za-zÀ-ÿ'´`-]+$/.test(word));
}

function titleName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR").replace(/(^|[\s'-])([a-zà-ÿ])/g, (_, prefix, letter) => prefix + letter.toLocaleUpperCase("pt-BR"));
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-pdfjs='${PDFJS_VERSION}']`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar leitor de PDF.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PDFJS_URL;
    script.async = true;
    script.dataset.pdfjs = PDFJS_VERSION;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar leitor de PDF."));
    document.head.appendChild(script);
  });
  if (!window.pdfjsLib) throw new Error("Leitor de PDF indisponível.");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return window.pdfjsLib;
}

function buildLines(items: PdfTextItem[]) {
  const groups = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    if (!item.str?.trim() || !item.transform?.length) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    const group = groups.get(y) || [];
    group.push(item);
    groups.set(y, group);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => {
      const sorted = row.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = "";
      let previousEnd = 0;
      sorted.forEach((item, index) => {
        const x = item.transform[4];
        const gap = index ? x - previousEnd : 0;
        if (index) line += gap > 12 ? "  " : " ";
        line += item.str.trim();
        previousEnd = x + (item.width || item.str.length * 5);
      });
      return line.replace(/\s{3,}/g, "  ").trim();
    })
    .filter(Boolean);
}

function findClassId(line: string, classes: ClassRow[]) {
  const n = normalize(line);
  const direct = classes.find(item => {
    const className = normalize(item.name);
    return className.length >= 2 && (n.includes(className) || n.includes(`${className} ${item.school_year}`));
  });
  if (direct) return direct.id;

  const yearMatch = n.match(/\b([1-9])\s*(?:ANO)?\s*([A-Z])?\b/);
  if (!yearMatch) return "";
  const grade = yearMatch[1];
  const letter = yearMatch[2] || "";
  const candidates = classes.filter(item => {
    const c = normalize(item.name);
    return c.includes(grade) && (!letter || c.includes(letter));
  });
  return candidates.length === 1 ? candidates[0].id : "";
}

function extractName(line: string) {
  const withoutDate = line.replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}\b/g, "  ");
  const parts = withoutDate.split(/\s{2,}|\||;|\t/).map(part => part.trim()).filter(Boolean);
  for (const part of parts) {
    const candidate = part.replace(/^\d{1,12}[.)\-]?\s*/, "").trim();
    if (looksLikeName(candidate)) return candidate;
  }
  const fallback = withoutDate.replace(/^\s*\d{1,12}[.)\-]?\s*/, "").trim();
  if (looksLikeName(fallback)) return fallback;
  return "";
}

function extractEnrollment(line: string, name: string) {
  const beforeName = line.slice(0, Math.max(0, line.toUpperCase().indexOf(name.toUpperCase())));
  const numbers = beforeName.match(/\b\d{4,14}\b/g);
  return numbers?.at(-1) || null;
}

function makePreview(lines: string[], classes: ClassRow[]) {
  const rows: PreviewRow[] = [];
  let currentClass = "";
  const seen = new Set<string>();

  for (const line of lines) {
    const classId = findClassId(line, classes);
    const normalizedLine = normalize(line);
    if (classId && (normalizedLine.includes("TURMA") || normalizedLine.includes("ANO") || normalizedLine.length < 45)) {
      currentClass = classId;
    }
    const extracted = extractName(line);
    if (!extracted) continue;
    const fullName = titleName(extracted);
    const enrollment = extractEnrollment(line, extracted);
    const assignedClass = classId || currentClass;
    const key = enrollment ? `m:${enrollment}` : `n:${normalizeName(fullName)}:${assignedClass}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ key, full_name: fullName, enrollment_number: enrollment, birth_date: parseDate(line), class_id: assignedClass, source_line: line });
  }
  return rows;
}

export default function StudentPdfImport({ schoolId, classes, existingStudents, onImported }: {
  schoolId: string;
  classes: ClassRow[];
  existingStudents: ExistingStudent[];
  onImported: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const existingKeys = useMemo(() => new Set(existingStudents.flatMap(student => {
    const keys = [`n:${normalizeName(student.full_name)}:${student.class_id || ""}`];
    if (student.enrollment_number) keys.push(`m:${student.enrollment_number}`);
    return keys;
  })), [existingStudents]);

  const duplicates = rows.filter(row => existingKeys.has(row.enrollment_number ? `m:${row.enrollment_number}` : `n:${normalizeName(row.full_name)}:${row.class_id}`)).length;
  const missingClass = rows.filter(row => !row.class_id).length;
  const importable = rows.filter(row => row.class_id && !existingKeys.has(row.enrollment_number ? `m:${row.enrollment_number}` : `n:${normalizeName(row.full_name)}:${row.class_id}`));

  function reset() {
    setRows([]); setFileName(""); setError(""); setSuccess("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function readPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("O PDF deve ter no máximo 15 MB.");
      return;
    }
    setBusy(true); setError(""); setSuccess(""); setRows([]); setFileName(file.name);
    try {
      const pdfjs = await loadPdfJs();
      const data = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data }).promise;
      const allLines: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        allLines.push(...buildLines(content.items));
      }
      const preview = makePreview(allLines, classes);
      if (!preview.length) throw new Error("Não encontrei nomes de alunos no PDF. Verifique se o arquivo possui texto selecionável e tente novamente.");
      setRows(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler este PDF.");
    } finally {
      setBusy(false);
    }
  }

  function changeClass(key: string, classId: string) {
    setRows(current => current.map(row => row.key === key ? { ...row, class_id: classId, key: row.enrollment_number ? row.key : `n:${normalizeName(row.full_name)}:${classId}` } : row));
  }

  async function importStudents() {
    if (!importable.length) return;
    setBusy(true); setError(""); setSuccess("");
    const payload = importable.map(row => ({
      school_id: schoolId,
      class_id: row.class_id,
      full_name: row.full_name,
      birth_date: row.birth_date,
      enrollment_number: row.enrollment_number,
      active: true
    }));
    const { error: insertError } = await supabase.from("students").insert(payload);
    if (insertError) {
      setError("A importação não foi concluída. Nenhum dado da pré-visualização foi apagado; revise as turmas e tente novamente.");
      setBusy(false);
      return;
    }
    setSuccess(`${payload.length} ${payload.length === 1 ? "aluno importado" : "alunos importados"} com sucesso.`);
    setRows([]);
    await onImported();
    setBusy(false);
  }

  return <section className="pdf-import-wrap">
    <button type="button" className="secondary-import-button" onClick={() => { setOpen(value => !value); setError(""); setSuccess(""); }}><FileUp /> Importar alunos por PDF</button>
    {open && <div className="card pdf-import-card">
      <div className="form-heading"><div><p className="eyebrow green">IMPORTAÇÃO ASSISTIDA</p><h2>Importar alunos por PDF</h2><p className="muted">O sistema lê o arquivo, tenta identificar as turmas e mostra tudo antes de salvar.</p></div><button className="close-button" type="button" onClick={() => { setOpen(false); reset(); }} title="Fechar"><X /></button></div>
      <div className="pdf-drop">
        <input ref={inputRef} id="student-pdf" type="file" accept="application/pdf,.pdf" onChange={readPdf} disabled={busy} />
        <label htmlFor="student-pdf"><FileUp /><strong>{fileName || "Selecionar PDF com a relação de alunos"}</strong><span>PDF de até 15 MB. Nenhum aluno é salvo sem sua confirmação.</span></label>
      </div>
      {busy && <p className="pdf-status"><LoaderCircle className="spin" /> Processando…</p>}
      {error && <p className="pdf-error"><AlertTriangle /> {error}</p>}
      {success && <p className="pdf-success"><CheckCircle2 /> {success}</p>}
      {!!rows.length && <>
        <div className="pdf-summary"><span><strong>{rows.length}</strong> encontrados</span><span><strong>{importable.length}</strong> prontos</span><span><strong>{duplicates}</strong> já cadastrados</span><span className={missingClass ? "attention" : ""}><strong>{missingClass}</strong> sem turma</span></div>
        {missingClass > 0 && <p className="pdf-warning"><AlertTriangle /> Há alunos cuja turma não foi reconhecida. Selecione a turma abaixo antes de importar.</p>}
        <div className="pdf-table-wrap"><table className="pdf-table"><thead><tr><th>Aluno identificado</th><th>Matrícula</th><th>Nascimento</th><th>Turma</th><th>Status</th></tr></thead><tbody>{rows.map(row => {
          const duplicate = existingKeys.has(row.enrollment_number ? `m:${row.enrollment_number}` : `n:${normalizeName(row.full_name)}:${row.class_id}`);
          return <tr key={row.key}><td><strong>{row.full_name}</strong></td><td>{row.enrollment_number || "—"}</td><td>{row.birth_date ? row.birth_date.split("-").reverse().join("/") : "—"}</td><td><select value={row.class_id} onChange={e => changeClass(row.key, e.target.value)} disabled={duplicate}><option value="">Selecionar turma</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name} — {item.school_year}</option>)}</select></td><td>{duplicate ? <span className="tag duplicate">Já cadastrado</span> : row.class_id ? <span className="tag ready">Pronto</span> : <span className="tag review">Revisar</span>}</td></tr>;
        })}</tbody></table></div>
        <div className="pdf-actions"><button type="button" className="secondary-button" onClick={reset} disabled={busy}>Escolher outro PDF</button><button type="button" onClick={importStudents} disabled={busy || !importable.length}>{busy ? "Importando…" : `Confirmar importação (${importable.length})`}</button></div>
      </>}
    </div>}
  </section>;
}
