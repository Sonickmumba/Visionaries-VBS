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
import { useNotificationUnread } from "../../contexts/NotificationUnreadContext.jsx";
import "../../styles/design-system.css";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const buttonToneClasses = {
  primary: "bg-emerald text-cream border-emerald hover:bg-forest",
  secondary: "bg-cream text-charcoal border-mist hover:border-emerald",
  danger: "bg-alert text-cream border-alert hover:bg-alert",
  ghost: "bg-transparent text-inherit border-transparent shadow-none",
};

const badgeToneClasses = {
  green: "bg-cream text-emerald",
  blue: "bg-mist text-emerald",
  amber: "bg-cream text-gold",
  red: "bg-cream text-alert",
  gray: "bg-mist text-charcoal",
  purple: "bg-cream text-emerald",
};

const cardToneClasses = {
  green: "border-l-emerald text-emerald",
  blue: "border-l-emerald text-emerald",
  teal: "border-l-emerald text-emerald",
  amber: "border-l-gold text-gold",
  red: "border-l-alert text-alert",
};

const mobileToneClasses = {
  green: "text-emerald",
  blue: "text-emerald",
  amber: "text-gold",
  purple: "text-emerald",
  red: "text-alert",
};

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
      className={cn(
        `btn ${variant}`,
        "inline-flex items-center justify-center gap-2 rounded-app border font-extrabold leading-none transition disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "btn-sm min-h-8 px-2.5 py-1.5 text-[13px]" : "min-h-10 px-4 py-2 text-sm",
        buttonToneClasses[variant] || buttonToneClasses.primary,
        loading && "is-loading cursor-progress",
        className,
      )}
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
      className={cn(
        `icon-btn ${variant}`,
        "inline-grid h-10 w-10 place-items-center rounded-app border transition disabled:cursor-not-allowed disabled:opacity-60",
        buttonToneClasses[variant] || buttonToneClasses.secondary,
        loading && "is-loading cursor-progress",
        className,
      )}
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
    <label className={cn("field grid gap-1.5", error && "has-error", className)}>
      <span className="field-label flex items-center justify-between gap-2 text-xs font-extrabold uppercase text-charcoal">
        <span>{label}</span>
        {required ? <span className="field-required text-alert" aria-label="required">*</span> : null}
      </span>
      {typeof children === "function" ? children({ describedBy: descriptionIds }) : children}
      {hint && !error ? <small id={hintId} className="field-hint text-xs font-bold text-charcoal">{hint}</small> : null}
      {error ? <small id={errorId} className="field-error flex items-start gap-1 text-xs font-bold text-alert"><AlertCircle size={13} aria-hidden="true" />{error}</small> : null}
    </label>
  );
}

export function Input({ label, value, onChange, error, hint, required, className, icon: _Icon, ...props }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className} describedBy={props["aria-describedby"]}>
      {({ describedBy }) => (
        <input
          className="min-h-10 rounded-app border border-mist bg-cream px-3 py-2 text-charcoal transition focus:border-emerald focus:outline-none"
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
          className="min-h-10 rounded-app border border-mist bg-cream px-3 py-2 text-charcoal transition focus:border-emerald focus:outline-none"
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
        <div className="currency-input grid min-h-10 grid-cols-[auto_1fr] items-center overflow-hidden rounded-app border border-mist bg-cream transition focus-within:border-emerald">
          <span className="grid min-h-10 place-items-center border-r border-mist bg-mist px-3 text-charcoal" aria-hidden="true">{currency}</span>
          <input
            className="min-h-10 border-0 bg-cream px-3 py-2 text-charcoal focus:outline-none"
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
          className="rounded-app border border-mist bg-cream px-3 py-2 text-charcoal transition focus:border-emerald focus:outline-none"
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
  return (
    <span
      className={cn(`badge ${tone}`, "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold uppercase", badgeToneClasses[tone] || badgeToneClasses.blue)}
      aria-label={typeof (children ?? text) === "string" ? children ?? text : undefined}
    >
      {children ?? text}
    </span>
  );
}

export function Card({ title, value, note, tone = "green", icon: Icon = CheckCircle2, children }) {
  return (
    <section className={cn(`metric ${tone}`, "rounded-app border border-mist border-l-[5px] bg-cream p-4 shadow-soft", cardToneClasses[tone] || cardToneClasses.green)} aria-label={`${title}: ${value}${note ? `. ${note}` : ""}`}>
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
    <div className="table-wrap overflow-x-auto rounded-app border border-mist" role="region" aria-label={caption || "Data table"} tabIndex="0">
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
    <div className="tabs inline-flex flex-wrap gap-1 rounded-app border border-mist bg-cream p-1" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const item = typeof tab === "string" ? { id: tab, label: tab } : tab;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            tabIndex={active === item.id ? 0 : -1}
            className={cn("rounded-app px-3 py-2 text-sm font-extrabold text-charcoal transition", active === item.id ? "active bg-emerald text-cream" : "hover:bg-mist")}
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
      <section className={cn(`ui-modal ${size}`, "rounded-app border border-mist bg-cream shadow-lift")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close dialog" icon={X} onClick={onClose} />
        </header>
        <div className="ui-modal-body p-4">{children}</div>
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
      <aside className={cn(`ui-drawer ${side}`, "border border-mist bg-cream shadow-lift")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close drawer" icon={X} onClick={onClose} />
        </header>
        <div className="ui-drawer-body p-4">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function Alert({ tone = "info", title, children }) {
  return (
    <div className={cn(`ui-alert ${tone}`, "flex items-start gap-2.5 rounded-mobile border p-3.5 shadow-soft", tone === "danger" ? "border-alert bg-cream text-alert" : tone === "success" ? "border-emerald bg-cream text-emerald" : tone === "warning" ? "border-gold bg-cream text-gold" : "border-mist bg-mist text-charcoal")} role={tone === "danger" ? "alert" : "status"} aria-live={tone === "danger" ? "assertive" : "polite"}>
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
    <ol className="ui-stepper grid list-none gap-2 p-0">
      {steps.map((step, index) => (
        <li key={step} className={cn("rounded-app border border-mist bg-cream p-2.5", index < active ? "done" : index === active ? "active" : "")}>
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
    <nav className="ui-pagination flex items-center justify-end gap-2.5" aria-label="Pagination">
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
  const titleId = useId();
  const messageId = useId();
  return (
    <section className="ui-empty grid place-items-center gap-3 rounded-mobile border border-dashed border-emerald bg-cream p-6 text-center text-charcoal" aria-live="polite" aria-labelledby={titleId} aria-describedby={messageId}>
      <span className="ui-empty-icon grid h-12 w-12 place-items-center rounded-mobile bg-mist text-emerald"><Search size={24} aria-hidden="true" /></span>
      <div className="ui-empty-copy grid gap-1.5">
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
      </div>
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </section>
  );
}

export function Skeleton({ lines = 3, label = "Loading content" }) {
  return (
    <div className="ui-skeleton grid gap-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, index) => <span className="block h-4 rounded-full bg-mist" key={index} />)}
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
    <div className={cn(`mobile-shell ${bottomNav ? "has-bottom-nav" : ""}`, "min-h-screen bg-cream text-charcoal", className)} aria-labelledby={labelledBy}>
      <div className="mobile-shell-inner mx-auto grid w-full max-w-[480px] gap-3.5 px-3.5 py-3.5">{children}</div>
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
    <header className="mobile-header pt-[env(safe-area-inset-top)]">
      <div className="mobile-header-row grid min-h-[54px] grid-cols-[auto_1fr_auto] items-center gap-2">
        <div className="mobile-header-leading flex min-h-10 w-10 items-center gap-1">
          {onBack ? <IconButton label="Go back" icon={ChevronLeft} variant="ghost" onClick={onBack} /> : null}
          {onMenu ? <IconButton label="Open menu" icon={Menu} variant="ghost" onClick={onMenu} /> : null}
        </div>
        <div className="mobile-header-title min-w-0">
          {eyebrow ? <span>{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="mobile-header-actions flex items-center gap-1.5">
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
  const { unreadCount } = useNotificationUnread();
  return (
    <nav className="mobile-bottom-nav fixed bottom-2 left-1/2 z-30 grid min-h-[66px] w-[min(452px,calc(100vw-20px))] -translate-x-1/2 grid-cols-[repeat(auto-fit,minmax(54px,1fr))] gap-1 rounded-[24px] border border-mist bg-cream/95 p-2 shadow-lift" aria-label={label}>
      {items.map((item, index) => {
        const Icon = item.icon || defaultIcons[index] || Home;
        const selected = active === item.id;
        const badge = item.badge ?? (String(item.id).includes("notification") ? unreadCount : 0);
        return (
          <button
            key={item.id}
            type="button"
            className={cn("grid min-h-[50px] min-w-0 place-items-center gap-0.5 rounded-2xl border-0 bg-transparent text-[11px] font-extrabold text-charcoal", selected ? "active bg-gradient-to-b from-emerald to-forest text-cream" : "")}
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange?.(item.id)}
          >
            <span className="mobile-nav-icon-wrap">
              <Icon size={19} aria-hidden="true" />
              {badge > 0 ? <span className="mobile-nav-badge" aria-label={`${badge} unread notifications`}>{badge > 99 ? "99+" : badge}</span> : null}
            </span>
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function MobileHeroCard({ label, value, note, actionLabel, onAction, tone = "green", children }) {
  return (
    <section className={cn(`mobile-hero-card ${tone}`, "flex min-h-[118px] items-end justify-between gap-3.5 overflow-hidden rounded-mobile border border-mist bg-gradient-to-br from-forest to-emerald p-4 text-cream shadow-soft")} aria-label={`${label}: ${value}${note ? `. ${note}` : ""}`}>
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
    <section className={cn(`mobile-metric-card ${tone}`, "flex min-h-[92px] items-start gap-2.5 rounded-mobile border border-mist bg-cream p-3 shadow-soft")} aria-label={`${label}: ${value}${note ? `. ${note}` : ""}`}>
      {Icon ? <span className={cn("mobile-icon-disc grid h-8 w-8 place-items-center rounded-full bg-cream", mobileToneClasses[tone] || mobileToneClasses.green)}><Icon size={17} aria-hidden="true" /></span> : null}
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
    <button type="button" className={cn(`mobile-action-tile ${tone}`, "grid min-h-20 place-items-center content-center gap-2 rounded-mobile border border-mist bg-cream p-3 text-center text-xs font-extrabold text-charcoal shadow-soft disabled:opacity-60")} onClick={onClick} disabled={disabled}>
      <span className={cn("mobile-icon-disc grid h-8 w-8 place-items-center rounded-full bg-cream", mobileToneClasses[tone] || mobileToneClasses.green)}><Icon size={18} aria-hidden="true" /></span>
      <strong>{label}</strong>
    </button>
  );
}

export function MobileListCard({ title, subtitle, meta, value, status, icon: Icon = UserRound, actionLabel = "View details", onAction }) {
  return (
    <article className="mobile-list-card grid min-h-[74px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-mobile border border-mist bg-cream p-3 shadow-soft">
      <span className="mobile-list-icon grid h-8 w-8 place-items-center rounded-full bg-cream text-emerald"><Icon size={18} aria-hidden="true" /></span>
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
    <ol className="mobile-stepper grid list-none gap-2 p-0" aria-label={label}>
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
    <section className="mobile-upload-card grid min-h-[68px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-mobile border border-mist bg-cream p-3 shadow-soft" aria-label={`${label}. ${status}`}>
      <span className="mobile-icon-disc grid h-8 w-8 place-items-center rounded-full bg-cream text-emerald"><Upload size={18} aria-hidden="true" /></span>
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
    <div className="mobile-sticky-actions sticky bottom-0 z-10 grid gap-2">
      {secondaryLabel ? <Button type="button" variant="secondary" onClick={onSecondary} disabled={secondaryDisabled || loading}>{secondaryLabel}</Button> : null}
      <Button type="button" onClick={onPrimary} disabled={primaryDisabled} loading={loading}>{primaryLabel}</Button>
    </div>
  );
}
