import React from "react";
import { BarChart3, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import splashArtwork from "../../assets/auth/background-image-splash.png";
import { BrandMark } from "../../components/BrandMark.jsx";

const desktopShellClass =
  "hidden min-h-[100dvh] w-full overflow-y-auto bg-cream p-4 font-sans text-charcoal md:grid md:place-items-center md:p-6 lg:p-8";

const desktopFrameClass =
  "grid min-h-[min(780px,calc(100dvh-48px))] w-full max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))] overflow-hidden rounded-[30px] border border-mist bg-white shadow-[0_28px_90px_rgba(31,41,51,0.18)] lg:rounded-[34px] xl:max-w-[1280px]";

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
        <aside className="relative flex min-h-[260px] flex-col justify-between gap-7 overflow-hidden p-7 text-cream md:min-h-[300px] lg:min-h-0 lg:p-9 xl:p-12" style={desktopVisualStyle}>
          <div className="pointer-events-none absolute right-[-110px] top-[-140px] h-[330px] w-[330px] rounded-full border border-gold/70 bg-gold/10 shadow-[0_0_80px_rgba(217,162,39,0.22)] lg:right-[-90px] lg:top-[-120px] lg:h-[340px] lg:w-[340px]" aria-hidden="true" />
          <div className="relative z-[1]">
            <BrandMark size="lg" className="auth-hero-mark text-cream [&_.brand-mark]:!h-20 [&_.brand-mark]:!w-20 lg:[&_.brand-mark]:!h-24 lg:[&_.brand-mark]:!w-24" />
            <p className="mb-3 mt-6 text-xs font-black uppercase tracking-[0.08em] text-gold lg:mt-8">{eyebrow}</p>
            <h1 className="m-0 max-w-[620px] text-[clamp(38px,6vw,58px)] font-black leading-none text-cream drop-shadow-[0_8px_22px_rgba(13,59,46,0.36)] lg:text-[clamp(40px,4.5vw,66px)]">
              Visionaries Village Banking
            </h1>
            <p className="mt-4 max-w-[560px] text-[clamp(16px,2.4vw,20px)] font-semibold leading-snug text-cream/90 lg:mt-5 lg:text-[clamp(17px,1.7vw,22px)]">
              Stronger Together. Saving Today, Building Tomorrow.
            </p>
          </div>

          <div className="relative z-[1] grid gap-3 md:grid-cols-2 lg:grid-cols-2">
            {trustItems.map(([itemTitle, text, Icon]) => (
              <div key={itemTitle} className="grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-cream/20 bg-cream/10 p-3.5 backdrop-blur lg:min-h-[86px] lg:p-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gold/95 text-forest lg:h-11 lg:w-11">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-black text-cream">{itemTitle}</strong>
                  <small className="mt-1 block text-xs font-semibold leading-snug text-cream/80">{text}</small>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 items-center justify-center bg-cream px-5 py-6 md:px-8 md:py-8 lg:px-8 xl:px-10">
          <div className="w-full max-w-[560px] lg:max-w-[520px]">
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
