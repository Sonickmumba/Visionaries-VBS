import React, { Suspense, lazy, useMemo } from "react";
import { EmptyState, Skeleton } from "./components/ui/index.jsx";
import { AppLayout, routeLabel } from "./layouts/AppLayouts.jsx";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const AdminDashboardPage = lazyNamed(() => import("./pages/admin/AdminDashboardPage.jsx"), "AdminDashboardPage");
const AuditTrailPage = lazyNamed(() => import("./pages/admin/AuditTrailPage.jsx"), "AuditTrailPage");
const CommonInterestPage = lazyNamed(() => import("./pages/admin/CommonInterestPage.jsx"), "CommonInterestPage");
const CycleScreensPage = lazyNamed(() => import("./pages/admin/CycleScreensPage.jsx"), "CycleScreensPage");
const DeclarationScreensPage = lazyNamed(() => import("./pages/admin/DeclarationScreensPage.jsx"), "DeclarationScreensPage");
const LedgerPage = lazyNamed(() => import("./pages/admin/LedgerPage.jsx"), "LedgerPage");
const LoanScreensPage = lazyNamed(() => import("./pages/admin/LoanScreensPage.jsx"), "LoanScreensPage");
const MemberManagementPage = lazyNamed(() => import("./pages/admin/MemberManagementPage.jsx"), "MemberManagementPage");
const MonthlyClosingPage = lazyNamed(() => import("./pages/admin/MonthlyClosingPage.jsx"), "MonthlyClosingPage");
const PenaltyScreensPage = lazyNamed(() => import("./pages/admin/PenaltyScreensPage.jsx"), "PenaltyScreensPage");
const ReportsPage = lazyNamed(() => import("./pages/admin/ReportsPage.jsx"), "ReportsPage");
const SavingsContributionPage = lazyNamed(() => import("./pages/admin/SavingsContributionPage.jsx"), "SavingsContributionPage");
const SettingsPage = lazyNamed(() => import("./pages/admin/SettingsPage.jsx"), "SettingsPage");
const MemberDashboardPage = lazyNamed(() => import("./pages/member/MemberDashboardPage.jsx"), "MemberDashboardPage");
const MemberDeclarationPage = lazyNamed(() => import("./pages/member/MemberDeclarationPage.jsx"), "MemberDeclarationPage");
const MemberLoansPage = lazyNamed(() => import("./pages/member/MemberLoansPage.jsx"), "MemberLoansPage");
const MemberPenaltiesPage = lazyNamed(() => import("./pages/member/MemberPenaltiesPage.jsx"), "MemberPenaltiesPage");
const MemberSavingsPage = lazyNamed(() => import("./pages/member/MemberSavingsPage.jsx"), "MemberSavingsPage");
const MemberStatementScreen = lazyNamed(() => import("./pages/member/MemberStatementPage.jsx"), "MemberStatementPage");

function LoadingPage() {
  return (
    <section className="panel" aria-label="Loading page">
      <Skeleton lines={8} />
    </section>
  );
}

function UnknownPage({ title }) {
  return (
    <EmptyState
      title={title}
      message="This page is not available yet."
    />
  );
}

function screenForRoute(page, setPage, pageTitle) {
  switch (page) {
    case "dashboard":
      return <AdminDashboardPage setPage={setPage} />;
    case "cycles":
      return <CycleScreensPage />;
    case "members":
      return <MemberManagementPage />;
    case "declarations":
      return <DeclarationScreensPage />;
    case "savings":
      return <SavingsContributionPage />;
    case "loans":
      return <LoanScreensPage />;
    case "common-interest":
      return <CommonInterestPage />;
    case "penalties":
      return <PenaltyScreensPage />;
    case "closing":
      return <MonthlyClosingPage />;
    case "ledger":
      return <LedgerPage />;
    case "reports":
      return <ReportsPage />;
    case "audit":
      return <AuditTrailPage />;
    case "settings":
      return <SettingsPage />;
    case "member-dashboard":
      return <MemberDashboardPage setPage={setPage} />;
    case "my-declaration":
      return <MemberDeclarationPage setPage={setPage} />;
    case "my-statement":
      return <MemberStatementScreen setPage={setPage} />;
    case "my-penalties":
      return <MemberPenaltiesPage setPage={setPage} />;
    case "my-savings":
      return <MemberSavingsPage setPage={setPage} />;
    case "my-loans":
      return <MemberLoansPage setPage={setPage} />;
    default:
      return <UnknownPage title={pageTitle} />;
  }
}

export function PortalApp({ user, page, setPage, onLogout }) {
  const pageTitle = useMemo(() => routeLabel(page), [page]);

  return (
    <AppLayout user={user} page={page} setPage={setPage} onLogout={onLogout}>
      <Suspense fallback={<LoadingPage />}>
        {screenForRoute(page, setPage, pageTitle)}
      </Suspense>
    </AppLayout>
  );
}
