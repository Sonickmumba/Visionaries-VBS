import React from "react";
import { MobileBottomNav } from "../../components/ui/index.jsx";
import { ShareoutPage } from "../admin/ShareoutPage.jsx";
import { memberMobileNavItems } from "./memberMobileNav.js";

export function MemberShareoutPage({ setPage }) {
  return (
    <>
      <ShareoutPage readOnly title="My Shareout" />
      <MobileBottomNav active="my-shareout" items={memberMobileNavItems} onChange={setPage} />
    </>
  );
}
