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
        <BrandMark size="lg" className="splash-mark text-cream" />
        <div className="splash-copy">
          <h1 className="text-[2.15rem] font-extrabold leading-none text-cream">Visionaries Village Banking</h1>
          <p className="mt-3 text-lg font-semibold text-gold">Save Together. Grow Together.</p>
          <small className="mt-4 block text-sm leading-6 text-cream/80">Mobile-first village banking with declarations, loans, common interest, reports, and audit-ready monthly closing.</small>
        </div>
        <div className="splash-features grid gap-3" aria-label="Product highlights">
          {features.map(([title, detail, Icon]) => (
            <div key={title} className="grid grid-cols-[auto_1fr] items-center gap-x-3 rounded-app border border-cream/20 bg-white/10 px-4 py-3 backdrop-blur">
              <Icon size={17} aria-hidden="true" />
              <strong className="text-sm text-cream">{title}</strong>
              <span className="col-start-2 text-xs text-cream/75">{detail}</span>
            </div>
          ))}
        </div>
        {isWelcome ? (
          <button className="splash-continue inline-flex min-h-12 items-center justify-center gap-2 rounded-app bg-cream px-5 py-3 text-sm font-extrabold text-forest shadow-soft transition hover:-translate-y-0.5" type="button" onClick={onContinue}>
            Continue <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <div className="splash-progress h-1.5 overflow-hidden rounded-full bg-white/20" role="status" aria-live="polite" aria-label={loadingLabel}>
            <span />
          </div>
        )}
      </section>
    </main>
  );
}
