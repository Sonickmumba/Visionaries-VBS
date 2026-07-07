import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Smartphone, UserRound, UserPlus } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button } from "../../components/ui/index.jsx";
import splashArtwork from "../../assets/auth/background-image-splash.png";
import { BrandMark } from "../../components/BrandMark.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { DevEmailLink } from "./DevEmailLink.jsx";
import "../../styles/auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const signupPhoneClass = "relative min-h-[min(982px,calc(100svh-24px))] w-[min(100%,430px)] overflow-hidden rounded-[34px] border border-cream/20 font-sans text-cream shadow-[0_30px_90px_rgba(31,41,51,0.28)] after:absolute after:bottom-2.5 after:left-1/2 after:z-[7] after:h-[5px] after:w-[122px] after:-translate-x-1/2 after:rounded-full after:bg-cream/90 max-[430px]:flex max-[430px]:h-[100svh] max-[430px]:min-h-0 max-[430px]:w-full max-[430px]:flex-col max-[430px]:rounded-none max-[430px]:border-0 max-[430px]:shadow-none";
const signupHeroClass = "relative z-[2] grid min-h-[520px] content-start justify-items-start gap-[50px] px-[34px] pb-[58px] pt-[92px] text-left max-[430px]:min-h-0 max-[430px]:shrink-0 max-[430px]:gap-9 max-[430px]:px-6 max-[430px]:pb-[58px] max-[430px]:pt-[86px] max-[380px]:gap-5 max-[380px]:pb-9 max-[380px]:pt-[54px]";
const signupSheetClass = "relative z-[5] mx-7 -mt-32 grid gap-2.5 rounded-[28px] bg-white/95 px-7 pb-7 pt-[30px] text-charcoal shadow-[0_22px_56px_rgba(31,41,51,0.16)] max-[430px]:mx-5 max-[430px]:-mt-12 max-[430px]:flex-1 max-[430px]:gap-2 max-[430px]:overflow-hidden max-[430px]:px-5 max-[430px]:pb-[max(18px,env(safe-area-inset-bottom))] max-[430px]:pt-5 max-[380px]:mx-4 max-[380px]:-mt-8 max-[380px]:gap-1.5 max-[380px]:px-4 max-[380px]:pt-4";
const successHeroClass = "relative z-[2] grid min-h-[300px] justify-items-center gap-2.5 px-[34px] pb-12 pt-[92px] text-center";
const successSheetClass = "relative z-[5] mx-6 -mt-9 grid gap-3.5 rounded-[28px] bg-white/95 p-7 text-charcoal shadow-[0_22px_56px_rgba(31,41,51,0.16)]";
const backButtonClass = "absolute left-[22px] top-[58px] z-[8] grid h-[42px] w-[42px] place-items-center rounded-app border border-cream/25 bg-cream/10 text-cream backdrop-blur transition hover:bg-cream/20 max-[430px]:top-7 max-[380px]:top-4";
const inputActionClass = "grid h-[34px] w-[34px] place-items-center rounded-full border-0 bg-transparent text-forest transition hover:bg-emerald/10";
const signupActionClass = "grid min-h-[66px] grid-cols-[auto_1fr] items-center gap-4 rounded-[18px] border-0 bg-gradient-to-br from-emerald to-forest px-6 text-center text-[22px] font-black text-cream shadow-[0_14px_34px_rgba(13,59,46,0.22)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 max-[430px]:min-h-[58px] max-[430px]:text-xl max-[380px]:min-h-[54px] max-[380px]:text-lg";
const phoneBackgroundStyle = {
  backgroundImage: "radial-gradient(circle at 88% 9%, rgba(217, 162, 39, 0.42), transparent 16%), linear-gradient(180deg, #0D3B2E 0%, #0D3B2E 56%, #127A5A 100%)",
};
const landscapeStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(247,244,238,0.28), rgba(247,244,238,0.02)), url(${splashArtwork})`,
  backgroundPosition: "center bottom",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
  backgroundColor: "#F7F4EE",
};

export function validateSignupForm({ firstName, lastName, email, password, confirmPassword }) {
  const errors = {};
  if (!String(firstName || "").trim()) errors.firstName = "First name is required.";
  if (!String(lastName || "").trim()) errors.lastName = "Last name is required.";
  if (!String(email || "").trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(String(email).trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!String(password || "")) {
    errors.password = "Password is required.";
  } else if (String(password).length < 10) {
    errors.password = "Password must be at least 10 characters.";
  }
  if (!String(confirmPassword || "")) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export function signupPayload(form) {
  return {
    firstName: String(form.firstName || "").trim(),
    lastName: String(form.lastName || "").trim(),
    phone: String(form.phone || "").trim() || null,
    email: String(form.email || "").trim().toLowerCase(),
    password: form.password,
  };
}

export async function performSignup({ form, authApi = api }) {
  const errors = validateSignupForm(form);
  if (Object.keys(errors).length) {
    const validationError = new Error("Validation failed");
    validationError.validationErrors = errors;
    throw validationError;
  }
  return authApi("/auth/signup", {
    method: "POST",
    body: signupPayload(form),
  });
}

function AuthInput({ label, icon: Icon, error, action, ...props }) {
  return (
    <label className={`relative grid min-h-[54px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[18px] border bg-white/80 px-4 text-forest transition focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(18,122,90,0.14)] max-[430px]:min-h-[44px] max-[430px]:grid-cols-[26px_minmax(0,1fr)_auto] max-[430px]:gap-1.5 max-[430px]:rounded-[15px] max-[430px]:px-3 max-[380px]:rounded-[14px] ${error ? "border-alert" : "border-charcoal/20"}`}>
      <span className="sr-only">{label}</span>
      {Icon ? <Icon size={23} aria-hidden="true" /> : null}
      <input className="min-w-0 border-0 bg-transparent text-[17px] font-semibold text-charcoal outline-none placeholder:text-charcoal/55 max-[430px]:text-[13px] max-[380px]:text-xs" aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
      {action}
      {error ? <small className="col-span-full -mt-0.5 mb-1 ml-11 text-xs font-extrabold text-alert">{error}</small> : null}
    </label>
  );
}

export function SignupPage({ onSignup, onBackToLogin, onBackToWelcome, authApi = api }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const nextErrors = validateSignupForm(form);
    if (!acceptedTerms) nextErrors.terms = "Accept the terms and privacy policy.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const session = await performSignup({ form, authApi });
      setSuccess(session);
    } catch (err) {
      setError(err.validationErrors ? "Check the highlighted fields." : err.message || "Signup failed.");
      if (err.validationErrors) setErrors(err.validationErrors);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <section className={signupPhoneClass} style={phoneBackgroundStyle}>
          <div className={successHeroClass}>
            <BrandMark size="lg" className="auth-hero-mark text-cream max-[430px]:[&_.brand-mark]:!h-16 max-[430px]:[&_.brand-mark]:!w-16" />
            <h1 className="m-0 text-[clamp(40px,10vw,56px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.26)]">Visionaries<br />Village Banking</h1>
          </div>
          <div className={successSheetClass}>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-emerald/10 text-emerald"><UserPlus size={20} aria-hidden="true" /></span>
              <div>
                <span className="text-[11px] font-black uppercase text-emerald">Check your email</span>
                <h2 className="mt-1 text-2xl font-extrabold text-charcoal">Account created</h2>
                <p className="mt-2 text-sm leading-6 text-charcoal/70">Verify your email before signing in.</p>
              </div>
            </div>
            <Alert tone="success" title="Verification email sent">
              We sent a verification link to {success.email || "your email"}. Open it to activate your account.
            </Alert>
            <DevEmailLink delivery={success.delivery} />
            <Button type="button" variant="secondary" onClick={onBackToLogin}>Back to Login</Button>
          </div>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className={signupPhoneClass} style={phoneBackgroundStyle} onSubmit={submit} noValidate>
        {/* <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div> */}
        <div className="auth-orbit" aria-hidden="true" />
        {onBackToWelcome ? (
          <button type="button" className={backButtonClass} onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className={signupHeroClass}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[22px]">
            <BrandMark size="lg" className="auth-hero-mark text-cream max-[430px]:[&_.brand-mark]:!h-[82px] max-[430px]:[&_.brand-mark]:!w-[82px] max-[380px]:[&_.brand-mark]:!h-16 max-[380px]:[&_.brand-mark]:!w-16" />
            <div>
              <h1 className="m-0 text-[clamp(42px,10vw,58px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.26)] max-[380px]:text-[clamp(34px,9vw,48px)]">Visionaries<br />Village Banking</h1>
              <p className="m-0 mt-2 max-w-[280px] text-[clamp(15px,4vw,17px)] font-bold leading-snug text-cream max-[380px]:mt-1 max-[380px]:text-[clamp(12px,3.5vw,15px)]">Stronger Together. Saving Today, Building Tomorrow.</p>
            </div>
          </div>
          <div>
            <h2 className="m-0 text-[clamp(40px,9.5vw,56px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.24)] max-[380px]:text-[clamp(32px,8.5vw,44px)]">Create Account</h2>
            <p className="m-0 mt-2 max-w-[310px] text-[clamp(17px,4.5vw,19px)] font-bold leading-snug text-cream max-[380px]:mt-1 max-[380px]:text-[clamp(13px,3.8vw,17px)]">Join your community and start saving together.</p>
          </div>
        </div>

        <section className={signupSheetClass} aria-label="Create account form">
          <div className="grid gap-2 max-[430px]:grid-cols-2">
            <AuthInput
              label="First Name"
              value={form.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              autoComplete="given-name"
              placeholder="First Name"
              error={errors.firstName}
              icon={UserRound}
            />
            <AuthInput label="Last Name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" placeholder="Last Name" error={errors.lastName} icon={UserRound} />
          </div>
          <AuthInput label="Phone Number" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" placeholder="Phone Number" icon={Smartphone} />
          <AuthInput label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" placeholder="Email" error={errors.email} icon={Mail} />
          <AuthInput
            label="Password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Password"
            error={errors.password}
            icon={Lock}
            action={(
              <button type="button" className={inputActionClass} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
              </button>
            )}
          />
          <AuthInput
            label="Confirm password"
            value={form.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm Password"
            error={errors.confirmPassword}
            icon={Lock}
            action={(
              <button type="button" className={inputActionClass} onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                {showConfirmPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
              </button>
            )}
          />

          <label className={`flex items-center gap-3 text-[15px] font-semibold text-charcoal max-[430px]:gap-2 max-[430px]:text-[13px] max-[380px]:text-xs ${errors.terms ? "text-alert" : ""}`}>
            <input className="h-6 w-6 rounded-app border border-forest accent-emerald max-[430px]:h-[22px] max-[430px]:w-[22px] max-[380px]:h-5 max-[380px]:w-5" type="checkbox" checked={acceptedTerms} onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              if (errors.terms) setErrors((current) => ({ ...current, terms: "" }));
            }} />
            <span>I agree to the <strong>Terms &amp; Privacy Policy</strong></span>
          </label>
          {errors.terms ? <small className="-mt-2 ml-1 text-xs font-extrabold text-alert">{errors.terms}</small> : null}

          {error ? <Alert tone="danger" title="Unable to create account">{error}</Alert> : null}

          <button type="submit" className={signupActionClass} disabled={loading} aria-busy={loading ? "true" : undefined}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold text-forest max-[430px]:h-11 max-[430px]:w-11 max-[380px]:h-10 max-[380px]:w-10"><ArrowRight size={24} aria-hidden="true" /></span>
            <span>Create Account</span>
          </button>

          <p className="my-0 text-center text-base font-semibold text-charcoal max-[430px]:text-[15px] max-[380px]:text-sm">Already have an account? <button className="border-0 bg-transparent font-black text-forest" type="button" disabled={loading} onClick={onBackToLogin}>Log In</button></p>
        </section>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2] min-h-[260px] opacity-95" style={landscapeStyle} aria-hidden="true" />
      </form>
    </AuthLayout>
  );
}
