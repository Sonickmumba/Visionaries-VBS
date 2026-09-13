import React from "react";
import { ArrowRight, BarChart3, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import splashArtwork from "../assets/auth/background-image-splash.webp";
import { BrandMark } from "./BrandMark.jsx";

const splashShellClass = "grid min-h-[100svh] place-items-center bg-cream p-[clamp(12px,3vw,34px)] font-sans text-cream max-[430px]:bg-forest max-[430px]:p-0";
const splashDesktopClass = "hidden min-h-[min(820px,calc(100svh-48px))] w-full max-w-[1180px] overflow-hidden rounded-[34px] border border-mist bg-white text-left shadow-[0_28px_90px_rgba(31,41,51,0.18)] md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] xl:max-w-[1280px]";
const splashPhoneClass = "relative min-h-[min(900px,calc(100svh-24px))] w-[min(100%,430px)] overflow-hidden rounded-[40px] border border-cream/20 text-center shadow-[0_30px_90px_rgba(31,41,51,0.28)] md:hidden max-[430px]:h-[100svh] max-[430px]:min-h-0 max-[430px]:w-full max-[430px]:rounded-none max-[430px]:border-0 max-[430px]:shadow-none";
const splashCopyClass = "relative z-[6] grid content-start justify-items-center px-[30px] pb-[250px] pt-[clamp(86px,11svh,112px)] pointer-events-none max-[430px]:pb-[238px]";
const splashTitleClass = "mb-[2px] mt-[10px] text-[clamp(24px,14vw,40px)] font-black leading-none text-cream max-[340px]:text-[32px]";
const splashContinueClass = "absolute bottom-[92px] border-0 left-8 right-8 z-[5] inline-flex min-h-[70px] items-center justify-center gap-6 rounded-[18px] bg-cream px-3 py-1 text-xl font-black text-forest shadow-[0_20px_48px_rgba(31,41,51,0.28)]";
const splashTrustClass = "absolute bottom-[42px] left-5 right-5 z-[5] m-0 flex items-center justify-center gap-2.5 text-[10px] font-normal text-cream";
const splashBackgroundStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(13, 59, 46, 0.08), rgba(13, 59, 46, 0.18)), url(${splashArtwork}), linear-gradient(160deg, #0D3B2E 0%, #0D3B2E 52%, #127A5A 100%)`,
  backgroundPosition: "center",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
};
const splashDesktopVisualStyle = {
  backgroundImage: `linear-gradient(135deg, rgba(13,59,46,0.97) 0%, rgba(13,59,46,0.9) 45%, rgba(18,122,90,0.74) 100%), url(${splashArtwork})`,
  backgroundPosition: "center bottom",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
};

export function SplashScreen({ onContinue, loadingLabel = "Checking secure session" }) {
  const isWelcome = typeof onContinue === "function";
  const trustItems = [
    ["Secure", "Protected financial records", ShieldCheck],
    ["Transparent", "Reports for every member", BarChart3],
    ["Community", "Built for village groups", UsersRound],
    ["Mobile First", "Ready for phones and desktop", Smartphone],
  ];

  return (
    <main className={splashShellClass} aria-label="Visionaries Village Banking splash screen">
      <section className={splashDesktopClass} aria-label="Visionaries Village Banking desktop welcome">
        <div className="relative flex min-h-0 flex-col justify-between overflow-hidden p-10 text-cream lg:p-12" style={splashDesktopVisualStyle}>
          <div className="pointer-events-none absolute right-[-90px] top-[-120px] h-[340px] w-[340px] rounded-full border border-gold/70 bg-gold/10 shadow-[0_0_80px_rgba(217,162,39,0.22)]" aria-hidden="true" />
          <div className="relative z-[1]">
            <BrandMark size="lg" className="splash-mark text-cream [&_.brand-mark]:!h-24 [&_.brand-mark]:!w-24" />
            <p className="mb-3 mt-8 text-xs font-black uppercase tracking-[0.08em] text-gold">Village banking made clear</p>
            <h1 className="m-0 max-w-[650px] text-[clamp(44px,5.2vw,72px)] font-black leading-none text-cream drop-shadow-[0_8px_22px_rgba(13,59,46,0.36)]">Visionaries Village Banking</h1>
            <p className="mt-5 max-w-[560px] text-[clamp(18px,1.8vw,24px)] font-semibold leading-snug text-cream/90">Stronger Together. Saving Today, Building Tomorrow.</p>
          </div>

          <div className="relative z-[1] grid gap-3 lg:grid-cols-2">
            {trustItems.map(([title, text, Icon]) => (
              <div key={title} className="grid min-h-[86px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-cream/20 bg-cream/10 p-4 backdrop-blur">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/95 text-forest"><Icon size={20} aria-hidden="true" /></span>
                <span>
                  <strong className="block text-sm font-black text-cream">{title}</strong>
                  <small className="mt-1 block text-xs font-semibold leading-snug text-cream/80">{text}</small>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center bg-cream px-8 py-10 lg:px-12">
          <div className="w-full max-w-[420px] rounded-[30px] border border-mist bg-white p-7 text-center text-charcoal shadow-[0_22px_60px_rgba(31,41,51,0.12)]">
            <BrandMark size="lg" className="mx-auto text-forest [&_.brand-mark]:!h-24 [&_.brand-mark]:!w-24" />
            <h2 className="mb-2 mt-6 text-[clamp(28px,3vw,38px)] font-black leading-tight text-forest">Welcome</h2>
            <p className="mx-auto mb-6 max-w-[320px] text-sm font-semibold leading-6 text-charcoal/75">Access declarations, savings, loans, common interest, statements, and reports from one secure place.</p>
            {isWelcome ? (
              <button className="inline-flex min-h-[58px] w-full items-center justify-center gap-3 rounded-[18px] border-0 bg-gradient-to-br from-emerald to-forest px-5 text-lg font-black text-cream shadow-[0_14px_34px_rgba(13,59,46,0.22)] transition hover:-translate-y-0.5" type="button" onClick={onContinue}>
                Get Started
                <ArrowRight size={24} aria-hidden="true" />
              </button>
            ) : (
              <div className="splash-progress mx-auto mt-3 h-1.5 overflow-hidden rounded-full bg-forest/15" role="status" aria-live="polite" aria-label={loadingLabel}>
                <span />
              </div>
            )}
            <p className="mt-5 flex items-center justify-center gap-2 text-xs font-black text-forest"><ShieldCheck className="text-gold" size={18} aria-hidden="true" /> Secure. Reliable. Community Focused.</p>
          </div>
        </div>
      </section>

      <section className={splashPhoneClass} style={splashBackgroundStyle}>
        <div className="splash-orbit" aria-hidden="true" />
        <div className={splashCopyClass}>
          <BrandMark size="lg" className="splash-mark text-cream" />
          <h1 className={splashTitleClass}>Visionaries<br />Village Banking</h1>
          <span className="mt-0 h-[1.5px] w-[58px] rounded-full bg-gold shadow-[0_4px_12px_rgba(217,162,39,0.36)]" aria-hidden="true" />
          <small className="relative z-[7] mt-0 block max-w-[330px] text-[clamp(9px,4.6vw,14px)] leading-snug text-cream/95 drop-shadow-[0_4px_16px_rgba(13,59,46,0.56)]">Stronger Together.<br />Saving Today, Building Tomorrow.</small>
        </div>
        <div className="auth-village-scene splash-scene" aria-hidden="true" />
        <div className="splash-gold-wave" aria-hidden="true" />
        {isWelcome ? (
          <button className={splashContinueClass} type="button" onClick={onContinue}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-forest to-emerald text-gold shadow-[0_10px_22px_rgba(13,59,46,0.22)]"><ArrowRight size={24} aria-hidden="true" /></span>
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
