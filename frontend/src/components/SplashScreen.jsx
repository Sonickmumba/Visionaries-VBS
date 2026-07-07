import React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import splashArtwork from "../assets/auth/background-image-splash.png";
import { BrandMark } from "./BrandMark.jsx";

const splashShellClass = "grid min-h-[100svh] place-items-center bg-cream p-[clamp(12px,3vw,34px)] font-sans text-cream max-[430px]:bg-forest max-[430px]:p-0";
const splashPhoneClass = "relative min-h-[min(900px,calc(100svh-24px))] w-[min(100%,430px)] overflow-hidden rounded-[40px] border border-cream/20 text-center shadow-[0_30px_90px_rgba(31,41,51,0.28)] max-[430px]:min-h-[100svh] max-[430px]:w-full max-[430px]:rounded-none max-[430px]:border-0 max-[430px]:shadow-none";
const splashCopyClass = "relative z-[6] grid content-start justify-items-center px-[30px] pb-[250px] pt-[clamp(86px,11svh,112px)] pointer-events-none max-[430px]:pb-[238px]";
const splashTitleClass = "mt-[30px] text-[clamp(50px,14vw,74px)] font-black leading-none text-cream drop-shadow-[0_6px_18px_rgba(31,41,51,0.28)]";
const splashContinueClass = "absolute bottom-[92px] left-8 right-8 z-[5] inline-flex min-h-[70px] items-center justify-center gap-4 rounded-[18px] bg-cream px-5 py-3 text-2xl font-black text-forest shadow-[0_20px_48px_rgba(31,41,51,0.28)] transition hover:-translate-y-0.5";
const splashTrustClass = "absolute bottom-[42px] left-5 right-5 z-[5] m-0 flex items-center justify-center gap-2.5 text-[10px] font-normal text-cream";
const splashBackgroundStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(13, 59, 46, 0.08), rgba(13, 59, 46, 0.18)), url(${splashArtwork}), linear-gradient(160deg, #0D3B2E 0%, #0D3B2E 52%, #127A5A 100%)`,
  backgroundPosition: "center",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
};

export function SplashScreen({ onContinue, loadingLabel = "Checking secure session" }) {
  const isWelcome = typeof onContinue === "function";

  return (
    <main className={splashShellClass} aria-label="Visionaries Village Banking splash screen">
      <section className={splashPhoneClass} style={splashBackgroundStyle}>
        {/* <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div> */}
        <div className="splash-orbit" aria-hidden="true" />
        <div className={splashCopyClass}>
          <BrandMark size="lg" className="splash-mark text-cream" />
          <h1 className={splashTitleClass}>Visionaries<br />Village Banking</h1>
          <span className="mt-9 h-[3px] w-[58px] rounded-full bg-gold shadow-[0_4px_12px_rgba(217,162,39,0.36)]" aria-hidden="true" />
          <p className="relative z-[7] mt-[26px] text-[clamp(19px,5.1vw,24px)] font-black leading-tight text-gold drop-shadow-[0_4px_16px_rgba(13,59,46,0.5)]">Stronger Together.</p>
          <small className="relative z-[7] mt-2 block max-w-[330px] text-[clamp(17px,4.6vw,21px)] font-extrabold leading-snug text-cream/95 drop-shadow-[0_4px_16px_rgba(13,59,46,0.56)]">Saving Today, Building Tomorrow.</small>
        </div>
        <div className="auth-village-scene splash-scene" aria-hidden="true" />
        <div className="splash-gold-wave" aria-hidden="true" />
        {isWelcome ? (
          <button className={splashContinueClass} type="button" onClick={onContinue}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-forest to-emerald text-gold shadow-[0_10px_22px_rgba(13,59,46,0.22)]"><ArrowRight size={24} aria-hidden="true" /></span>
            Get Started
          </button>
        ) : (
          <div className="splash-progress absolute bottom-[98px] left-1/2 z-[5] h-1.5 -translate-x-1/2 overflow-hidden rounded-full bg-white/20" role="status" aria-live="polite" aria-label={loadingLabel}>
            <span />
          </div>
        )}
        <p className={splashTrustClass}><ShieldCheck className="text-gold" size={18} aria-hidden="true" /> Secure. Reliable. Community Focused.</p>
      </section>
    </main>
  );
}
