import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ClipboardList,
  Edit3,
  Mail,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import "../../styles/members.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateOnly = (value) => value ? String(value).slice(0, 10) : "-";

const DEFAULT_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  memberCode: "",
  nationalId: "",
  address: "",
  temporaryPassword: "Password123!",
};

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function initials(member) {
  return memberName(member)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";
}

function badgeTone(status) {
  if (status === "APPROVED" || status === "ACTIVE") return "green";
  if (status === "SUBMITTED" || status === "LATE") return "amber";
  if (status === "MISSED" || status === "INACTIVE") return "red";
  return "gray";
}

function memberFormFromRecord(member) {
  if (!member) return { ...DEFAULT_FORM };
  return {
    firstName: member.first_name || "",
    lastName: member.last_name || "",
    phone: member.phone || "",
    email: member.email || "",
    memberCode: member.member_code || "",
    nationalId: member.national_id || "",
    address: member.address || "",
    temporaryPassword: "",
  };
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

export function validateMemberForm(form, { editing = false } = {}) {
  const errors = {};
  if (isBlank(form.firstName)) errors.firstName = "First name is required.";
  if (isBlank(form.lastName)) errors.lastName = "Last name is required.";
  if (!isBlank(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Enter a valid email address.";
  if (!editing && !isBlank(form.email) && String(form.temporaryPassword || "").length < 10) {
    errors.temporaryPassword = "Temporary password must be at least 10 characters.";
  }
  return errors;
}

export function memberPayload(form, { editing = false } = {}) {
  const payload = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: isBlank(form.phone) ? null : form.phone.trim(),
    email: isBlank(form.email) ? null : form.email.trim().toLowerCase(),
    memberCode: isBlank(form.memberCode) ? null : form.memberCode.trim(),
    nationalId: isBlank(form.nationalId) ? null : form.nationalId.trim(),
    address: isBlank(form.address) ? null : form.address.trim(),
  };
  if (!editing && payload.email) payload.temporaryPassword = form.temporaryPassword || "Password123!";
  return payload;
}

export async function saveMemberForm({ form, selectedMember = null, memberApi = api }) {
  const editing = Boolean(selectedMember);
  const errors = validateMemberForm(form, { editing });
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  const payload = memberPayload(form, { editing });
  if (editing) return memberApi(`/members/${selectedMember.id}`, { method: "PATCH", body: payload });
  return memberApi("/members", { method: "POST", body: payload });
}

export async function toggleMemberStatus({ member, memberApi = api }) {
  const action = member?.is_active ? "deactivate" : "activate";
  return memberApi(`/members/${member.id}/${action}`, { method: "POST" });
}

export async function enrollMemberInCycle({ memberId, cycleId, memberApi = api }) {
  const errors = {};
  if (!memberId) errors.memberId = "Choose a member.";
  if (!cycleId) errors.cycleId = "Choose a cycle.";
  if (Object.keys(errors).length) {
    const error = new Error("Validation failed");
    error.validationErrors = errors;
    throw error;
  }
  return memberApi("/members/enroll", { method: "POST", body: { memberId, cycleId } });
}

function Metric({ title, value, note, tone, icon }) {
  return <Card title={title} value={value} note={note} tone={tone} icon={icon} />;
}

function MemberForm({ form, setForm, errors, editing }) {
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="member-form">
      <div className="form-grid two">
        <Field label="First name" value={form.firstName} onChange={set("firstName")} error={errors.firstName} required />
        <Field label="Last name" value={form.lastName} onChange={set("lastName")} error={errors.lastName} required />
        <Field label="Phone" value={form.phone} onChange={set("phone")} />
        <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} disabled={editing} />
        <Field label="Member code" value={form.memberCode} onChange={set("memberCode")} />
        <Field label="National ID" value={form.nationalId} onChange={set("nationalId")} />
      </div>
      {!editing ? (
        <Field
          label="Temporary password"
          value={form.temporaryPassword}
          onChange={set("temporaryPassword")}
          error={errors.temporaryPassword}
          hint="Required when creating a member login from email."
        />
      ) : null}
      <Textarea label="Address" value={form.address} onChange={set("address")} rows={3} />
    </div>
  );
}

function MemberDetail({ detail, tab, setTab, onBack, onEdit, onToggle }) {
  const member = detail?.data;
  const transactions = detail?.transactions || [];
  const declarations = detail?.declarations || [];
  const cycleMemberships = detail?.cycleMemberships || [];
  const stats = detail?.declarationStats || {};

  const savings = transactions
    .filter((item) => item.transaction_type === "SAVINGS_DEPOSIT")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const loanIn = transactions
    .filter((item) => ["LOAN_DISBURSEMENT", "LOAN_TOP_UP", "CONVERTED_PENALTY_LOAN"].includes(item.transaction_type))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const repayments = transactions
    .filter((item) => ["PRINCIPAL_REPAYMENT", "LOAN_INTEREST_REPAYMENT"].includes(item.transaction_type))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const penalties = transactions
    .filter((item) => item.transaction_type === "PENALTY_ASSESSMENT")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <Page
      title={member ? memberName(member) : "Member Detail"}
      className="member-detail-page"
      actions={(
        <>
          <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
          <Button type="button" variant="secondary" icon={Edit3} onClick={() => onEdit(member)}>Edit Member</Button>
          <Button type="button" variant={member?.is_active ? "danger" : "secondary"} onClick={() => onToggle(member)}>
            {member?.is_active ? "Deactivate" : "Activate"}
          </Button>
        </>
      )}
    >
      <section className="member-detail-hero" aria-label="Member profile summary">
        <div className="member-avatar large" aria-hidden="true">{initials(member)}</div>
        <div>
          <span>Member Profile</span>
          <h2>{memberName(member)}</h2>
          <p>{member?.member_code || "No member code"} · {member?.phone || "No phone"}</p>
        </div>
        <Badge text={member?.is_active ? "ACTIVE" : "INACTIVE"} tone={member?.is_active ? "green" : "red"} />
      </section>

      <div className="member-detail-mobile-actions mobile-only" aria-label="Member detail quick actions">
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
        <Button type="button" variant="secondary" icon={Edit3} onClick={() => onEdit(member)}>Edit</Button>
        <Button type="button" variant={member?.is_active ? "danger" : "secondary"} onClick={() => onToggle(member)}>
          {member?.is_active ? "Deactivate" : "Activate"}
        </Button>
      </div>

      <section className="member-profile">
        <div>
          <BadgeCheck size={18} aria-hidden="true" />
          <span>Member Code</span>
          <strong>{member?.member_code || "-"}</strong>
        </div>
        <div>
          <Smartphone size={18} aria-hidden="true" />
          <span>Phone</span>
          <strong>{member?.phone || "-"}</strong>
        </div>
        <div>
          <Mail size={18} aria-hidden="true" />
          <span>Email</span>
          <strong>{member?.email || "-"}</strong>
        </div>
        <div>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Status</span>
          <Badge text={member?.is_active ? "ACTIVE" : "INACTIVE"} tone={member?.is_active ? "green" : "red"} />
        </div>
      </section>

      <div className="metrics member-metrics">
        <Metric title="Savings Principal" value={money(savings)} note="Ledger deposits" icon={PiggyBank} />
        <Metric title="Borrowed" value={money(loanIn)} note={`${money(repayments)} repaid`} tone="blue" icon={BadgeCheck} />
        <Metric title="Approved Declarations" value={stats.approved || 0} note={`${stats.awaitingReview || 0} awaiting review`} tone="green" icon={ClipboardList} />
        <Metric title="Penalties" value={money(penalties)} note="Assessed to date" tone="amber" icon={ClipboardList} />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        label="Member detail tabs"
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "cycles", label: "Cycles" },
          { id: "declarations", label: "Declarations" },
          { id: "statement", label: "Statement" },
          { id: "audit", label: "Audit" },
        ]}
      />

      {tab === "overview" ? (
        <section className="panel">
          <h2>Profile</h2>
          <div className="detail-grid">
            <div><strong>National ID</strong><span>{member?.national_id || "-"}</span></div>
            <div><strong>Address</strong><span>{member?.address || "-"}</span></div>
            <div><strong>Created</strong><span>{dateOnly(member?.created_at)}</span></div>
            <div><strong>Updated</strong><span>{dateOnly(member?.updated_at)}</span></div>
          </div>
        </section>
      ) : null}

      {tab === "cycles" ? (
        <DataTable
          columns={["Cycle", "Status", "Joined", "Minimum Borrowing"]}
          rows={cycleMemberships.map((membership) => [
            membership.cycle_name,
            <Badge text={membership.status} tone={badgeTone(membership.status)} />,
            dateOnly(membership.joined_at),
            money(membership.minimum_borrowing_amount),
          ])}
          empty="This member is not enrolled in any cycle."
        />
      ) : null}

      {tab === "declarations" ? (
        <DataTable
          columns={["Cycle", "Month", "Submitted", "Savings", "Loan Request", "Repayment", "Status"]}
          rows={declarations.map((declaration) => [
            declaration.cycle_name,
            declaration.month_number ? `Month ${declaration.month_number}` : "-",
            dateOnly(declaration.submitted_at),
            money(declaration.savings_amount),
            money(Number(declaration.loan_request_amount || 0) + Number(declaration.loan_top_up_amount || 0)),
            money(Number(declaration.principal_repayment_amount || 0) + Number(declaration.loan_interest_repayment_amount || 0)),
            <Badge text={declaration.status} tone={badgeTone(declaration.status)} />,
          ])}
          empty="No declarations found."
        />
      ) : null}

      {tab === "statement" || tab === "audit" ? (
        <DataTable
          columns={["Date", "Type", "Amount", "Description", "Reference"]}
          rows={transactions.map((item) => [
            dateOnly(item.posted_at),
            item.transaction_type,
            money(item.amount),
            item.description || "-",
            item.reference || item.id,
          ])}
          empty="No ledger transactions found."
        />
      ) : null}
    </Page>
  );
}

function MemberCards({ members, busy, onView, onEdit, onEnroll, onToggle }) {
  if (!members.length) return null;
  return (
    <div className="member-mobile-cards" aria-label="Member cards">
      {members.map((member) => (
        <article className="member-card" key={member.id}>
          <div className="member-card-head">
            <div className="member-avatar" aria-hidden="true">{initials(member)}</div>
            <div>
              <strong>{memberName(member)}</strong>
              <span>{member.member_code || "No code"} · {member.phone || "No phone"}</span>
            </div>
            <Badge text={member.is_active ? "ACTIVE" : "INACTIVE"} tone={member.is_active ? "green" : "red"} />
          </div>
          <div className="member-card-values">
            <div>
              <span>Savings</span>
              <strong>{money(member.savings_principal)}</strong>
            </div>
            <div>
              <span>Borrowed</span>
              <strong>{money(member.cumulative_borrowed)}</strong>
            </div>
            <div>
              <span>Declaration</span>
              <Badge text={member.current_declaration_status || "NONE"} tone={badgeTone(member.current_declaration_status)} />
            </div>
          </div>
          <div className="member-card-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => onView(member.id)}>Details</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(member)}>Edit</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onEnroll(member)}>Enroll</Button>
            <Button
              type="button"
              variant={member.is_active ? "danger" : "secondary"}
              size="sm"
              onClick={() => onToggle(member)}
              loading={busy === `toggle-${member.id}`}
            >
              {member.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function MemberManagementPage({
  memberApi = api,
  initialMembers = undefined,
  initialCycles = undefined,
  initialDetail = null,
}) {
  const [members, setMembers] = useState(initialMembers || []);
  const [cycles, setCycles] = useState(initialCycles || []);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(initialMembers === undefined);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [detail, setDetail] = useState(initialDetail);
  const [detailTab, setDetailTab] = useState("overview");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ memberId: "", cycleId: "" });
  const [enrollErrors, setEnrollErrors] = useState({});

  const selectedDetailMember = detail?.data || null;

  async function loadMembers(page = pagination.page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter) params.set("status", statusFilter);
      const response = await memberApi(`/members?${params.toString()}`);
      setMembers(response.data || []);
      setPagination(response.pagination || { page, totalPages: 1 });
    } catch (err) {
      setError(err.message || "Members could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCycles() {
    try {
      const response = await memberApi("/cycles");
      setCycles(response.data || []);
    } catch {
      setCycles([]);
    }
  }

  async function loadDetail(memberId) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await memberApi(`/members/${memberId}`);
      setDetail(response);
      setDetailTab("overview");
    } catch (err) {
      setError(err.message || "Member detail could not load.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (initialMembers === undefined) loadMembers(1);
    if (initialCycles === undefined) loadCycles();
  }, []);

  function openCreate() {
    setSelectedMember(null);
    setForm({ ...DEFAULT_FORM });
    setFormErrors({});
    setFormMode("create");
  }

  function openEdit(member) {
    if (!member) return;
    setSelectedMember(member);
    setForm(memberFormFromRecord(member));
    setFormErrors({});
    setFormMode("edit");
  }

  async function submitMember(event, keepOpen = false) {
    event.preventDefault();
    setBusy("save");
    setMessage("");
    setError("");
    try {
      const response = await saveMemberForm({
        form,
        selectedMember: formMode === "edit" ? selectedMember : null,
        memberApi,
      });
      const saved = response.data || response;
      await loadMembers(formMode === "edit" ? pagination.page : 1);
      if (detail?.data?.id === saved?.id) await loadDetail(saved.id);
      if (keepOpen) {
        setForm({ ...DEFAULT_FORM });
        setFormErrors({});
        setFormMode("create");
      } else {
        setFormMode("");
      }
      setMessage(formMode === "edit" ? "Member updated." : "Member created.");
    } catch (err) {
      if (err.validationErrors) setFormErrors(err.validationErrors);
      else setError(err.message || "Member could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function toggleStatus(member) {
    if (!member?.id) return;
    setBusy(`toggle-${member.id}`);
    setMessage("");
    setError("");
    try {
      await toggleMemberStatus({ member, memberApi });
      await loadMembers(pagination.page);
      if (detail?.data?.id === member.id) await loadDetail(member.id);
      setMessage(member.is_active ? "Member deactivated." : "Member activated.");
    } catch (err) {
      setError(err.message || "Member status could not be changed.");
    } finally {
      setBusy("");
    }
  }

  function openEnroll(member = null) {
    const activeCycle = cycles.find((cycle) => cycle.status === "ACTIVE") || cycles[0];
    setEnrollForm({ memberId: member?.id || "", cycleId: activeCycle?.id || "" });
    setEnrollErrors({});
    setEnrollOpen(true);
  }

  async function submitEnroll(event) {
    event.preventDefault();
    setBusy("enroll");
    setMessage("");
    setError("");
    setEnrollErrors({});
    try {
      await enrollMemberInCycle({
        memberId: enrollForm.memberId,
        cycleId: enrollForm.cycleId,
        memberApi,
      });
      setEnrollOpen(false);
      await loadMembers(pagination.page);
      if (detail?.data?.id === enrollForm.memberId) await loadDetail(enrollForm.memberId);
      setMessage("Member enrolled into cycle.");
    } catch (err) {
      if (err.validationErrors) setEnrollErrors(err.validationErrors);
      else setError(err.message || "Member could not be enrolled.");
    } finally {
      setBusy("");
    }
  }

  const metrics = useMemo(() => {
    const active = members.filter((member) => member.is_active).length;
    const savings = members.reduce((sum, member) => sum + Number(member.savings_principal || 0), 0);
    const borrowed = members.reduce((sum, member) => sum + Number(member.cumulative_borrowed || 0), 0);
    return [
      { title: "Members", value: pagination.total || members.length, note: `${active} active on this page`, icon: Users },
      { title: "Savings Principal", value: money(savings), note: "Visible members", tone: "green", icon: PiggyBank },
      { title: "Borrowed", value: money(borrowed), note: "Cumulative visible borrowing", tone: "blue", icon: BadgeCheck },
      { title: "Declarations", value: members.reduce((sum, member) => sum + Number(member.approved_declarations || 0), 0), note: "Approved visible records", tone: "amber", icon: ClipboardList },
    ];
  }, [members, pagination.total]);

  if (detail || detailLoading) {
    return detailLoading ? (
      <Page title="Member Detail" actions={<Button type="button" variant="secondary" onClick={() => setDetail(null)}>Back</Button>}>
        <Skeleton lines={8} />
      </Page>
    ) : (
      <MemberDetail
        detail={detail}
        tab={detailTab}
        setTab={setDetailTab}
        onBack={() => setDetail(null)}
        onEdit={openEdit}
        onToggle={toggleStatus}
      />
    );
  }

  return (
    <Page
      title="Members"
      className="members-page"
      actions={(
        <>
          <Button type="button" icon={Plus} onClick={openCreate}>New Member</Button>
          <Button type="button" variant="secondary" icon={UserPlus} onClick={() => openEnroll()}>Enroll Member</Button>
          <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => loadMembers(pagination.page)} loading={loading}>Refresh</Button>
        </>
      )}
    >
      {message ? <Alert tone="success" title="Member action complete">{message}</Alert> : null}
      {error ? <Alert tone="danger" title="Member action failed">{error}</Alert> : null}

      <div className="metrics member-metrics">
        {metrics.map((metric) => <Metric key={metric.title} {...metric} />)}
      </div>

      <section className="panel member-filters">
        <div className="form-grid three">
          <Field label="Search members" value={searchTerm} onChange={setSearchTerm} placeholder="Name or member code" />
          <Select
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
          <div className="button-row member-search-actions">
            <Button type="button" icon={Search} onClick={() => loadMembers(1)}>Search</Button>
            <Button type="button" variant="secondary" onClick={() => { setSearchTerm(""); setStatusFilter(""); }}>Clear</Button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Member List</h2>
          <Button type="button" size="sm" icon={Plus} onClick={openCreate}>New Member</Button>
        </div>
        {loading ? <Skeleton lines={6} /> : members.length ? (
          <>
            <MemberCards members={members} busy={busy} onView={loadDetail} onEdit={openEdit} onEnroll={openEnroll} onToggle={toggleStatus} />
            <div className="member-desktop-table">
              <DataTable
                columns={["Member", "Code", "Phone", "Savings Principal", "Borrowed", "Declaration", "Approved", "Status", "Action"]}
                rows={members.map((member) => [
                  memberName(member),
                  member.member_code || "-",
                  member.phone || "-",
                  money(member.savings_principal),
                  money(member.cumulative_borrowed),
                  <Badge text={member.current_declaration_status || "NONE"} tone={badgeTone(member.current_declaration_status)} />,
                  member.approved_declarations || 0,
                  <Badge text={member.is_active ? "ACTIVE" : "INACTIVE"} tone={member.is_active ? "green" : "red"} />,
                  <div className="button-row compact">
                    <Button type="button" variant="secondary" size="sm" onClick={() => loadDetail(member.id)}>View Details</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(member)}>Edit</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openEnroll(member)}>Enroll</Button>
                    <Button
                      type="button"
                      variant={member.is_active ? "danger" : "secondary"}
                      size="sm"
                      onClick={() => toggleStatus(member)}
                      loading={busy === `toggle-${member.id}`}
                    >
                      {member.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>,
                ])}
              />
            </div>
            <Pagination
              page={pagination.page || 1}
              totalPages={pagination.totalPages || 1}
              disabled={loading}
              onPageChange={loadMembers}
            />
          </>
        ) : (
          <EmptyState
            title="No members found"
            message="Create members, then enroll them into a cycle so their savings, borrowing, declarations, and penalties can be tracked."
            action={<Button type="button" onClick={openCreate}>New Member</Button>}
          />
        )}
      </section>

      <Modal
        open={Boolean(formMode)}
        title={formMode === "edit" ? "Edit Member" : "Create Member"}
        size="lg"
        onClose={() => setFormMode("")}
        footer={(
          <div className="button-row">
            <Button type="button" variant="secondary" onClick={() => setFormMode("")}>Cancel</Button>
            {formMode === "create" ? (
              <Button type="button" variant="secondary" onClick={(event) => submitMember(event, true)} loading={busy === "save"}>Save + Add Another</Button>
            ) : null}
            <Button type="button" onClick={submitMember} loading={busy === "save"}>Save Member</Button>
          </div>
        )}
      >
        <form onSubmit={submitMember}>
          <MemberForm form={form} setForm={setForm} errors={formErrors} editing={formMode === "edit"} />
        </form>
      </Modal>

      <Modal
        open={enrollOpen}
        title="Enroll Member"
        onClose={() => setEnrollOpen(false)}
        footer={(
          <div className="button-row">
            <Button type="button" variant="secondary" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submitEnroll} loading={busy === "enroll"}>Enroll Member</Button>
          </div>
        )}
      >
        <form onSubmit={submitEnroll}>
          <div className="form-grid two">
            <Select
              label="Member"
              value={enrollForm.memberId}
              onChange={(value) => setEnrollForm((current) => ({ ...current, memberId: value }))}
              placeholder="Choose member"
              error={enrollErrors.memberId}
              required
              options={members.map((member) => ({ value: member.id, label: `${memberName(member)}${member.member_code ? ` (${member.member_code})` : ""}` }))}
            />
            <Select
              label="Cycle"
              value={enrollForm.cycleId}
              onChange={(value) => setEnrollForm((current) => ({ ...current, cycleId: value }))}
              placeholder="Choose cycle"
              error={enrollErrors.cycleId}
              required
              options={cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.name} - ${cycle.status}` }))}
            />
          </div>
        </form>
      </Modal>
    </Page>
  );
}
