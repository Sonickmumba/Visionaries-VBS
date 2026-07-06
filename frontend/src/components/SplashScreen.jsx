import React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BrandMark } from "./BrandMark.jsx";

export function SplashScreen({ onContinue, loadingLabel = "Checking secure session" }) {
  const isWelcome = typeof onContinue === "function";

  return (
    <main className="splash-screen" aria-label="Visionaries Village Banking splash screen">
      <section className="splash-phone">
        <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div>
        <div className="splash-orbit" aria-hidden="true" />
        <div className="splash-copy">
          <BrandMark size="lg" className="splash-mark text-cream" />
          <h1 className="text-[2.15rem] font-extrabold leading-none text-cream">Visionaries<br />Village Banking</h1>
          <span className="splash-gold-rule" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold text-gold">Stronger Together.</p>
          <small className="mt-1 block text-sm leading-6 text-cream/80">Saving Today, Building Tomorrow.</small>
        </div>
        <div className="auth-village-scene splash-scene" aria-hidden="true" />
        <div className="splash-gold-wave" aria-hidden="true" />
        {isWelcome ? (
          <button className="splash-continue inline-flex min-h-12 items-center justify-center gap-2 rounded-app bg-cream px-5 py-3 text-sm font-extrabold text-forest shadow-soft transition hover:-translate-y-0.5" type="button" onClick={onContinue}>
            <span className="splash-continue-icon"><ArrowRight size={22} aria-hidden="true" /></span>
            Get Started
          </button>
        ) : (
          <div className="splash-progress h-1.5 overflow-hidden rounded-full bg-white/20" role="status" aria-live="polite" aria-label={loadingLabel}>
            <span />
          </div>
        )}
        <p className="splash-trust"><ShieldCheck size={18} aria-hidden="true" /> Secure. Reliable. Community Focused.</p>
      </section>
    </main>
  );
}
