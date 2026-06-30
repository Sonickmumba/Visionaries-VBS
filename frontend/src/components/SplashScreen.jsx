import React from "react";
import { ArrowRight, BadgeDollarSign, HandCoins, Scale } from "lucide-react";
import { BrandMark } from "./BrandMark.jsx";

export function SplashScreen({ onContinue, loadingLabel = "Checking secure session" }) {
  const isWelcome = typeof onContinue === "function";
  const features = [
    ["Track Savings", "Live member contributions", BadgeDollarSign],
    ["Manage Loans", "Transparent requests", HandCoins],
    ["Share Interest", "Fair monthly rules", Scale],
  ];

  return (
    <main className="splash-screen" aria-label="Visionaries Village Banking splash screen">
      <section className="splash-phone">
        <BrandMark size="lg" className="splash-mark" />
        <div className="splash-copy">
          <h1>Visionaries Village Banking</h1>
          <p>Save Together. Grow Together.</p>
          <small>Mobile-first village banking with declarations, loans, common interest, reports, and audit-ready monthly closing.</small>
        </div>
        <div className="splash-features" aria-label="Product highlights">
          {features.map(([title, detail, Icon]) => (
            <div key={title}>
              <Icon size={17} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
          ))}
        </div>
        {isWelcome ? (
          <button className="splash-continue" type="button" onClick={onContinue}>
            Continue <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <div className="splash-progress" role="status" aria-live="polite" aria-label={loadingLabel}>
            <span />
          </div>
        )}
      </section>
    </main>
  );
}
