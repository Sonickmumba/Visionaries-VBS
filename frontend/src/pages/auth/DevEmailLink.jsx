import React from "react";
import { Alert, Button } from "../../components/ui/index.jsx";

export function devEmailLink(delivery) {
  return delivery?.devFallback && delivery?.link ? delivery.link : "";
}

export function DevEmailLink({ delivery, title = "Development verification link" }) {
  const link = devEmailLink(delivery);
  if (!link) return null;
  return (
    <Alert tone="info" title={title}>
      <p>Local email delivery is using development fallback. Open this link to continue testing.</p>
      <div className="button-row auth-actions">
        <Button type="button" onClick={() => window.open(link, "_self")}>Open Link</Button>
      </div>
    </Alert>
  );
}
