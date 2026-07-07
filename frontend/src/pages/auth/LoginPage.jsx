import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, ShieldCheck, UserRound } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert } from "../../components/ui/index.jsx";
import splashArtwork from "../../assets/auth/background-image-splash.png";
import { BrandMark } from "../../components/BrandMark.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import "../../styles/auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneFrameClass = "relative min-h-[min(932px,calc(100svh-24px))] w-[min(100%,430px)] overflow-hidden rounded-[34px] border border-cream/20 font-sans text-cream shadow-[0_30px_90px_rgba(31,41,51,0.28)] max-[430px]:flex max-[430px]:h-[100svh] max-[430px]:min-h-0 max-[430px]:w-full max-[430px]:flex-col max-[430px]:rounded-none max-[430px]:border-0 max-[430px]:shadow-none";
const backButtonClass = "absolute left-[22px] top-[58px] z-[8] grid h-[42px] w-[42px] place-items-center rounded-app border border-cream/25 bg-cream/10 text-cream backdrop-blur transition hover:bg-cream/20 max-[430px]:top-6";
const loginHeroClass = "relative z-[2] grid min-h-[436px] justify-items-center gap-2.5 px-[34px] pb-[84px] pt-[112px] text-center max-[430px]:min-h-0 max-[430px]:shrink-0 max-[430px]:gap-1.5 max-[430px]:px-[26px] max-[430px]:pb-12 max-[430px]:pt-[72px]";
const loginSheetClass = "relative z-[4] -mt-[58px] grid min-h-[496px] w-full gap-3.5 rounded-t-[38px] px-[38px] pb-[34px] pt-12 text-charcoal shadow-[0_-20px_46px_rgba(31,41,51,0.14)] max-[430px]:-mt-8 max-[430px]:min-h-0 max-[430px]:flex-1 max-[430px]:gap-2.5 max-[430px]:px-6 max-[430px]:pb-[max(18px,env(safe-area-inset-bottom))] max-[430px]:pt-7";
const primaryActionClass = "mt-1.5 grid min-h-16 grid-cols-[1fr_auto] items-center rounded-[18px] border-0 bg-gradient-to-br from-emerald to-forest px-6 text-xl font-black text-cream shadow-[0_14px_34px_rgba(13,59,46,0.22)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 max-[430px]:min-h-[58px] max-[430px]:text-lg";
const inputActionClass = "grid h-[34px] w-[34px] place-items-center rounded-full border-0 bg-transparent text-forest transition hover:bg-emerald/10";
const phoneBackgroundStyle = {
  backgroundImage: "radial-gradient(circle at 88% 9%, rgba(217, 162, 39, 0.42), transparent 16%), linear-gradient(160deg, #0D3B2E 0%, #0D3B2E 58%, #127A5A 100%)",
};
const sheetBackgroundStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.98) 62%, rgba(247,244,238,0.76) 79%, rgba(247,244,238,0.24) 100%), url(${splashArtwork})`,
  backgroundPosition: "center bottom",
  backgroundSize: "132% auto",
  backgroundRepeat: "no-repeat",
  backgroundColor: "#F7F4EE",
};

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

function AuthInput({ label, icon: Icon, error, action, ...props }) {
  return (
    <label className={`relative grid min-h-16 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[18px] border bg-white/85 px-4 text-forest transition focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(18,122,90,0.14)] ${error ? "border-alert" : "border-charcoal/20"}`}>
      <span className="sr-only">{label}</span>
      {Icon ? <Icon size={24} aria-hidden="true" /> : null}
      <input className="min-w-0 border-0 bg-transparent text-[17px] font-semibold text-charcoal outline-none placeholder:text-charcoal/55" aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
      {action}
      {error ? <small className="col-span-full -mt-0.5 mb-2 ml-11 text-xs font-extrabold text-alert">{error}</small> : null}
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

  return (
    <AuthLayout>
      <form className={phoneFrameClass} style={phoneBackgroundStyle} onSubmit={submit} noValidate>
        {/* <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div> */}
        <div className="auth-orbit" aria-hidden="true" />
        {onBackToWelcome ? (
          <button type="button" className={backButtonClass} onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className={loginHeroClass}>
          <BrandMark size="lg" className="auth-hero-mark text-cream max-[430px]:[&_.brand-mark]:!h-20 max-[430px]:[&_.brand-mark]:!w-20" />
          <h1 className="whitespace-nowrap text-[clamp(38px,10vw,56px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.26)]">Village Banking</h1>
          <span className="h-[3px] w-[58px] rounded-full bg-gold shadow-[0_4px_12px_rgba(217,162,39,0.36)]" aria-hidden="true" />
          <h2 className="mt-2 text-[clamp(26px,7vw,36px)] font-black leading-none text-gold">Welcome Back</h2>
          <p className="m-0 max-w-[310px] text-[clamp(15px,4.2vw,19px)] font-bold leading-snug text-cream">Sign in to continue saving and growing together.</p>
        </div>

        <section className={loginSheetClass} style={sheetBackgroundStyle} aria-label="Log in form">
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
          icon={UserRound}
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
            action={(
              <button type="button" className={inputActionClass} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
              </button>
            )}
          />
        )}

        {!mfaRequired ? (
          <div className="flex min-h-7 justify-end">
            <button type="button" className="border-0 bg-transparent text-sm font-black text-forest" onClick={navigateForgot}>Forgot password?</button>
          </div>
        ) : null}

        {error ? <Alert tone="danger" title="Unable to log in">{error}</Alert> : null}

          <button type="submit" className={primaryActionClass} disabled={loading} aria-busy={loading ? "true" : undefined}>
            <span>{mfaRequired ? "Verify Code" : "Log In"}</span>
            <ArrowRight size={26} aria-hidden="true" />
          </button>

          <p className="mb-0 mt-auto self-end text-center text-base font-semibold text-charcoal">Don't have an account? <button className="border-0 bg-transparent font-black text-forest" type="button" disabled={loading} onClick={navigateSignup}>Sign Up</button></p>
        </section>
      </form>
    </AuthLayout>
  );
}
