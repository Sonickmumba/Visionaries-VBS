import React, { useId } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import "../../styles/design-system.css";

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  type = "submit",
  className = "",
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn ${variant} ${size === "sm" ? "btn-sm" : ""} ${loading ? "is-loading" : ""} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon = Search,
  variant = "secondary",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`icon-btn ${variant} ${loading ? "is-loading" : ""} ${className}`.trim()}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 size={17} className="spin" aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
    </button>
  );
}

function FieldShell({ label, hint, error, required, children, className = "", describedBy }) {
  const id = useId();
  const hintId = hint && !error ? `${id}-hint` : "";
  const errorId = error ? `${id}-error` : "";
  const descriptionIds = [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <label className={`field ${error ? "has-error" : ""} ${className}`.trim()}>
      <span>{label}{required ? " *" : ""}</span>
      {typeof children === "function" ? children({ describedBy: descriptionIds }) : children}
      {hint && !error ? <small id={hintId} className="field-hint">{hint}</small> : null}
      {error ? <small id={errorId} className="field-error">{error}</small> : null}
    </label>
  );
}

export function Input({ label, value, onChange, error, hint, required, className, icon: _Icon, ...props }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} describedBy={props["aria-describedby"]}>
      {({ describedBy }) => (
        <input
          value={value ?? ""}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          required={required || undefined}
          onChange={(event) => onChange?.(event.target.value, event)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export const Field = Input;

export function Select({ label, value, onChange, options = [], placeholder, error, hint, required, className, ...props }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} describedBy={props["aria-describedby"]}>
      {({ describedBy }) => (
        <select
          value={value ?? ""}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          required={required || undefined}
          onChange={(event) => onChange?.(event.target.value, event)}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => {
            const item = typeof option === "string" ? { value: option, label: option } : option;
            return <option key={item.value} value={item.value}>{item.label}</option>;
          })}
        </select>
      )}
    </FieldShell>
  );
}

export function DateInput(props) {
  return <Input type="date" {...props} />;
}

export function CurrencyInput({ value, onChange, currency = "K", min = "0", step = "0.01", label, hint, error, required, className, ...props }) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className} describedBy={props["aria-describedby"]}>
      {({ describedBy }) => (
        <div className="currency-input">
          <span aria-hidden="true">{currency}</span>
          <input
            type="number"
            min={min}
            step={step}
            value={value ?? ""}
            aria-label={label}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            required={required || undefined}
            onChange={(event) => onChange?.(event.target.value, event)}
            {...props}
          />
        </div>
      )}
    </FieldShell>
  );
}

export function Textarea({ label, value, onChange, error, hint, required, rows = 4, className, ...props }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} describedBy={props["aria-describedby"]}>
      {({ describedBy }) => (
        <textarea
          rows={rows}
          value={value ?? ""}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          required={required || undefined}
          onChange={(event) => onChange?.(event.target.value, event)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function Badge({ text, children, tone = "blue" }) {
  return <span className={`badge ${tone}`.trim()} aria-label={typeof (children ?? text) === "string" ? children ?? text : undefined}>{children ?? text}</span>;
}

export function Card({ title, value, note, tone = "green", icon: Icon = CheckCircle2, children }) {
  return (
    <section className={`metric ${tone}`} aria-label={`${title}: ${value}${note ? `. ${note}` : ""}`}>
      {Icon ? <Icon size={20} aria-hidden="true" /> : null}
      <span>{title}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
      {children}
    </section>
  );
}

export function DataTable({ columns, rows, empty = "No records found.", caption }) {
  return (
    <div className="table-wrap" role="region" aria-label={caption || "Data table"} tabIndex="0">
      <table>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, i) => <td key={i} data-label={columns[i]}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const Table = DataTable;

export function Tabs({ tabs, active, onChange, label = "Tabs" }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const item = typeof tab === "string" ? { id: tab, label: tab } : tab;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            tabIndex={active === item.id ? 0 : -1}
            className={active === item.id ? "active" : ""}
            onClick={() => onChange?.(item.id)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const currentIndex = tabs.findIndex((candidate) => (typeof candidate === "string" ? candidate : candidate.id) === item.id);
              const nextIndex = event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : event.key === "ArrowRight"
                    ? (currentIndex + 1) % tabs.length
                    : (currentIndex - 1 + tabs.length) % tabs.length;
              const next = tabs[nextIndex];
              onChange?.(typeof next === "string" ? next : next.id);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, title, children, footer, onClose, size = "md" }) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="ui-overlay" role="presentation">
      <section className={`ui-modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close dialog" icon={X} onClick={onClose} />
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </div>
  );
}

export function Drawer({ open, title, children, footer, onClose, side = "right" }) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="ui-overlay" role="presentation">
      <aside className={`ui-drawer ${side}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close drawer" icon={X} onClick={onClose} />
        </header>
        <div className="ui-drawer-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function Alert({ tone = "info", title, children }) {
  return (
    <div className={`ui-alert ${tone}`} role={tone === "danger" ? "alert" : "status"} aria-live={tone === "danger" ? "assertive" : "polite"}>
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        {title ? <strong>{title}</strong> : null}
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

export const Toast = Alert;

export function Stepper({ steps = [], active = 0 }) {
  return (
    <ol className="ui-stepper">
      {steps.map((step, index) => (
        <li key={step} className={index < active ? "done" : index === active ? "active" : ""}>
          <span>{index + 1}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

export function Pagination({ page = 1, totalPages = 1, onPageChange, disabled = false }) {
  const safeTotal = Math.max(1, Number(totalPages || 1));
  return (
    <nav className="ui-pagination" aria-label="Pagination">
      <IconButton
        label="Previous page"
        icon={ChevronLeft}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange?.(page - 1)}
      />
      <span>Page {page} of {safeTotal}</span>
      <IconButton
        label="Next page"
        icon={ChevronRight}
        disabled={disabled || page >= safeTotal}
        onClick={() => onPageChange?.(page + 1)}
      />
    </nav>
  );
}

export function EmptyState({ title = "No records found", message = "There is nothing to show yet.", action }) {
  return (
    <section className="ui-empty" aria-live="polite">
      <Search size={24} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </section>
  );
}

export function Skeleton({ lines = 3 }) {
  return (
    <div className="ui-skeleton" role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => <span key={index} />)}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = "Confirm action",
  message,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={(
        <div className="button-row">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={!String(reason || "").trim()} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      )}
    >
      {message ? <p className="muted">{message}</p> : null}
      <Textarea label="Reason" value={reason} onChange={onReasonChange} required placeholder="Enter the audit reason" />
    </Modal>
  );
}
