import React from "react";
import { Coins } from "lucide-react";

export function SplashScreen({ onContinue, loadingLabel = "Checking secure session" }) {
  const isWelcome = typeof onContinue === "function";

  return (
    <main className="splash-screen" aria-label="Visionaries Village Banking splash screen">
      <section className="splash-phone">
        <div className="splash-mark" aria-hidden="true">
          <Coins size={42} />
        </div>
        <div className="splash-copy">
          <h1>Visionaries Village Banking</h1>
          <p>Save Together. Grow Together.</p>
        </div>
        {isWelcome ? (
          <button className="splash-continue" type="button" onClick={onContinue}>
            Continue
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
