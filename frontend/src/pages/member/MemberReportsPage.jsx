import React from "react";
import { Banknote, ClipboardList, FileBarChart, Gauge, Receipt } from "lucide-react";
import { MobileBottomNav } from "../../components/ui/index.jsx";
import { ReportsPage } from "../admin/ReportsPage.jsx";

const memberReportNav = [
  { id: "member-dashboard", label: "Home", icon: Gauge },
  { id: "my-declaration", label: "Declare", icon: ClipboardList },
  { id: "my-statement", label: "Statement", icon: Receipt },
  { id: "my-reports", label: "Reports", icon: FileBarChart },
  { id: "my-loans", label: "Loans", icon: Banknote },
];

export function MemberReportsPage({ setPage, reportsApi, initialData, initialCycles, initialCycleDetail }) {
  return (
    <>
      <ReportsPage
        reportsApi={reportsApi}
        initialData={initialData}
        initialCycles={initialCycles}
        initialCycleDetail={initialCycleDetail}
        title="Member Reports"
        heroEyebrow="Transparency Reports"
        readOnlyNote="Read-only group reports for statements, declarations, pool, savings, loans, common interest, penalties, and cycle closing."
      />
      <MobileBottomNav active="my-reports" items={memberReportNav} onChange={setPage} />
    </>
  );
}
