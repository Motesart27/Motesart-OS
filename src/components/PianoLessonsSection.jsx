import { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://deployable-python-codebase-som-production.up.railway.app";

const BRAND_EMAIL = "schoolofmotesart@gmail.com";
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

function money(value) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function hasValue(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function StudentCard({ student, invoices, onInvoiceSelect }) {
  const missing = ["email", "phone", "address"].filter((field) => !hasValue(student[field]));
  const incomplete = missing.length > 0;

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
        <strong>{student.address || "Missing"}</strong>
      </div>

      {student.notes && <div className="piano-note">{student.notes}</div>}

      <div className="piano-card-footer">
        <div>
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

function ReceiptPreview({ invoice, lines, logoFailed, setLogoFailed }) {
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
      <div className="piano-receipt-lines">
        {lines.map((line) => (
          <div key={line.id}>
            <span>{line.description || "Lesson"}</span>
            <strong>{money(line.line_total)}</strong>
          </div>
        ))}
      </div>
      <div className="piano-receipt-total">
        <span>Total</span>
        <strong>{money(invoice.total)}</strong>
      </div>
      <button type="button" disabled>Generate PDF · coming next</button>
      <button type="button" disabled>Send via email · coming next</button>
    </aside>
  );
}

export default function PianoLessonsSection() {
  const [students, setStudents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedLines, setSelectedLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
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
    try {
      const detail = await fetchJson(`/api/piano/invoices/${invoice.id}`);
      setSelectedInvoice(flattenRecord(detail.invoice));
      setSelectedLines(unwrapList(detail.lines).map(flattenRecord));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="piano-shell" aria-label="Piano Lessons">
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
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .piano-title {
          margin: 0;
          font-family: "Cormorant Garamond", Georgia, serif;
          font-size: 28px;
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
        .piano-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 14px;
          align-items: start;
        }
        .piano-cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .piano-card {
          min-width: 0;
          border: 1px solid ${COLORS.border};
          background: ${COLORS.panel};
          border-radius: 8px;
          padding: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
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
        .piano-receipt-lines {
          display: grid;
          gap: 6px;
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
        .piano-error {
          border: 1px solid rgba(184,56,56,0.45);
          background: rgba(184,56,56,0.12);
          border-radius: 8px;
          padding: 12px;
          color: #f0d8d8;
          font-size: 12px;
          white-space: pre-wrap;
        }
        @media (max-width: 980px) {
          .piano-grid {
            grid-template-columns: 1fr;
          }
          .piano-receipt {
            display: none;
          }
        }
        @media (max-width: 720px) {
          .piano-shell {
            gap: 9px;
          }
          .piano-hero {
            padding: 10px;
            align-items: flex-start;
          }
          .piano-title {
            font-size: 22px;
          }
          .piano-subtitle {
            font-size: 11px;
          }
          .piano-meta {
            flex-direction: column;
            align-items: flex-end;
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
        }
      `}</style>

      <div className="piano-hero">
        <div>
          <h2 className="piano-title">Piano Lessons</h2>
          <p className="piano-subtitle">Read-only student roster and receipt shell from FinanceMind Airtable.</p>
        </div>
        <div className="piano-meta">
          <span className="piano-chip">{students.length} real students</span>
          <span className="piano-chip">{invoices.length} invoices</span>
        </div>
      </div>

      {error && <div className="piano-error">{error}</div>}
      {loading && <div className="piano-empty">Loading Piano Lessons...</div>}

      {!loading && (
        <div className="piano-grid">
          <div className="piano-cards">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                invoices={invoicesByStudent.get(student.id) || []}
                onInvoiceSelect={selectInvoice}
              />
            ))}
          </div>
          <ReceiptPreview
            invoice={selectedInvoice}
            lines={selectedLines}
            logoFailed={logoFailed}
            setLogoFailed={setLogoFailed}
          />
        </div>
      )}

      <div style={{ color: COLORS.muted, fontSize: 10, lineHeight: 1.4 }}>
        Contact: {BRAND_EMAIL}
      </div>
    </section>
  );
}
