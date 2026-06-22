import React, { useId } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Loader2,
  Menu,
  Plus,
  Search,
  Upload,
  UserRound,
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

export function MobileScreenShell({ children, bottomNav, className = "", labelledBy }) {
  return (
    <div className={`mobile-shell ${bottomNav ? "has-bottom-nav" : ""} ${className}`.trim()} aria-labelledby={labelledBy}>
      <div className="mobile-shell-inner">{children}</div>
      {bottomNav}
    </div>
  );
}

export function MobileHeader({
  eyebrow,
  title,
  subtitle,
  avatar,
  onBack,
  onMenu,
  onNotifications,
  actions,
}) {
  return (
    <header className="mobile-header">
      <div className="mobile-header-row">
        <div className="mobile-header-leading">
          {onBack ? <IconButton label="Go back" icon={ChevronLeft} variant="ghost" onClick={onBack} /> : null}
          {onMenu ? <IconButton label="Open menu" icon={Menu} variant="ghost" onClick={onMenu} /> : null}
        </div>
        <div className="mobile-header-title">
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="mobile-header-actions">
          {actions}
          {onNotifications ? <IconButton label="Notifications" icon={Bell} variant="ghost" onClick={onNotifications} /> : null}
          {avatar ? <div className="mobile-avatar" aria-label={avatar.label}>{avatar.image ? <img src={avatar.image} alt="" /> : <span>{avatar.initials}</span>}</div> : null}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({ items = [], active, onChange, label = "Primary mobile navigation" }) {
  const defaultIcons = [Home, FileText, Plus, Search, UserRound];
  return (
    <nav className="mobile-bottom-nav" aria-label={label}>
      {items.map((item, index) => {
        const Icon = item.icon || defaultIcons[index] || Home;
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={selected ? "active" : ""}
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange?.(item.id)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function MobileHeroCard({ label, value, note, actionLabel, onAction, tone = "green", children }) {
  return (
    <section className={`mobile-hero-card ${tone}`} aria-label={`${label}: ${value}${note ? `. ${note}` : ""}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      ) : null}
      {children}
    </section>
  );
}

export function MobileMetricCard({ label, value, note, icon: Icon = CheckCircle2, tone = "green" }) {
  return (
    <section className={`mobile-metric-card ${tone}`} aria-label={`${label}: ${value}${note ? `. ${note}` : ""}`}>
      {Icon ? <span className="mobile-icon-disc"><Icon size={17} aria-hidden="true" /></span> : null}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </section>
  );
}

export function MobileActionTile({ label, icon: Icon = Plus, tone = "green", onClick, disabled = false }) {
  return (
    <button type="button" className={`mobile-action-tile ${tone}`} onClick={onClick} disabled={disabled}>
      <span className="mobile-icon-disc"><Icon size={18} aria-hidden="true" /></span>
      <strong>{label}</strong>
    </button>
  );
}

export function MobileListCard({ title, subtitle, meta, value, status, icon: Icon = UserRound, actionLabel = "View details", onAction }) {
  return (
    <article className="mobile-list-card">
      <span className="mobile-list-icon"><Icon size={18} aria-hidden="true" /></span>
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {status ? <Badge tone={status.tone || "gray"} text={status.label} /> : null}
      </div>
      <div className="mobile-list-side">
        {value ? <strong>{value}</strong> : null}
        {meta ? <small>{meta}</small> : null}
        {onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
      </div>
    </article>
  );
}

export function MobileStepper({ steps = [], active = 0, label = "Progress" }) {
  return (
    <ol className="mobile-stepper" aria-label={label}>
      {steps.map((step, index) => (
        <li key={step} className={index < active ? "done" : index === active ? "active" : ""}>
          <span>{index + 1}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

export function MobileUploadCard({ label, fileName, status = "Required", onChooseFile, disabled = false }) {
  return (
    <section className="mobile-upload-card" aria-label={`${label}. ${status}`}>
      <span className="mobile-icon-disc"><Upload size={18} aria-hidden="true" /></span>
      <div>
        <strong>{label}</strong>
        <small>{fileName || status}</small>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onChooseFile} disabled={disabled}>Choose</Button>
    </section>
  );
}

export function MobileStickyActionBar({
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  secondaryDisabled = false,
  loading = false,
}) {
  return (
    <div className="mobile-sticky-actions">
      {secondaryLabel ? <Button type="button" variant="secondary" onClick={onSecondary} disabled={secondaryDisabled || loading}>{secondaryLabel}</Button> : null}
      <Button type="button" onClick={onPrimary} disabled={primaryDisabled} loading={loading}>{primaryLabel}</Button>
    </div>
  );
}
