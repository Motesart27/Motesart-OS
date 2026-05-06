import { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://deployable-python-codebase-som-production.up.railway.app";

const BRAND_EMAIL = "motesarttech@gmail.com";
const COLORS = {
  red: "#B83838",
  ink: "#f7f3ec",
  muted: "#a9a19a",
  panel: "rgba(18,18,20,0.94)",
  panel2: "rgba(28,26,26,0.94)",
  border: "rgba(255,255,255,0.10)",
  amber: "#D7A548",
  amberDim: "rgba(215,165,72,0.12)",
  green: "#6fbf8f",
};

export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.students)) return payload.students;
  if (Array.isArray(payload?.invoices)) return payload.invoices;
  return [];
}

export function flattenRecord(record) {
  if (!record || typeof record !== "object") return {};
  return {
    id: record.id,
    createdTime: record.createdTime,
    ...(record.fields || record),
  };
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const body = await response.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    throw new Error(`GET ${path} failed ${response.status}: ${body}`);
  }
  return parsed;
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    throw new Error(`POST ${path} failed ${response.status}: ${body}`);
  }
  return parsed;
}

async function patchJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    throw new Error(`PATCH ${path} failed ${response.status}: ${body}`);
  }
  return parsed;
}

function money(value) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function hasValue(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeLocalId(prefix = "line") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`;
}

function starterLine() {
  return { local_id: makeLocalId(), description: "", rate_per_hour: "", hours: "" };
}

function getLockedDefaultLines(studentId) {
  if (studentId === "reccGL1CYdVUjmJJE") {
    return [
      { local_id: makeLocalId("default"), description: "Music Lessons", rate_per_hour: 85, hours: 4 },
      { local_id: makeLocalId("default"), description: "Organ Lessons 1/2hr", rate_per_hour: 45, hours: 2 },
    ];
  }
  return [starterLine()];
}

function formatAddress(address) {
  if (!hasValue(address)) return ["Missing"];
  const text = String(address).trim();
  if (text.includes("\n")) return text.split("\n").map((part) => part.trim()).filter(Boolean);
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return [text];
  if (parts.length === 2) return parts;
  return [parts[0], parts.slice(1).join(", ")];
}

function StudentCard({ student, invoices, onInvoiceSelect, onNewInvoice }) {
  const missing = ["email", "phone", "address"].filter((field) => !hasValue(student[field]));
  const incomplete = missing.length > 0;
  const addressLines = formatAddress(student.address);

  return (
    <article className={`piano-card ${incomplete ? "piano-card-incomplete" : ""}`}>
      <div className="piano-card-top">
        <div>
          <h3>{student.student_name || "Unnamed student"}</h3>
          <p>{student.student_status || "status pending"}</p>
        </div>
        {incomplete && <span className="piano-warning">Incomplete profile</span>}
      </div>

      <div className="piano-contact-grid">
        <span>Email</span>
        <strong>{student.email || "Missing"}</strong>
        <span>Phone</span>
        <strong>{student.phone || "Missing"}</strong>
        <span>Address</span>
        <strong>{addressLines.map((line) => <span key={line}>{line}<br /></span>)}</strong>
      </div>

      {student.notes && <div className="piano-note">{student.notes}</div>}

      <div className="piano-card-footer">
        <div>
          {onNewInvoice && (
            <button
              type="button"
              className="piano-card-new-btn"
              onClick={() => onNewInvoice(student)}
            >
              + New invoice
            </button>
          )}
          <span className="piano-section-label">Invoices</span>
          {invoices.length === 0 ? (
            <div className="piano-empty">No invoices yet</div>
          ) : (
            <div className="piano-invoice-links">
              {invoices.map((invoice) => (
                <button key={invoice.id} type="button" onClick={() => onInvoiceSelect(invoice)}>
                  {invoice.invoice_id || invoice.id} · {money(invoice.total)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ReceiptPreview({
  invoice,
  lines,
  student,
  logoFailed,
  setLogoFailed,
  editingLines,
  onEditStart,
  onEditCancel,
  onEditFieldChange,
  onSaveChanges,
  editError,
  showSaveToast,
  savingChanges,
}) {
  if (!invoice) {
    return (
      <aside className="piano-receipt piano-receipt-empty">
        <div className="piano-wordmark">School of Motesart</div>
        <p>Receipt preview will appear here when a real invoice exists.</p>
        <button type="button" disabled>Generate PDF · coming next</button>
        <button type="button" disabled>Send via email · coming next</button>
      </aside>
    );
  }

  return (
    <aside className="piano-receipt">
      {showSaveToast && (
        <div className="piano-receipt-toast">✓ Draft saved</div>
      )}
      <div className="piano-receipt-head">
        {!logoFailed ? (
          <img src="/brand/som-logo.png" alt="School of Motesart" onError={() => setLogoFailed(true)} />
        ) : (
          <div className="piano-wordmark">School of Motesart</div>
        )}
        <div>
          <span>Receipt Preview</span>
          <strong>{invoice.invoice_id || invoice.id}</strong>
        </div>
      </div>
      {invoice.invoice_status === "draft" && !editingLines && (
        <button type="button" className="piano-receipt-edit-btn" onClick={onEditStart}>
          Edit
        </button>
      )}
      {editError && (
        <div
          style={{
            background: "#FEE",
            borderLeft: "2px solid #C03030",
            padding: "8px 10px",
            marginBottom: 12,
            fontSize: 12,
            color: "#600",
          }}
        >
          {editError}
        </div>
      )}
      {student && (
        <div className="piano-receipt-student">
          <span>{student.student_name}</span>
          {formatAddress(student.address).map((line) => <strong key={line}>{line}</strong>)}
        </div>
      )}
      {editingLines ? (
        <div className="piano-receipt-lines piano-receipt-lines-editing">
          {editingLines.map((line, index) => (
            <div className="piano-receipt-edit-line" key={line.id}>
              <label className="piano-field">
                <span>Description</span>
                <input
                  value={line.description}
                  onChange={(event) => onEditFieldChange(line.id, "description", event.target.value)}
                  placeholder="Music Lessons"
                />
              </label>
              <label className="piano-field">
                <span>Rate</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={line.rate_per_hour}
                  onChange={(event) => onEditFieldChange(line.id, "rate_per_hour", event.target.value)}
                />
              </label>
              <label className="piano-field">
                <span>Hours</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  inputMode="decimal"
                  value={line.hours}
                  onChange={(event) => onEditFieldChange(line.id, "hours", event.target.value)}
                />
              </label>
              <div className="piano-receipt-line-total">
                <span>Line total</span>
                <strong>{money(Number(line.rate_per_hour) * Number(line.hours))}</strong>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="piano-receipt-lines">
          {lines.map((line) => (
            <div key={line.id}>
              <span>{line.description || "Lesson"}</span>
              <strong>{money(line.line_total)}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="piano-receipt-total">
        <span>Total</span>
        <strong>{money(invoice.total)}</strong>
      </div>
      {editingLines && (
        <div className="piano-receipt-actions">
          <button type="button" className="piano-receipt-cancel-btn" onClick={onEditCancel} disabled={savingChanges}>
            Cancel
          </button>
          <button type="button" className="piano-receipt-save-btn" onClick={onSaveChanges} disabled={savingChanges}>
            {savingChanges ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
      <button type="button" disabled>Generate PDF · coming next</button>
      <button type="button" disabled>Send via email · coming next</button>
    </aside>
  );
}

function DraftInvoiceSheet({
  open,
  initialStudentId,
  students,
  invoicesByStudent,
  onClose,
  onSaved,
  onError,
  fetchInvoiceDetail,
}) {
  const [studentId, setStudentId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [lines, setLines] = useState([starterLine()]);
  const [otherAdjustment, setOtherAdjustment] = useState("0");
  const [notesBlock, setNotesBlock] = useState("");
  const [validation, setValidation] = useState([]);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [preloadingInvoice, setPreloadingInvoice] = useState(false);
  const [preloadedFromLast, setPreloadedFromLast] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [pendingCloseAfterSave, setPendingCloseAfterSave] = useState(false);

  useEffect(() => {
    if (!showSaveToast) return;
    const timer = setTimeout(() => {
      setShowSaveToast(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [showSaveToast]);

  useEffect(() => {
    if (!open) {
      setStudentId("");
      setInvoiceDate(todayISO());
      setLines([starterLine()]);
      setOtherAdjustment("0");
      setNotesBlock("");
      setValidation([]);
      setSaving(false);
      setDuplicating(false);
      setPreloadingInvoice(false);
      setPreloadedFromLast(false);
      setShowSaveToast(false);
      setPendingCloseAfterSave(false);
      return;
    }
    setStudentId(initialStudentId || "");
    setInvoiceDate(todayISO());
    setLines([starterLine()]);
    setOtherAdjustment("0");
    setNotesBlock("");
    setValidation([]);
    setSaving(false);
    setDuplicating(false);
    setPreloadingInvoice(false);
    setPreloadedFromLast(false);
    setShowSaveToast(false);
    setPendingCloseAfterSave(false);
  }, [open, initialStudentId]);

  useEffect(() => {
    if (pendingCloseAfterSave && !showSaveToast) {
      setPendingCloseAfterSave(false);
      onClose();
    }
  }, [pendingCloseAfterSave, showSaveToast, onClose]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const seedLines = getLockedDefaultLines(studentId);

    setInvoiceDate(todayISO());
    setPreloadedFromLast(false);
    setPreloadingInvoice(Boolean(studentId));
    setLines(seedLines);

    if (!studentId) {
      setPreloadingInvoice(false);
      return () => {
        active = false;
      };
    }

    async function preloadLinesForNewInvoice(student) {
      setPreloadedFromLast(false);
      const recent = invoicesByStudent?.get(student.id)?.[0];
      if (recent?.id) {
        try {
          const detail = await fetchInvoiceDetail(recent.id);
          const detailLines = unwrapList(detail?.lines || []);
          if (detailLines.length > 0) {
            const mappedLines = detailLines.map((line) => {
              const fields = flattenRecord(line);
              return {
                local_id: makeLocalId("copy"),
                description: fields.description || fields.service || "",
                rate_per_hour: Number(fields.rate_per_hour || fields.rate || 0),
                hours: Number(fields.hours || 0),
              };
            });
            if (!active) return;
            setLines(mappedLines);
            setPreloadedFromLast(true);
            return;
          }
        } catch (error) {
          console.error("Phase 4B.3 preload fetch failed", error);
        }
      }

      if (!active) return;
      const fallbackLines = getLockedDefaultLines(student.id);
      setLines(fallbackLines);
      setPreloadedFromLast(student.id === "reccGL1CYdVUjmJJE");
    }

    async function preloadFromLastInvoice() {
      try {
        await preloadLinesForNewInvoice({ id: studentId });
      } finally {
        if (active) setPreloadingInvoice(false);
      }
    }

    preloadFromLastInvoice();

    return () => {
      active = false;
    };
  }, [open, studentId, invoicesByStudent]);

  if (!open) return null;

  const selectedStudent = students.find((student) => student.id === studentId);
  const previousInvoices = studentId ? (invoicesByStudent.get(studentId) || []) : [];

  function updateLine(localId, field, value) {
    setLines((items) => items.map((line) => line.local_id === localId ? { ...line, [field]: value } : line));
  }

  function addLine() {
    setLines((items) => [...items, starterLine()]);
  }

  function removeLine(localId) {
    setLines((items) => items.length <= 1 ? items : items.filter((line) => line.local_id !== localId));
  }

  async function duplicatePrevious() {
    if (!previousInvoices.length) return;
    setDuplicating(true);
    setValidation([]);
    try {
      const latest = [...previousInvoices].sort((a, b) => String(b.invoice_date || b.createdTime || "").localeCompare(String(a.invoice_date || a.createdTime || "")))[0];
      const detail = await fetchInvoiceDetail(latest.id);
      const copied = unwrapList(detail.lines).map(flattenRecord).map((line) => ({
        local_id: makeLocalId("copy"),
        description: line.description || "",
        rate_per_hour: line.rate_per_hour || "",
        hours: line.hours || "",
      }));
      setLines(copied.length ? copied : [starterLine()]);
      setInvoiceDate(todayISO());
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDuplicating(false);
    }
  }

  function validate() {
    const problems = [];
    if (!studentId) problems.push("Student is required.");
    if (!invoiceDate) problems.push("Invoice date is required.");
    if (!lines.length) problems.push("At least one line item is required.");
    lines.forEach((line, index) => {
      if (!hasValue(line.description)) problems.push(`Line ${index + 1}: description is required.`);
      if (!(Number(line.rate_per_hour) > 0)) problems.push(`Line ${index + 1}: rate per hour must be greater than 0.`);
      if (!(Number(line.hours) > 0)) problems.push(`Line ${index + 1}: hours must be greater than 0.`);
    });
    setValidation(problems);
    return problems.length === 0;
  }

  async function saveDraft() {
    if (!validate()) return;
    setSaving(true);
    setValidation([]);
    try {
      const stamp = `${invoiceDate}-${selectedStudent?.student_name || "student"}`.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-");
      const payload = {
        invoice: {
          invoice_id: `draft-${stamp}`,
          student: [studentId],
          invoice_date: invoiceDate,
          invoice_status: "draft",
          other_adjustment: Number(otherAdjustment) || 0,
          notes_block: notesBlock,
        },
        lines: lines.map((line, index) => ({
          line_id: `draft-${stamp}-line-${index + 1}`,
          description: line.description.trim(),
          rate_per_hour: Number(line.rate_per_hour),
          hours: Number(line.hours),
        })),
      };
      const result = await postJson("/api/piano/invoices", payload);
      setShowSaveToast(true);
      setPendingCloseAfterSave(true);
      await onSaved(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="piano-sheet-backdrop" role="dialog" aria-modal="true" aria-label="New invoice">
      <div className="piano-sheet" style={{ position: "relative" }}>
        <div className="piano-sheet-bar">
          <button type="button" onClick={onClose}>Cancel</button>
          <strong>New invoice</strong>
          <button type="button" onClick={saveDraft} disabled={saving}>{saving ? "Saving..." : "Save Draft"}</button>
        </div>

        {showSaveToast && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "#04342C",
              color: "white",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 500,
              zIndex: 10,
              pointerEvents: "none",
              opacity: 1,
              transition: "opacity 150ms ease-out",
            }}
          >
            ✓ Draft saved
          </div>
        )}

        <div className="piano-sheet-body">
          {preloadingInvoice && (
            <div style={{ background: "#FAECE7", borderLeft: "2px solid #B83838", borderRadius: 0, padding: "8px 10px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#4A1B0C" }}>
                Loading previous invoice…
              </div>
            </div>
          )}
          {!preloadingInvoice && preloadedFromLast && (
            <div style={{ background: "#FAECE7", borderLeft: "2px solid #B83838", borderRadius: 0, padding: "8px 10px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#4A1B0C" }}>
                Pre-filled from last invoice
              </div>
              <div style={{ fontSize: 11, fontWeight: 400, color: "#712B13", marginTop: 2 }}>
                Edit any line as needed.
              </div>
            </div>
          )}
          {validation.length > 0 && (
            <div className="piano-validation">
              {validation.map((item) => <div key={item}>{item}</div>)}
            </div>
          )}

          <label className="piano-field">
            <span>Student</span>
            <select value={studentId} onChange={(event) => {
              setStudentId(event.target.value);
            }}>
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.student_name}</option>
              ))}
            </select>
          </label>

          <label className="piano-field">
            <span>Invoice date</span>
            <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
          </label>

          <div className="piano-sheet-section">
            <div className="piano-sheet-section-head">
              <span>Line items</span>
              <button type="button" onClick={duplicatePrevious} disabled={!previousInvoices.length || duplicating}>
                {duplicating ? "Copying..." : "Duplicate last"}
              </button>
            </div>

            <div className="piano-lines-editor">
              {lines.map((line, index) => (
                <div className="piano-line-editor" key={line.local_id}>
                  <div className="piano-line-title">Line {index + 1}</div>
                  <label className="piano-field">
                    <span>Description</span>
                    <input value={line.description} onChange={(event) => updateLine(line.local_id, "description", event.target.value)} placeholder="Music Lessons" />
                  </label>
                  <div className="piano-line-numbers">
                    <label className="piano-field">
                      <span>Rate</span>
                      <input type="number" min="0" step="0.01" value={line.rate_per_hour} onChange={(event) => updateLine(line.local_id, "rate_per_hour", event.target.value)} />
                    </label>
                    <label className="piano-field">
                      <span>Hours</span>
                      <input type="number" min="0" step="0.25" value={line.hours} onChange={(event) => updateLine(line.local_id, "hours", event.target.value)} />
                    </label>
                  </div>
                  <button type="button" className="piano-remove-line" onClick={() => removeLine(line.local_id)} disabled={lines.length <= 1}>Remove line</button>
                </div>
              ))}
            </div>
            <button type="button" className="piano-add-line" onClick={addLine}>Add line item</button>
          </div>

          <label className="piano-field">
            <span>Other adjustment</span>
            <input type="number" step="0.01" value={otherAdjustment} onChange={(event) => setOtherAdjustment(event.target.value)} />
          </label>

          <label className="piano-field">
            <span>Notes</span>
            <textarea value={notesBlock} onChange={(event) => setNotesBlock(event.target.value)} rows={4} placeholder="Optional internal notes" />
          </label>
        </div>
      </div>
    </div>
  );
}

export default function PianoLessonsSection() {
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedLines, setSelectedLines] = useState([]);
  const [editingLines, setEditingLines] = useState(null);
  const [editError, setEditError] = useState("");
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftStudentId, setDraftStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  async function loadRecords() {
    setLoading(true);
    setError("");
    const [studentPayload, invoicePayload] = await Promise.all([
      fetchJson("/api/piano/students"),
      fetchJson("/api/piano/invoices"),
    ]);
    setStudents(unwrapList(studentPayload).map(flattenRecord));
    setInvoices(unwrapList(invoicePayload).map(flattenRecord));
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [studentPayload, invoicePayload] = await Promise.all([
          fetchJson("/api/piano/students"),
          fetchJson("/api/piano/invoices"),
        ]);
        if (!active) return;
        setStudents(unwrapList(studentPayload).map(flattenRecord));
        setInvoices(unwrapList(invoicePayload).map(flattenRecord));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const invoicesByStudent = useMemo(() => {
    const map = new Map();
    for (const student of students) map.set(student.id, []);
    for (const invoice of invoices) {
      const linked = Array.isArray(invoice.student) ? invoice.student : [];
      for (const studentId of linked) {
        if (!map.has(studentId)) map.set(studentId, []);
        map.get(studentId).push(invoice);
      }
    }
    return map;
  }, [students, invoices]);

  async function selectInvoice(invoice) {
    setSelectedInvoice(invoice);
    setSelectedLines([]);
    setEditingLines(null);
    setEditError("");
    setShowSaveToast(false);
    try {
      const detail = await fetchInvoiceDetail(invoice.id);
      setSelectedInvoice(flattenRecord(detail.invoice));
      setSelectedLines(unwrapList(detail.lines).map(flattenRecord));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function fetchInvoiceDetail(invoiceId) {
    return fetchJson(`/api/piano/invoices/${invoiceId}`);
  }

  function handleNewInvoiceClick(student) {
    setDraftStudentId(student.id);
    setDraftOpen(true);
  }

  async function handleDraftSaved(result) {
    await loadRecords();
    const invoice = flattenRecord(result?.invoice);
    setEditingLines(null);
    setEditError("");
    setShowSaveToast(false);
    if (invoice.id) {
      try {
        const detail = await fetchInvoiceDetail(invoice.id);
        setSelectedInvoice(flattenRecord(detail.invoice));
        setSelectedLines(unwrapList(detail.lines).map(flattenRecord));
        return;
      } catch {
        setSelectedInvoice(invoice);
        setSelectedLines(unwrapList(result?.lines).map(flattenRecord));
      }
    }
  }

  useEffect(() => {
    if (!showSaveToast) return;
    const timer = setTimeout(() => {
      setShowSaveToast(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [showSaveToast]);

  function handleEditStart() {
    if (selectedInvoice?.invoice_status !== "draft") return;
    setEditingLines(
      selectedLines.map((line) => ({
        id: line.id,
        description: line.description ?? "",
        rate_per_hour: Number(line.rate_per_hour ?? 0),
        hours: Number(line.hours ?? 0),
      }))
    );
    setEditError("");
  }

  function handleEditCancel() {
    setEditingLines(null);
    setEditError("");
  }

  function handleEditFieldChange(lineId, field, value) {
    setEditingLines((prev) =>
      prev
        ? prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line))
        : prev
    );
  }

  async function handleSaveChanges() {
    if (!editingLines || !selectedInvoice) return;
    setEditError("");
    setSavingChanges(true);

    try {
      const originalById = new Map(selectedLines.map((line) => [line.id, line]));
      const changed = editingLines
        .map((edited, index) => {
          const original = originalById.get(edited.id) || {};
          const patch = {};
          const description = String(edited.description ?? "").trim();
          const rate = Number(edited.rate_per_hour);
          const hours = Number(edited.hours);

          if (description !== String(original.description ?? "")) patch.description = description;
          if (rate !== Number(original.rate_per_hour ?? 0)) patch.rate_per_hour = rate;
          if (hours !== Number(original.hours ?? 0)) patch.hours = hours;

          return { edited, index, patch };
        })
        .filter((item) => Object.keys(item.patch).length > 0);

      if (!changed.length) {
        setEditingLines(null);
        return;
      }

      let lastResponse = null;
      for (const item of changed) {
        const response = await fetch(`${API_BASE}/api/piano/invoices/${selectedInvoice.id}/lines/${item.edited.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.patch),
        });
        const body = await response.text();
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch {
          parsed = body;
        }
        if (!response.ok) {
          console.error("Phase 4B.4 line PATCH failed", {
            lineNumber: item.index + 1,
            lineId: item.edited.id,
            status: response.status,
            body,
          });
          setEditError(`Failed to save line ${item.index + 1}: ${item.edited.description || item.edited.id}`);
          return;
        }
        lastResponse = parsed;
      }

      if (lastResponse) {
        setSelectedInvoice(flattenRecord(lastResponse.invoice));
        setSelectedLines(unwrapList(lastResponse.lines).map(flattenRecord));
      }
      setEditingLines(null);
      setEditError("");
      setShowSaveToast(true);
    } catch (err) {
      console.error("Phase 4B.4 line PATCH network error", err);
      setEditError(`Network error saving line ${editingLines[0]?.description || editingLines[0]?.id || "1"}`);
    } finally {
      setSavingChanges(false);
    }
  }

  const selectedStudent = selectedInvoice?.student?.[0]
    ? students.find((student) => student.id === selectedInvoice.student[0])
    : null;
  const hasSelectedInvoice = Boolean(selectedInvoice);

  return (
    <section className="piano-shell" aria-label="Music Lessons">
      <style>{`
        .piano-shell {
          --piano-red: ${COLORS.red};
          color: ${COLORS.ink};
          font-family: Lato, Helvetica, Arial, sans-serif;
          display: grid;
          gap: 14px;
        }
        .piano-hero {
          border: 1px solid ${COLORS.border};
          border-left: 3px solid var(--piano-red);
          background: linear-gradient(135deg, rgba(184,56,56,0.18), rgba(20,20,22,0.96));
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .piano-title {
          margin: 0;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 24px;
          line-height: 1;
          color: ${COLORS.ink};
          font-weight: 700;
        }
        .piano-subtitle {
          margin: 5px 0 0;
          color: ${COLORS.muted};
          font-size: 12px;
          line-height: 1.45;
        }
        .piano-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .piano-chip {
          border: 1px solid rgba(184,56,56,0.35);
          background: rgba(184,56,56,0.12);
          color: #f0d8d8;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .piano-new-btn {
          min-height: 44px;
          border: 1px solid rgba(184,56,56,0.58);
          background: rgba(184,56,56,0.22);
          color: #f6e5e5;
          border-radius: 8px;
          padding: 0 13px;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }
        .piano-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        .piano-grid-has-detail {
          grid-template-columns: minmax(0, 1fr) 300px;
        }
        .piano-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 10px;
          align-items: stretch;
        }
        .piano-card {
          min-width: 0;
          border: 1px solid ${COLORS.border};
          background: ${COLORS.panel};
          border-radius: 8px;
          padding: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          display: flex;
          flex-direction: column;
          min-height: 230px;
        }
        .piano-card-incomplete {
          border-color: rgba(215,165,72,0.72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(215,165,72,0.16);
        }
        .piano-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }
        .piano-card h3 {
          margin: 0;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 21px;
          line-height: 1.05;
          color: ${COLORS.ink};
        }
        .piano-card p {
          margin: 3px 0 0;
          color: ${COLORS.green};
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 800;
        }
        .piano-warning {
          flex-shrink: 0;
          border: 1px solid rgba(215,165,72,0.45);
          background: ${COLORS.amberDim};
          color: #f2d491;
          border-radius: 999px;
          padding: 4px 7px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }
        .piano-contact-grid {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 5px 8px;
          font-size: 11px;
          line-height: 1.25;
          margin-bottom: 10px;
        }
        .piano-contact-grid span {
          color: ${COLORS.muted};
        }
        .piano-contact-grid strong {
          color: ${COLORS.ink};
          font-weight: 700;
          overflow-wrap: anywhere;
        }
        .piano-note {
          border: 1px solid rgba(215,165,72,0.22);
          background: rgba(215,165,72,0.08);
          border-radius: 6px;
          padding: 7px 8px;
          color: #d9c8a0;
          font-size: 11px;
          line-height: 1.4;
          margin-bottom: 10px;
        }
        .piano-card-footer {
          border-top: 1px solid ${COLORS.border};
          padding-top: 9px;
          margin-top: auto;
        }
        .piano-section-label {
          display: block;
          color: ${COLORS.muted};
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
          margin-bottom: 5px;
        }
        .piano-empty {
          color: ${COLORS.ink};
          border: 1px dashed rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.035);
          border-radius: 6px;
          padding: 8px;
          font-size: 12px;
          font-weight: 800;
        }
        .piano-card-new-btn {
          width: 100%;
          min-height: 40px;
          border: 1px solid rgba(184,56,56,0.36);
          background: rgba(184,56,56,0.12);
          color: #f0d8d8;
          border-radius: 6px;
          padding: 0 10px;
          font: inherit;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .piano-invoice-links {
          display: grid;
          gap: 5px;
        }
        .piano-invoice-links button,
        .piano-receipt button {
          border: 1px solid rgba(184,56,56,0.36);
          background: rgba(184,56,56,0.12);
          color: #f0d8d8;
          border-radius: 6px;
          padding: 7px 9px;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          text-align: left;
        }
        .piano-receipt button:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }
        .piano-receipt {
          border: 1px solid ${COLORS.border};
          background: ${COLORS.panel2};
          border-radius: 8px;
          padding: 12px;
          display: grid;
          gap: 10px;
          min-width: 0;
          position: relative;
        }
        .piano-receipt-toast {
          position: absolute;
          top: 14px;
          right: 14px;
          z-index: 3;
          pointer-events: none;
          background: #04342C;
          color: white;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 500;
          opacity: 1;
          transition: opacity 150ms ease-out;
        }
        .piano-receipt-empty {
          align-content: start;
        }
        .piano-wordmark {
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 24px;
          line-height: 1;
          color: ${COLORS.ink};
        }
        .piano-receipt p {
          margin: 0;
          color: ${COLORS.muted};
          font-size: 12px;
          line-height: 1.5;
        }
        .piano-receipt-head {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .piano-receipt-edit-btn {
          min-height: 44px;
          width: fit-content;
          justify-self: end;
          border: 1px solid rgba(184,56,56,0.6);
          background: transparent;
          color: #f0d8d8;
          border-radius: 8px;
          padding: 0 12px;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .piano-receipt-head img {
          width: 44px;
          height: 44px;
          object-fit: contain;
          border-radius: 6px;
          background: rgba(255,255,255,0.06);
        }
        .piano-receipt-head span,
        .piano-receipt-lines span,
        .piano-receipt-total span {
          color: ${COLORS.muted};
          font-size: 11px;
        }
        .piano-receipt-head strong {
          display: block;
          color: ${COLORS.ink};
          font-size: 13px;
        }
        .piano-receipt-student {
          border: 1px solid ${COLORS.border};
          background: rgba(255,255,255,0.035);
          border-radius: 6px;
          padding: 8px;
          display: grid;
          gap: 2px;
        }
        .piano-receipt-student span {
          color: ${COLORS.ink};
          font-size: 13px;
          font-weight: 900;
        }
        .piano-receipt-student strong {
          color: ${COLORS.muted};
          font-size: 11px;
          font-weight: 700;
        }
        .piano-receipt-lines {
          display: grid;
          gap: 6px;
        }
        .piano-receipt-lines-editing {
          gap: 10px;
        }
        .piano-receipt-lines div,
        .piano-receipt-total {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid ${COLORS.border};
          padding-bottom: 6px;
        }
        .piano-receipt-total {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .piano-receipt-edit-line {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(76px, 0.52fr) minmax(76px, 0.52fr) auto;
          gap: 8px;
          align-items: end;
          border: 1px solid ${COLORS.border};
          background: rgba(255,255,255,0.035);
          border-radius: 6px;
          padding: 8px;
          min-width: 0;
        }
        .piano-receipt-line-total {
          display: grid;
          gap: 4px;
          justify-items: end;
          align-content: end;
          min-width: 0;
        }
        .piano-receipt-actions {
          position: sticky;
          bottom: 0;
          z-index: 1;
          display: flex;
          gap: 8px;
          padding-top: 8px;
          background: linear-gradient(to bottom, rgba(28,26,26,0), rgba(28,26,26,0.92) 20px, rgba(28,26,26,0.96));
        }
        .piano-receipt-cancel-btn {
          flex: 1;
          border-color: ${COLORS.border};
          background: transparent;
          color: ${COLORS.muted};
        }
        .piano-receipt-save-btn {
          flex: 1;
          border-color: rgba(184,56,56,0.56);
          background: rgba(184,56,56,0.22);
          color: #f0d8d8;
        }
        .piano-error {
          border: 1px solid rgba(184,56,56,0.45);
          background: rgba(184,56,56,0.12);
          border-radius: 8px;
          padding: 12px;
          color: #f0d8d8;
          font-size: 12px;
          white-space: pre-wrap;
        }
        .piano-sheet-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(6,6,8,0.86);
          display: flex;
          justify-content: center;
          color: ${COLORS.ink};
          font-family: Lato, Helvetica, Arial, sans-serif;
        }
        .piano-sheet {
          width: min(760px, 100vw);
          height: 100dvh;
          background: #121214;
          border-left: 1px solid ${COLORS.border};
          border-right: 1px solid ${COLORS.border};
          display: flex;
          flex-direction: column;
        }
        .piano-sheet-bar {
          position: sticky;
          top: 0;
          z-index: 2;
          min-height: 56px;
          border-bottom: 1px solid ${COLORS.border};
          background: rgba(18,18,20,0.98);
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 8px;
          padding: max(8px, env(safe-area-inset-top)) 12px 8px;
        }
        .piano-sheet-bar strong {
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 24px;
          line-height: 1;
        }
        .piano-sheet-bar button {
          min-height: 44px;
          border: 1px solid rgba(184,56,56,0.45);
          background: rgba(184,56,56,0.14);
          color: #f0d8d8;
          border-radius: 8px;
          padding: 0 12px;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .piano-sheet-bar button:first-child {
          justify-self: start;
          background: transparent;
          border-color: ${COLORS.border};
          color: ${COLORS.muted};
        }
        .piano-sheet-bar button:last-child {
          justify-self: end;
        }
        .piano-sheet-bar button:disabled,
        .piano-sheet-section-head button:disabled,
        .piano-remove-line:disabled {
          opacity: 0.54;
          cursor: not-allowed;
        }
        .piano-sheet-body {
          overflow-y: auto;
          padding: 14px;
          display: grid;
          gap: 12px;
          min-width: 0;
        }
        .piano-draft-banner {
          border: 1px solid rgba(215,165,72,0.42);
          background: ${COLORS.amberDim};
          color: #f2d491;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 900;
        }
        .piano-validation {
          border: 1px solid rgba(184,56,56,0.48);
          background: rgba(184,56,56,0.12);
          color: #f0d8d8;
          border-radius: 8px;
          padding: 10px 12px;
          display: grid;
          gap: 4px;
          font-size: 12px;
        }
        .piano-field {
          display: grid;
          gap: 6px;
          min-width: 0;
        }
        .piano-field span,
        .piano-sheet-section-head span,
        .piano-line-title {
          color: ${COLORS.muted};
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .piano-field input,
        .piano-field select,
        .piano-field textarea {
          min-height: 44px;
          width: 100%;
          box-sizing: border-box;
          border: 1px solid ${COLORS.border};
          background: rgba(255,255,255,0.045);
          color: ${COLORS.ink};
          border-radius: 8px;
          padding: 10px 11px;
          font: inherit;
          font-size: 14px;
          outline: none;
        }
        .piano-field textarea {
          min-height: 92px;
          resize: vertical;
        }
        .piano-sheet-section {
          display: grid;
          gap: 10px;
          min-width: 0;
        }
        .piano-sheet-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .piano-sheet-section-head button,
        .piano-add-line,
        .piano-remove-line {
          min-height: 44px;
          border: 1px solid ${COLORS.border};
          background: rgba(255,255,255,0.04);
          color: ${COLORS.ink};
          border-radius: 8px;
          padding: 0 12px;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        .piano-lines-editor {
          display: grid;
          gap: 10px;
          min-width: 0;
        }
        .piano-line-editor {
          border: 1px solid ${COLORS.border};
          background: rgba(255,255,255,0.035);
          border-radius: 8px;
          padding: 10px;
          display: grid;
          gap: 9px;
          min-width: 0;
        }
        .piano-line-numbers {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 9px;
          min-width: 0;
        }
        .piano-add-line {
          border-color: rgba(184,56,56,0.42);
          color: #f0d8d8;
          background: rgba(184,56,56,0.10);
        }
        @media (max-width: 980px) {
          .piano-grid {
            grid-template-columns: 1fr;
          }
          .piano-grid-has-detail {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .piano-shell {
            gap: 9px;
          }
          .piano-hero {
            padding: 8px 10px;
            align-items: flex-start;
            flex-direction: column;
          }
          .piano-title {
            font-size: 21px;
          }
          .piano-subtitle {
            font-size: 11px;
          }
          .piano-meta {
            width: 100%;
            justify-content: flex-start;
            gap: 5px;
          }
          .piano-chip {
            font-size: 10px;
            padding: 4px 7px;
          }
          .piano-cards {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .piano-card {
            padding: 10px;
            min-height: 230px;
          }
          .piano-card h3 {
            font-size: 20px;
          }
          .piano-contact-grid {
            grid-template-columns: 44px minmax(0, 1fr);
            gap: 4px 7px;
            font-size: 10.5px;
            margin-bottom: 7px;
          }
          .piano-note {
            padding: 6px 7px;
            font-size: 10.5px;
            margin-bottom: 7px;
          }
          .piano-empty {
            padding: 7px;
            font-size: 11px;
          }
          .piano-receipt-edit-line {
            grid-template-columns: 1fr 1fr;
          }
          .piano-receipt-line-total {
            grid-column: 1 / -1;
            justify-items: start;
          }
          .piano-receipt-actions {
            flex-direction: column;
          }
          .piano-sheet-body {
            padding: 10px;
          }
          .piano-line-numbers {
            grid-template-columns: 1fr;
          }
          .piano-sheet-section-head {
            align-items: stretch;
            flex-direction: column;
          }
          .piano-sheet-section-head button {
            width: 100%;
          }
        }
      `}</style>

      <div className="piano-hero">
        <div>
          <h2 className="piano-title">Music Lessons</h2>
          <p className="piano-subtitle">Students and invoices from FinanceMind.</p>
        </div>
        <div className="piano-meta">
          <button type="button" className="piano-new-btn" onClick={() => {
            setDraftStudentId("");
            setDraftOpen(true);
          }}>+ New invoice</button>
        </div>
      </div>

      {error && <div className="piano-error">{error}</div>}
      {loading && <div className="piano-empty">Loading Music Lessons...</div>}

      {!loading && (
        <div className={`piano-grid${hasSelectedInvoice ? " piano-grid-has-detail" : ""}`}>
          <div className="piano-cards">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                invoices={invoicesByStudent.get(student.id) || []}
                onInvoiceSelect={selectInvoice}
                onNewInvoice={handleNewInvoiceClick}
              />
            ))}
          </div>
          {selectedInvoice && (
            <ReceiptPreview
              invoice={selectedInvoice}
              lines={selectedLines}
              student={selectedStudent}
              logoFailed={logoFailed}
              setLogoFailed={setLogoFailed}
              editingLines={editingLines}
              onEditStart={handleEditStart}
              onEditCancel={handleEditCancel}
              onEditFieldChange={handleEditFieldChange}
              onSaveChanges={handleSaveChanges}
              editError={editError}
              showSaveToast={showSaveToast}
              savingChanges={savingChanges}
            />
          )}
        </div>
      )}

      <div style={{ color: COLORS.muted, fontSize: 10, lineHeight: 1.4 }}>
        Contact: {BRAND_EMAIL}
      </div>

      <DraftInvoiceSheet
        open={draftOpen}
        initialStudentId={draftStudentId}
        students={students}
        invoicesByStudent={invoicesByStudent}
      onClose={() => {
        setDraftOpen(false);
        setDraftStudentId("");
      }}
        onSaved={handleDraftSaved}
        onError={setError}
        fetchInvoiceDetail={fetchInvoiceDetail}
      />
    </section>
  );
}
