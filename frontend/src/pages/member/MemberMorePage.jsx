import React, { useEffect, useMemo, useState } from "react";
import { Banknote, Bell, ChevronRight, ClipboardList, FileBarChart, FileText, LogOut, Menu, PiggyBank, Settings, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { api } from "../../api/client.js";
import {
  Alert,
  Badge,
  EmptyState,
  MobileBottomNav,
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

export function MemberMorePage({ setPage, onLogout, memberApi = api, initialData = null }) {
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
    // { title: "Payment Proofs", subtitle: "Open declarations to manage proof uploads", icon: Upload, page: "my-declaration" },
    { title: "Reports", subtitle: "Transparent group reports", icon: FileBarChart, page: "my-reports" },
    { title: "Settings", subtitle: "Account settings coming soon", icon: Settings, page: null },
    { title: "Logout", subtitle: "Sign out from this device", icon: LogOut, page: "logout" },
  ];

  return (
    <Page className="member-more-page grid gap-0" title="More">
      {error ? <Alert tone="danger" title="Profile failed">{error}</Alert> : null}
      {loading ? <section className="panel rounded-app border border-mist bg-cream p-4 shadow-soft"><Skeleton lines={8} /></section> : !data?.activeMembership ? (
        <EmptyState title="No active cycle membership" message="Ask an administrator to enroll you into a cycle before your profile can show cycle position." />
      ) : (
        <div className="member-more-mobile">
          <MobileScreenShell bottomNav={bottomNav}>
            <section className="member-more-hero" aria-label="Member profile summary">
              <div className="member-more-topbar">
                <button type="button" onClick={() => setPage?.("member-more")} aria-label="Open menu"><Menu size={18} aria-hidden="true" /></button>
                <button type="button" onClick={() => setPage?.("my-notifications")} aria-label="Notifications"><Bell size={18} aria-hidden="true" /></button>
              </div>
              <div className="member-more-avatar" aria-hidden="true">{initials(name)}</div>
              <div>
                <h2>{name}</h2>
                <Badge text="Active" tone="green" />
                <p>Member Code: {data?.me?.member?.member_code || "Member"}</p>
              </div>
            </section>

            <section className="member-cycle-position" aria-label="Cycle position">
              <div className="member-cycle-position-head">
                <span><ShieldCheck size={17} aria-hidden="true" /> Cycle Position</span>
                {/* <Badge text="Transparent" tone="blue" /> */}
              </div>
              <div className="member-cycle-position-grid">
                <div>
                  <span className="member-cycle-position-icon"><PiggyBank size={16} aria-hidden="true" /></span>
                  <strong>Accumulated Savings</strong>
                  <span>{money(totals.accumulatedSavings)}</span>
                </div>
                <div>
                  <span className="member-cycle-position-icon amber"><Banknote size={16} aria-hidden="true" /></span>
                  <strong>Loan Balance</strong>
                  <span>{money(totals.outstandingLoan)}</span>
                </div>
                <div>
                  <span className="member-cycle-position-icon purple"><Sparkles size={16} aria-hidden="true" /></span>
                  <strong>Estimated Shareout</strong>
                  <span>{money(estimatedShareout)}</span>
                </div>
              </div>
            </section>

            <section className="member-more-menu" aria-label="Member menu">
              {menu.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className={`member-more-menu-row ${item.page === "logout" ? "danger" : ""}`.trim()}
                  onClick={item.page === "logout" ? onLogout : item.page ? () => setPage?.(item.page) : undefined}
                  disabled={!item.page || (item.page === "logout" && !onLogout)}
                  aria-label={item.page === "logout" ? "Log out" : item.page ? `Open ${item.title}` : item.title}
                >
                  <span className="member-more-menu-icon"><item.icon size={18} aria-hidden="true" /></span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              ))}
            </section>
          </MobileScreenShell>
        </div>
      )}
    </Page>
  );
}
