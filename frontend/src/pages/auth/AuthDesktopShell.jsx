import React from "react";
import { BarChart3, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import splashArtwork from "../../assets/auth/background-image-splash.png";
import { BrandMark } from "../../components/BrandMark.jsx";

const desktopShellClass =
  "hidden min-h-[100dvh] w-full bg-cream p-5 font-sans text-charcoal md:grid md:place-items-center lg:p-8";

const desktopFrameClass =
  "grid min-h-[min(820px,calc(100dvh-48px))] w-full max-w-[1180px] overflow-hidden rounded-[34px] border border-mist bg-white shadow-[0_28px_90px_rgba(31,41,51,0.18)] md:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] xl:max-w-[1280px] xl:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.78fr)]";

const desktopVisualStyle = {
  backgroundImage: `linear-gradient(135deg, rgba(13,59,46,0.96) 0%, rgba(13,59,46,0.88) 46%, rgba(18,122,90,0.72) 100%), url(${splashArtwork})`,
  backgroundPosition: "center bottom",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
};

export function AuthDesktopShell({ eyebrow, title, subtitle, children }) {
  const trustItems = [
    ["Secure", "Protected member access", ShieldCheck],
    ["Transparent", "Reports members can trust", BarChart3],
    ["Community", "Built for village groups", UsersRound],
    ["Mobile Ready", "Works across devices", Smartphone],
  ];

  return (
    <section className={desktopShellClass} aria-label={`${title} desktop auth layout`}>
      <div className={desktopFrameClass}>
        <aside className="relative flex min-h-0 flex-col justify-between overflow-hidden p-9 text-cream lg:p-12" style={desktopVisualStyle}>
          <div className="pointer-events-none absolute right-[-90px] top-[-120px] h-[340px] w-[340px] rounded-full border border-gold/70 bg-gold/10 shadow-[0_0_80px_rgba(217,162,39,0.22)]" aria-hidden="true" />
          <div className="relative z-[1]">
            <BrandMark size="lg" className="auth-hero-mark text-cream [&_.brand-mark]:!h-24 [&_.brand-mark]:!w-24" />
            <p className="mb-3 mt-8 text-xs font-black uppercase tracking-[0.08em] text-gold">{eyebrow}</p>
            <h1 className="m-0 max-w-[620px] text-[clamp(42px,5vw,68px)] font-black leading-none text-cream drop-shadow-[0_8px_22px_rgba(13,59,46,0.36)]">
              Visionaries Village Banking
            </h1>
            <p className="mt-5 max-w-[560px] text-[clamp(17px,1.7vw,22px)] font-semibold leading-snug text-cream/90">
              Stronger Together. Saving Today, Building Tomorrow.
            </p>
          </div>

          <div className="relative z-[1] grid gap-3 lg:grid-cols-2">
            {trustItems.map(([itemTitle, text, Icon]) => (
              <div key={itemTitle} className="grid min-h-[86px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-cream/20 bg-cream/10 p-4 backdrop-blur">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/95 text-forest">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-black text-cream">{itemTitle}</strong>
                  <small className="mt-1 block text-xs font-semibold leading-snug text-cream/80">{text}</small>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 items-center justify-center bg-cream px-7 py-8 lg:px-10">
          <div className="w-full max-w-[520px]">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-emerald">{eyebrow}</p>
            <h2 className="m-0 text-[clamp(28px,3vw,40px)] font-black leading-tight text-forest">{title}</h2>
            <p className="mb-6 mt-2 text-sm font-semibold leading-6 text-charcoal/75">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
