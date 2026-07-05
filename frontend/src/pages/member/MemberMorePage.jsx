import React, { useEffect, useMemo, useState } from "react";
import { Bell, ClipboardList, FileBarChart, FileText, LogOut, Menu, Receipt, Settings, ShieldCheck, Upload } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  EmptyState,
  MobileBottomNav,
  MobileListCard,
  MobileScreenShell,
  Skeleton,
} from "../../components/ui/index.jsx";
import { Page } from "../../layouts/AppLayouts.jsx";
import { chooseActiveMembership, memberDashboardTotals } from "./MemberDashboardPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";
import "../../styles/member-more.css";

const money = (value) => `K${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function memberName(member) {
  return `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "Member";
}

function initials(name) {
  return String(name || "M").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export async function loadMemberMoreData({ memberApi = api } = {}) {
  const me = await memberApi("/auth/me");
  const activeMembership = chooseActiveMembership(me.cycleMemberships || []);
  if (!activeMembership) return { me, activeMembership: null, statement: null };
  const statement = await memberApi(`/reports/member-statement/${activeMembership.id}`);
  return { me, activeMembership, statement: statement.data };
}

export function MemberMorePage({ setPage, memberApi = api, initialData = null }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialData === null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await loadMemberMoreData({ memberApi }));
    } catch (err) {
      setError(err.message || "Member profile could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  const name = memberName(data?.me?.member);
  const totals = useMemo(() => memberDashboardTotals(data), [data]);
  const estimatedShareout = Math.max(0, totals.accumulatedSavings - totals.outstandingLoan - totals.penaltyDue - totals.commonInterestDue);
  const bottomNav = <MobileBottomNav active="member-more" items={memberMobileNavItems} onChange={setPage} />;

  const menu = [
    { title: "Notifications", subtitle: "Group activity and approvals", icon: Bell, page: "my-notifications" },
    { title: "Declarations", subtitle: "Submit savings, repayments, and loan requests", icon: ClipboardList, page: "my-declaration" },
    { title: "Statements", subtitle: "View your full member statement", icon: FileText, page: "my-statement" },
    { title: "Payment Proofs", subtitle: "Open declarations to manage proof uploads", icon: Upload, page: "my-declaration" },
    { title: "Reports", subtitle: "Transparent group reports", icon: FileBarChart, page: "my-reports" },
    { title: "Settings", subtitle: "Account settings coming soon", icon: Settings, page: null },
    { title: "Logout", subtitle: "Sign out from this device", icon: LogOut, page: "logout" },
  ];

  return (
    <Page className="member-more-page" title="More">
      {error ? <Alert tone="danger" title="Profile failed">{error}</Alert> : null}
      {loading ? <section className="panel"><Skeleton lines={8} /></section> : !data?.activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before your profile can show cycle position." />
      ) : (
        <div className="member-more-mobile">
          <MobileScreenShell bottomNav={bottomNav}>
            <section className="member-more-hero" aria-label="Member profile summary">
              <div className="member-more-topbar">
                <button type="button" aria-label="Open menu"><Menu size={18} aria-hidden="true" /></button>
                <button type="button" onClick={() => setPage?.("my-notifications")} aria-label="Notifications"><Bell size={18} aria-hidden="true" /></button>
              </div>
              <div className="member-more-avatar" aria-hidden="true">{initials(name)}</div>
              <div>
                <h2>{name}</h2>
                <Badge text="Active Member" tone="green" />
                <p>Member Code: {data?.me?.member?.member_code || "Member"}</p>
              </div>
            </section>

            <section className="member-cycle-position" aria-label="Cycle position">
              <div className="member-cycle-position-head">
                <span><ShieldCheck size={17} aria-hidden="true" /> Cycle Position</span>
                <Badge text="Transparent" tone="blue" />
              </div>
              <div className="member-cycle-position-grid">
                <div><strong>Accumulated Savings</strong><span>{money(totals.accumulatedSavings)}</span></div>
                <div><strong>Loan Balance</strong><span>{money(totals.outstandingLoan)}</span></div>
                <div><strong>Estimated Shareout</strong><span>{money(estimatedShareout)}</span></div>
              </div>
            </section>

            <section className="member-more-command-strip" aria-label="Member profile quick actions">
              <button type="button" onClick={() => setPage?.("my-declaration")}>
                <Receipt size={18} aria-hidden="true" />
                <span>Declare</span>
              </button>
              <button type="button" onClick={() => setPage?.("my-reports")}>
                <FileBarChart size={18} aria-hidden="true" />
                <span>Reports</span>
              </button>
              <button type="button" onClick={() => setPage?.("my-statement")}>
                <FileText size={18} aria-hidden="true" />
                <span>Statement</span>
              </button>
            </section>

            <section className="member-more-menu" aria-label="Member menu">
              {menu.map((item) => (
                <MobileListCard
                  key={item.title}
                  title={item.title}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  onAction={item.page && item.page !== "logout" ? () => setPage?.(item.page) : undefined}
                  actionLabel={item.page === "logout" ? "Use header" : item.page ? "Open" : "Soon"}
                  status={!item.page || item.page === "logout" ? { label: item.page === "logout" ? "Use header" : "Soon", tone: "gray" } : undefined}
                />
              ))}
            </section>
          </MobileScreenShell>
        </div>
      )}
    </Page>
  );
}
