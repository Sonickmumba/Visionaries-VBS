import React from "react";
import { MobileBottomNav } from "../../components/ui/index.jsx";
import { ReportsPage } from "../admin/ReportsPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";

export function MemberReportsPage({ setPage, reportsApi, initialData, initialCycles, initialCycleDetail, requestedReport }) {
  return (
    <>
      <ReportsPage
        reportsApi={reportsApi}
        initialData={initialData}
        initialCycles={initialCycles}
        initialCycleDetail={initialCycleDetail}
        requestedReport={requestedReport}
        title="Member Reports"
        heroEyebrow="Transparency Reports"
        readOnlyNote="Read-only group reports for statements, declarations, pool, savings, loans, common interest, penalties, and cycle closing."
      />
      <MobileBottomNav active="my-reports" items={memberMobileNavItems} onChange={setPage} />
    </>
  );
}
