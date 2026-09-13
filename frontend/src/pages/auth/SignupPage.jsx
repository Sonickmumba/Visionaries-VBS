import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Smartphone, UserRound, UserPlus } from "lucide-react";
import { api } from "../../api/client.js";
import { Alert, Button } from "../../components/ui/index.jsx";
import splashArtwork from "../../assets/auth/background-image-splash.webp";
import { BrandMark } from "../../components/BrandMark.jsx";
import { AuthLayout } from "../../layouts/AppLayouts.jsx";
import { DevEmailLink } from "./DevEmailLink.jsx";
import { AuthDesktopShell } from "./AuthDesktopShell.jsx";
import {
  signupActionClass,
  signupBackButtonClass,
  signupHeroClass,
  signupInputActionClass,
  signupPhoneClass,
  signupSheetClass,
  signupSuccessHeroClass,
  signupSuccessSheetClass,
} from "./authTailwind.js";
import "../../styles/auth.css";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneBackgroundStyle = {
  backgroundImage: `linear-gradient(180deg, rgba(13,59,46,0.98) 0%, rgba(13,59,46,0.92) 44%, rgba(18,122,90,0.72) 100%), url(${splashArtwork})`,
  backgroundPosition: "center bottom",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
};
const signupDesktopFormClass = "grid gap-4 text-charcoal lg:gap-2.5";
const signupDesktopActionClass = "relative mt-1 flex min-h-14 w-full items-center justify-center rounded-[14px] border-0 bg-gradient-to-br from-emerald to-forest px-12 text-[16px] font-semibold text-cream shadow-[0_12px_28px_rgba(13,59,46,0.2)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 lg:min-h-11 lg:text-[15px]";

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

function AuthInput({ label, icon: Icon, error, action, desktop = false, ...props }) {
  if (desktop) {
    return (
      <label className="grid gap-2 text-charcoal lg:gap-1.5">
        <span className="text-[14px] font-semibold leading-5 lg:text-[12px] lg:leading-4">{label}</span>
        <span className={`grid min-h-14 ${action ? "grid-cols-[24px_minmax(0,1fr)_40px]" : "grid-cols-[24px_minmax(0,1fr)]"} items-center gap-3 rounded-[14px] border border-solid bg-white px-4 text-forest transition focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(18,122,90,0.12)] lg:min-h-11 lg:rounded-[12px] ${error ? "border-alert" : "border-charcoal/20"}`}>
          {Icon ? <Icon size={19} strokeWidth={1.9} aria-hidden="true" /> : null}
          <input className="min-w-0 border-0 bg-transparent text-[16px] font-medium text-charcoal outline-none placeholder:font-normal placeholder:text-charcoal/50 lg:text-[14px]" aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
          {action}
        </span>
        {error ? <small className="text-[12px] font-semibold text-alert">{error}</small> : null}
      </label>
    );
  }

  return (
    <label className={`relative grid min-h-[54px] shrink-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[18px] border bg-white/80 px-4 text-forest transition focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(18,122,90,0.14)] max-[430px]:min-h-12 max-[430px]:grid-cols-[28px_minmax(0,1fr)_auto] max-[430px]:gap-2 max-[430px]:rounded-[15px] max-[430px]:px-3 max-[380px]:min-h-11 max-[380px]:rounded-[14px] [@media(max-width:430px)_and_(max-height:620px)]:min-h-10 [@media(max-width:430px)_and_(max-height:620px)]:rounded-[12px] ${error ? "border-alert" : "border-charcoal/20"}`}>
      <span className="sr-only">{label}</span>
      {Icon ? <Icon className="[@media(max-width:430px)_and_(max-height:620px)]:h-[18px] [@media(max-width:430px)_and_(max-height:620px)]:w-[18px]" size={23} aria-hidden="true" /> : null}
      <input className="min-w-0 border-0 bg-transparent text-[17px] font-semibold text-charcoal outline-none placeholder:text-charcoal/55 max-[430px]:text-sm max-[380px]:text-[13px]" aria-label={label} aria-invalid={error ? "true" : undefined} {...props} />
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

  function renderTerms(desktop = false) {
    return (
      <>
        <label className={`flex items-center gap-3 font-medium text-charcoal max-[430px]:gap-2 max-[430px]:text-xs ${desktop ? "text-[14px] lg:text-[12px]" : "text-[15px]"} ${errors.terms ? "text-alert" : ""}`}>
          <input className={`${desktop ? "h-5 w-5" : "h-6 w-6"} rounded-app border border-forest accent-emerald max-[430px]:h-[22px] max-[430px]:w-[22px] max-[380px]:h-5 max-[380px]:w-5`} type="checkbox" checked={acceptedTerms} onChange={(event) => {
            setAcceptedTerms(event.target.checked);
            if (errors.terms) setErrors((current) => ({ ...current, terms: "" }));
          }} />
          <span>I agree to the <strong className="font-semibold text-forest">Terms &amp; Privacy Policy</strong></span>
        </label>
        {errors.terms ? <small className="-mt-2 ml-1 text-xs font-extrabold text-alert">{errors.terms}</small> : null}
      </>
    );
  }

  function renderPasswordFields(desktop = false) {
    return (
      <>
        <AuthInput
          label="Password"
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={desktop ? "Create password" : "Password"}
          error={errors.password}
          icon={Lock}
          desktop={desktop}
          action={(
            <button type="button" className={signupInputActionClass} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
            </button>
          )}
        />
        {desktop ? <small className="-mt-2 text-[13px] font-normal leading-5 text-charcoal/60 lg:text-[11px] lg:leading-4">Use at least 10 characters.</small> : null}
        <AuthInput
          label="Confirm Password"
          value={form.confirmPassword}
          onChange={(event) => update("confirmPassword", event.target.value)}
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={desktop ? "Confirm password" : "Confirm Password"}
          error={errors.confirmPassword}
          icon={Lock}
          desktop={desktop}
          action={(
            <button type="button" className={signupInputActionClass} onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
              {showConfirmPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
            </button>
          )}
        />
      </>
    );
  }

  function renderSignupAction(actionClass = signupActionClass, desktop = false) {
    return (
      <>
        {error ? <Alert tone="danger" title="Unable to create account">{error}</Alert> : null}
        <button type="submit" className={actionClass} disabled={loading} aria-busy={loading ? "true" : undefined}>
          <span className={desktop ? "absolute right-4 grid place-items-center text-gold" : "grid h-11 w-11 place-items-center rounded-full bg-gold text-forest max-[430px]:h-10 max-[430px]:w-10 max-[380px]:h-9 max-[380px]:w-9"}><ArrowRight size={21} aria-hidden="true" /></span>
          <span>Create Account</span>
        </button>
        <p className={`my-0 text-center font-medium text-charcoal max-[430px]:text-sm max-[380px]:text-xs ${desktop ? "text-[14px] lg:text-[12px]" : "text-base"}`}>Already have an account? <button className="border-0 bg-transparent font-semibold text-forest hover:underline" type="button" disabled={loading} onClick={onBackToLogin}>Log In</button></p>
      </>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="w-full">
          <AuthDesktopShell
            eyebrow="Email verification"
            title="Check your email"
            subtitle="Your account was created. Verify your email before signing in to the village banking portal."
            variant="signup"
          >
            <section className="grid gap-4">
              <Alert tone="success" title="Verification email sent">
                We sent a verification link to {success.email || "your email"}. Open it to activate your account.
              </Alert>
              <DevEmailLink delivery={success.delivery} />
              <Button type="button" variant="secondary" onClick={onBackToLogin}>Back to Login</Button>
            </section>
          </AuthDesktopShell>

          <section className={signupPhoneClass} style={phoneBackgroundStyle}>
            <div className={signupSuccessHeroClass}>
              <BrandMark size="lg" className="auth-hero-mark text-cream max-[430px]:[&_.brand-mark]:!h-16 max-[430px]:[&_.brand-mark]:!w-16" />
              <h1 className="m-0 text-[clamp(34px,8vw,44px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.26)]">Visionaries<br />Village Banking</h1>
            </div>
            <div className={signupSuccessSheetClass}>
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
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full">
        <AuthDesktopShell
          eyebrow="Create member access"
          title="Create Account"
          subtitle="Join your community and start saving together."
          variant="signup"
          onBackToWelcome={onBackToWelcome}
        >
          <form className={signupDesktopFormClass} onSubmit={submit} noValidate>
            <AuthInput desktop label="First Name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" placeholder="First Name" error={errors.firstName} icon={UserRound} />
            <AuthInput desktop label="Last Name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" placeholder="Last Name" error={errors.lastName} icon={UserRound} />
            <AuthInput desktop label="Phone Number" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" placeholder="Phone Number" icon={Smartphone} />
            <AuthInput desktop label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" placeholder="Email" error={errors.email} icon={Mail} />
            {renderPasswordFields(true)}
            {renderTerms(true)}
            {renderSignupAction(signupDesktopActionClass, true)}
          </form>
        </AuthDesktopShell>

        <form className={signupPhoneClass} style={phoneBackgroundStyle} onSubmit={submit} noValidate>
        {/* <div className="auth-status-bar" aria-hidden="true"><span>9:41</span><span className="auth-device-icons">▮▮▮ ))) ▭</span></div> */}
        {/* <div className="auth-orbit" aria-hidden="true" /> */}
        {onBackToWelcome ? (
          <button type="button" className={signupBackButtonClass} onClick={onBackToWelcome} aria-label="Back to welcome">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <div className={signupHeroClass}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 [@media(max-height:680px)]:gap-3">
            <BrandMark size="lg" className="auth-hero-mark text-cream max-[430px]:[&_.brand-mark]:!h-[72px] max-[430px]:[&_.brand-mark]:!w-[72px] max-[380px]:[&_.brand-mark]:!h-16 max-[380px]:[&_.brand-mark]:!w-16 [@media(max-height:680px)]:[&_.brand-mark]:!h-14 [@media(max-height:680px)]:[&_.brand-mark]:!w-14" />
            <div>
              <h1 className="m-0 text-[clamp(27px,6.8vw,34px)] font-black leading-none text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.26)] max-[380px]:text-[clamp(24px,6.2vw,30px)] [@media(max-height:680px)]:text-[clamp(21px,5.6vw,26px)]">Visionaries<br />Village Banking</h1>
              <p className="m-0 mt-1 max-w-[260px] text-[clamp(12px,3vw,14px)] font-medium leading-snug text-cream/90 max-[380px]:mt-0.5 max-[380px]:text-[11px] [@media(max-height:700px)]:hidden">Stronger Together. Saving Today, Building Tomorrow.</p>
            </div>
          </div>
          <div>
            <h2 className="m-0 text-[clamp(21px,5.2vw,27px)] font-extrabold leading-tight text-cream drop-shadow-[0_5px_16px_rgba(31,41,51,0.24)] max-[380px]:text-[clamp(19px,4.9vw,24px)] [@media(max-height:680px)]:text-[clamp(18px,4.6vw,22px)]">Create Account</h2>
            <p className="m-0 mt-1 max-w-[280px] text-[clamp(11px,2.9vw,13px)] font-medium leading-snug text-cream/90 max-[380px]:mt-0.5 max-[380px]:text-[10px] [@media(max-height:680px)]:text-[10px] [@media(max-height:620px)]:hidden">Join your community and start saving together.</p>
          </div>
        </div>

        <section className={signupSheetClass} aria-label="Create account form">
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
          <AuthInput label="Phone Number" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" placeholder="Phone Number" icon={Smartphone} />
          <AuthInput label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" autoComplete="email" placeholder="Email" error={errors.email} icon={Mail} />
          {renderPasswordFields()}
          {renderTerms()}
          {renderSignupAction()}
        </section>
        </form>
      </div>
    </AuthLayout>
  );
}
