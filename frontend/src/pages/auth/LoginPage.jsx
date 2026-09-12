import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert } from "../../components/ui/index.jsx";
import splashArtwork from "../../assets/auth/background-image-splash.webp";
import { BrandMark } from "../../components/BrandMark.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { AuthDesktopShell } from "./AuthDesktopShell.jsx";
import "../../styles/auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneFrameClass = "relative min-h-[min(932px,calc(100svh-24px))] w-[min(100%,430px)] overflow-hidden rounded-[34px] border border-cream/20 font-sans text-cream shadow-[0_30px_90px_rgba(31,41,51,0.28)] md:hidden max-[430px]:flex max-[430px]:h-[100svh] max-[430px]:min-h-0 max-[430px]:w-full max-[430px]:flex-col max-[430px]:rounded-none max-[430px]:border-0 max-[430px]:shadow-none";

const backButtonClass = "absolute left-[22px] top-[58px] z-[8] grid h-[42px] w-[42px] place-items-center rounded-app border border-cream/25 bg-cream/10 text-cream backdrop-blur transition hover:bg-cream/20 max-[430px]:top-7 max-[380px]:top-5";
const loginHeroClass = "relative z-[2] grid min-h-[436px] content-start justify-items-center gap-2.5 px-[34px] pb-[84px] pt-[112px] text-center max-[430px]:h-[43svh] max-[430px]:min-h-[270px] max-[430px]:max-h-[390px] max-[430px]:shrink-0 max-[430px]:gap-2 max-[430px]:px-[26px] max-[430px]:pb-[72px] max-[430px]:pt-[72px] max-[380px]:pb-12 max-[380px]:pt-[68px] [@media(max-width:430px)_and_(max-height:620px)]:h-[282px] [@media(max-width:430px)_and_(max-height:620px)]:min-h-0 [@media(max-width:430px)_and_(max-height:620px)]:gap-1.5 [@media(max-width:430px)_and_(max-height:620px)]:px-5 [@media(max-width:430px)_and_(max-height:620px)]:pb-10 [@media(max-width:430px)_and_(max-height:620px)]:pt-12";
const loginSheetClass = "relative z-[4] -mt-[58px] flex min-h-[496px] w-full flex-col gap-3.5 rounded-t-[38px] px-[38px] pb-[34px] pt-12 text-charcoal shadow-[0_-20px_46px_rgba(31,41,51,0.14)] max-[430px]:-mt-[54px] max-[430px]:min-h-0 max-[430px]:flex-1 max-[430px]:gap-3 max-[430px]:px-6 max-[430px]:pb-[max(22px,env(safe-area-inset-bottom))] max-[430px]:pt-11 max-[380px]:-mt-8 max-[380px]:gap-2.5 max-[380px]:pt-7";
const primaryActionClass = "mt-1 grid h-14 shrink-0 grid-cols-[1fr_auto] items-center rounded-[18px] border-0 bg-gradient-to-br from-emerald to-forest px-4 text-xl font-black text-cream shadow-[0_14px_34px_rgba(13,59,46,0.22)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 max-[430px]:h-[54px] max-[430px]:text-lg max-[380px]:h-[50px] max-[380px]:text-base [@media(max-width:430px)_and_(max-height:620px)]:h-11";
const inputActionClass = "grid h-[34px] w-[34px] place-items-center rounded-full border-0 bg-transparent text-forest transition hover:bg-emerald/10";
const desktopLoginFormClass = "grid gap-4";
const desktopPrimaryActionClass = "relative mt-1 flex min-h-14 w-full items-center justify-center rounded-[14px] border-0 bg-gradient-to-br from-emerald to-forest px-12 text-[16px] font-semibold text-cream shadow-[0_12px_28px_rgba(13,59,46,0.2)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 [&_svg]:absolute [&_svg]:right-4 [&_svg]:text-gold";
// const phoneBackgroundStyle = {
//   backgroundImage: "radial-gradient(circle at 88% 9%, rgba(217, 162, 39, 0.42), transparent 16%), url(${splashArtwork}), linear-gradient(160deg, #0D3B2E 0%, #0D3B2E 58%, #127A5A 100%)",
// };

const phoneBackgroundStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(13, 59, 46, 0.08), rgba(13, 59, 46, 0.18)), url(${splashArtwork}), linear-gradient(160deg, #0D3B2E 0%, #0D3B2E 52%, #127A5A 100%)`,
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
};

const sheetBackgroundStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.98) 62%, rgba(247,244,238,0.76) 79%, rgba(247,244,238,0.24) 100%), url(${splashArtwork})`,
  // backgroundPosition: "center bottom",
  backgroundSize: "100% auto",
  backgroundRepeat: "no-repeat",
  backgroundColor: "#F7F4EE",
};

// const sheetBackgroundStyle = {
//   background:
//     "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(247,244,238,0.95) 100%)",
// };

export function validateLoginForm({ email, password }) {
  const errors = {};
  if (!String(email || "").trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(String(email).trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!String(password || "").trim()) {
    errors.password = "Password is required.";
  }

  return errors;
}

export function landingPageForRole(role) {
  return role === "MEMBER" ? "member-dashboard" : "dashboard";
}

export function friendlyLoginError(error) {
  const message = String(error?.message || "");
  if (!message || message === "Request failed") return "Login failed. Check your email and password, then try again.";
  if (/invalid|unauthorized|password|credential/i.test(message)) {
    return "Invalid email or password.";
  }
  return message;
}

export async function performLogin({ email, password, authApi = api }) {
  const errors = validateLoginForm({ email, password });
  if (Object.keys(errors).length) {
    const validationError = new Error("Validation failed");
    validationError.validationErrors = errors;
    throw validationError;
  }

  return authApi("/auth/login", {
    method: "POST",
    body: {
      email: String(email).trim().toLowerCase(),
      password,
    },
  });
}

function AuthInput({ label, icon: Icon, error, action, desktop = false, ...props }) {
  if (desktop) {
    return (
      <label className="grid gap-2 text-charcoal">
        <span className="text-[14px] font-semibold leading-5">{label}</span>
        <span className={`grid min-h-14 ${action ? "grid-cols-[24px_minmax(0,1fr)_40px]" : "grid-cols-[24px_minmax(0,1fr)]"} items-center gap-3 rounded-[14px] border border-solid bg-white px-4 text-forest transition focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(18,122,90,0.12)] ${error ? "border-alert" : "border-charcoal/20"}`}>
          {Icon ? <Icon size={19} strokeWidth={1.9} aria-hidden="true" /> : <span aria-hidden="true" />}
          <input className="min-w-0 border-0 bg-transparent text-[16px] font-medium text-charcoal outline-none placeholder:font-normal placeholder:text-charcoal/50" aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
          {action}
        </span>
        {error ? <small className="text-[12px] font-semibold text-alert">{error}</small> : null}
      </label>
    );
  }

  return (
    <label className={`relative grid min-h-[58px] w-full shrink-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 self-start rounded-[18px] border bg-white/85 px-4 text-forest transition focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(18,122,90,0.14)] max-[430px]:min-h-[54px] max-[430px]:rounded-[16px] max-[430px]:px-3.5 max-[380px]:min-h-[50px] max-[380px]:grid-cols-[30px_minmax(0,1fr)_auto] max-[380px]:gap-2 max-[380px]:rounded-[14px] [@media(max-width:430px)_and_(max-height:620px)]:min-h-11 ${error ? "border-alert" : "border-charcoal/20"}`}>
      <span className="sr-only">{label}</span>
      {Icon ? <Icon className="max-[380px]:h-5 max-[380px]:w-5" size={24} aria-hidden="true" /> : null}
      <input className="min-w-0 border-0 bg-transparent text-[17px] font-semibold text-charcoal outline-none placeholder:text-charcoal/55 max-[430px]:text-[15px] max-[380px]:text-sm" aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
      {action}
      {error ? <small className="col-span-full -mt-0.5 mb-1 ml-11 text-xs font-extrabold text-alert">{error}</small> : null}
    </label>
  );
}

export function LoginPage({
  onLogin,
  onNavigateSignup,
  onNavigateForgot,
  onSignup,
  onForgotPassword,
  onBackToWelcome,
  authApi = api,
  initialEmail = "admin@example.com",
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const rememberMe = true;
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigateSignup = onNavigateSignup || onSignup;
  const navigateForgot = onNavigateForgot || onForgotPassword;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (mfaRequired) {
      if (!/^\d{6}$/.test(mfaCode.trim())) {
        setError("Enter the 6-digit admin verification code.");
        return;
      }
      setLoading(true);
      try {
        const session = await authApi("/auth/mfa/verify", { method: "POST", body: { code: mfaCode.trim() } });
        onLogin?.(session.user, landingPageForRole(session.user?.role), { rememberMe });
      } catch (err) {
        setError(friendlyLoginError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    const nextErrors = validateLoginForm({ email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const session = await performLogin({ email, password, authApi });
      if (session.mfaRequired) {
        setMfaRequired(true);
        setPassword("");
        setError("");
        return;
      }
      onLogin?.(session.user, landingPageForRole(session.user?.role), { rememberMe });
    } catch (err) {
      setError(err.validationErrors ? "Check the highlighted fields." : friendlyLoginError(err));
      if (err.validationErrors) setErrors(err.validationErrors);
    } finally {
      setLoading(false);
    }
  }

  function renderLoginControls(actionClass = primaryActionClass, desktop = false) {
    return (
      <>
        <AuthInput
          label="Email"
          value={email}
          onChange={(value) => {
            setEmail(value.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: "" }));
          }}
          type="email"
          placeholder="Phone Number or Email"
          autoComplete="email"
          error={errors.email}
          icon={desktop ? Mail : UserRound}
          desktop={desktop}
        />

        {mfaRequired ? (
          <AuthInput
            label="Admin verification code"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            type="text"
            placeholder="6-digit code"
            autoComplete="one-time-code"
            icon={ShieldCheck}
            desktop={desktop}
          />
        ) : (
          <AuthInput
            label="Password"
            value={password}
            onChange={(value) => {
              setPassword(value.target.value);
              if (errors.password) setErrors((current) => ({ ...current, password: "" }));
            }}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            error={errors.password}
            icon={Lock}
            desktop={desktop}
            action={(
              <button type="button" className={inputActionClass} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
              </button>
            )}
          />
        )}

        {!mfaRequired ? (
          <div className="flex min-h-7 justify-end">
            <button type="button" className={`border-0 bg-transparent text-[14px] font-semibold text-forest ${desktop ? "hover:underline" : "font-black"}`} onClick={navigateForgot}>Forgot password?</button>
          </div>
        ) : null}

        {error ? <Alert tone="danger" title="Unable to log in">{error}</Alert> : null}

        <button type="submit" className={actionClass} disabled={loading} aria-busy={loading ? "true" : undefined}>
          <span>{mfaRequired ? "Verify Code" : "Log In"}</span>
          <ArrowRight size={26} aria-hidden="true" />
        </button>

        <p className={`mb-0 mt-auto w-full text-center font-medium text-charcoal ${desktop ? "text-[14px]" : "text-base max-[380px]:text-[13px] [@media(max-width:430px)_and_(max-height:620px)]:text-xs"}`}>Don't have an account? <button className="border-0 bg-transparent font-semibold text-forest hover:underline" type="button" disabled={loading} onClick={navigateSignup}>Sign Up</button></p>
      </>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full">
        <AuthDesktopShell
          eyebrow="Secure member access"
          title="Welcome Back"
          subtitle="Sign in to continue saving and growing together."
          variant="login"
          onBackToWelcome={onBackToWelcome}
        >
          <form className={desktopLoginFormClass} onSubmit={submit} noValidate>
            {renderLoginControls(desktopPrimaryActionClass, true)}
          </form>
        </AuthDesktopShell>

        <form className={phoneFrameClass} style={phoneBackgroundStyle} onSubmit={submit} noValidate>
        {/* <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div> */}
        <div className="auth-orbit" aria-hidden="true" />
        {onBackToWelcome ? (
          <button type="button" className={backButtonClass} onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className={loginHeroClass}>
          <BrandMark size="lg" className="auth-hero-mark text-cream max-[430px]:[&_.brand-mark]:!h-24 max-[430px]:[&_.brand-mark]:!w-24 max-[380px]:[&_.brand-mark]:!h-20 max-[380px]:[&_.brand-mark]:!w-20 [@media(max-width:430px)_and_(max-height:620px)]:[&_.brand-mark]:!h-16 [@media(max-width:430px)_and_(max-height:620px)]:[&_.brand-mark]:!w-16" />
          <h1 className="m-0 whitespace-nowrap text-[clamp(30px,11vw,41px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.26)] max-[380px]:text-[32px] [@media(max-width:430px)_and_(max-height:620px)]:text-[28px]">Village Banking</h1>
          <span className="h-[1px] w-[58px] rounded-full bg-gold shadow-[0_4px_12px_rgba(217,162,39,0.36)]" aria-hidden="true" />
          <h2 className="mb-0 mt-2 text-[clamp(14px,3.5vw,20px)] font-black leading-none text-gold max-[380px]:text-lg [@media(max-width:430px)_and_(max-height:620px)]:mt-1 [@media(max-width:430px)_and_(max-height:620px)]:text-base">Welcome Back</h2>
          <p className="m-0 max-w-[220px] text-[clamp(11px,3.2vw,13px)] leading-snug text-cream max-[380px]:text-xs">Sign in to continue saving and growing together.</p>
        </div>

        <section className={loginSheetClass} style={sheetBackgroundStyle} aria-label="Log in form">
          {renderLoginControls()}
        </section>
        </form>
      </div>
    </AuthLayout>
  );
}
