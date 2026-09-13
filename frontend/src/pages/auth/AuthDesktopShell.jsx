import React from "react";
import { ArrowLeft, Landmark, UsersRound } from "lucide-react";
import splashArtwork from "../../assets/auth/background-image-splash.webp";

const desktopShellClass =
  "relative hidden min-h-[100dvh] w-full flex-col overflow-hidden bg-forest font-sans text-charcoal md:flex";

const desktopVisualStyle = {
  backgroundImage: `linear-gradient(90deg, rgba(6,47,36,0.9) 0%, rgba(13,59,46,0.7) 46%, rgba(13,59,46,0.82) 100%), url(${splashArtwork})`,
  backgroundPosition: "center bottom",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
};

function AuthEmblem() {
  return (
    <span
      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-solid border-gold bg-cream text-forest shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
      aria-label="Visionaries Village Banking"
    >
      <span className="absolute inset-[3px] rounded-full border border-solid border-forest/20" aria-hidden="true" />
      <Landmark className="relative -translate-y-1" size={25} strokeWidth={1.8} aria-hidden="true" />
      <span className="absolute bottom-1.5 grid h-4 w-7 place-items-center rounded-full bg-gold text-forest">
        <UsersRound size={13} strokeWidth={2.2} aria-hidden="true" />
      </span>
    </span>
  );
}

export function AuthDesktopShell({ eyebrow, title, subtitle, children, variant = "login", onBackToWelcome }) {
  const isSignup = variant === "signup";

  return (
    <section className={desktopShellClass} style={desktopVisualStyle} aria-label={`${title} desktop auth layout`}>
      <header className="relative z-[2] flex min-h-20 w-full items-center border-b border-solid border-cream/15 bg-forest/20 px-6 backdrop-blur-[2px] lg:px-10 xl:px-14">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3.5 text-cream">
            <AuthEmblem />
            <div className="min-w-0">
              <strong className="block truncate text-[16px] font-semibold leading-5 text-cream">Visionaries Village Banking</strong>
              <small className="mt-0.5 block truncate text-[10px] font-medium leading-4 text-cream/75">
                Stronger Together. Saving Today, Building Tomorrow.
              </small>
            </div>
          </div>

          {onBackToWelcome ? (
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-solid border-cream/30 bg-forest/20 text-gold transition hover:border-gold hover:bg-forest/45 focus-visible:outline-gold"
              onClick={onBackToWelcome}
              aria-label="Back to splash"
              title="Back to splash"
            >
              <ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative z-[1] mx-auto grid w-full max-w-[1440px] flex-1 items-center gap-10 px-6 py-7 md:justify-items-center lg:grid-cols-[minmax(0,1fr)_minmax(440px,540px)] lg:justify-items-stretch lg:px-10 lg:py-5 xl:px-14">
        <div className="hidden self-center lg:block">
          {!isSignup ? (
            <div className="max-w-[560px] text-cream drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
              <p className="m-0 font-serif text-[44px] font-semibold leading-[1.08] xl:text-[54px]">
                Welcome back
                <span className="mt-1 block text-gold">to your community.</span>
              </p>
              <p className="mb-0 mt-5 text-[14px] font-medium leading-6 text-cream/90">
                Secure records. Transparent banking. Shared progress.
              </p>
            </div>
          ) : null}
        </div>

        <section
          className={`relative w-full justify-self-center rounded-[16px] border border-solid border-cream/80 bg-white/95 shadow-[0_24px_70px_rgba(0,0,0,0.26)] backdrop-blur-md before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-[16px] before:bg-gold lg:justify-self-end ${isSignup ? "max-w-[540px] px-7 pb-6 pt-7 lg:px-7 lg:pb-5 lg:pt-6" : "max-w-[460px] px-8 pb-8 pt-9"}`}
          aria-label={`${title} form surface`}
        >
          {isSignup ? (
            <div className="mb-4 flex items-center justify-center gap-4 text-[11px] font-medium text-charcoal/55" aria-label="Signup form sections">
              <span className="relative font-semibold text-emerald after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-emerald">Identity</span>
              <span aria-hidden="true">·</span>
              <span>Contact</span>
              <span aria-hidden="true">·</span>
              <span>Security</span>
            </div>
          ) : null}

          <header className={isSignup ? "mb-4" : "mb-7"}>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-emerald">{eyebrow}</p>
            <h2 className="m-0 text-[32px] font-extrabold leading-[1.15] text-charcoal">{title}</h2>
            <p className="mb-0 mt-2 max-w-[440px] text-[14px] font-normal leading-[1.55] text-charcoal/70">{subtitle}</p>
          </header>

          {children}
        </section>
      </div>
    </section>
  );
}
