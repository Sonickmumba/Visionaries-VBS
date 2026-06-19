import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { api } from "./api/client.js";
import { Coins } from "lucide-react";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const LoginPage = lazyNamed(() => import("./pages/auth/LoginPage.jsx"), "LoginPage");
const PasswordRecoveryPage = lazyNamed(() => import("./pages/auth/PasswordRecoveryPage.jsx"), "PasswordRecoveryPage");
const SignupPage = lazyNamed(() => import("./pages/auth/SignupPage.jsx"), "SignupPage");
const PortalApp = lazyNamed(() => import("./PortalApp.jsx"), "PortalApp");

export function SplashScreen() {
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
        <div className="splash-progress" role="status" aria-live="polite" aria-label="Checking secure session">
          <span />
        </div>
      </section>
    </main>
  );
}

function LoadingFallback() {
  return (
    <SplashScreen />
  );
}

function DisabledAccount() {
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <h1>Visionaries Village Banking</h1>
        <p>Cycle-based savings, lending, declarations, penalties, common interest, and monthly closing.</p>
        <div className="auth-note">Built as a financial operations system with auditability at the center.</div>
      </section>
      <section className="auth-card">
        <h2>Account disabled</h2>
        <p>Your account is not active. Contact an administrator before continuing.</p>
      </section>
    </main>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [authMode, setAuthMode] = useState(() => (
    new URLSearchParams(window.location.search).has("resetToken") ? "forgot" : "login"
  ));
  const resetToken = useMemo(() => new URLSearchParams(window.location.search).get("resetToken") || "", []);

  useEffect(() => {
    let active = true;
    api("/auth/me")
      .then((response) => {
        if (!active) return;
        setUser(response.user);
        setPage(response.user?.role === "MEMBER" ? "member-dashboard" : "dashboard");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const authFallback = authMode === "signup" ? (
    <SignupPage onSignup={(nextUser) => {
      setUser(nextUser);
      setPage(nextUser.role === "MEMBER" ? "member-dashboard" : "dashboard");
    }} onBackToLogin={() => setAuthMode("login")} />
  ) : authMode === "forgot" ? (
    <PasswordRecoveryPage
      initialToken={resetToken}
      onBackToLogin={() => setAuthMode("login")}
    />
  ) : (
    <LoginPage
      onLogin={(nextUser) => {
        setUser(nextUser);
        setPage(nextUser.role === "MEMBER" ? "member-dashboard" : "dashboard");
      }}
      onSignup={() => setAuthMode("signup")}
      onForgotPassword={() => setAuthMode("forgot")}
    />
  );

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => null);
    setUser(null);
    setAuthMode("login");
  }

  if (checkingSession) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Suspense fallback={<LoadingFallback />}>{authFallback}</Suspense>;
  }

  if (user.is_active === false) {
    return <DisabledAccount />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PortalApp user={user} page={page} setPage={setPage} onLogout={logout} />
    </Suspense>
  );
}
