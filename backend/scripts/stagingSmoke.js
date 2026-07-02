import dotenv from "dotenv";
import IORedis from "ioredis";
import { v2 as cloudinary } from "cloudinary";
import { Resend } from "resend";

dotenv.config();

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status === "pass" ? "PASS" : status === "skip" ? "SKIP" : "FAIL"} ${name}${suffix}`);
}

function errorMessage(error) {
  if (!error) return "unknown error";
  return error.message || error.error?.message || error.code || error.http_code || JSON.stringify(error);
}

function requireHttpsUrl(name, value) {
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url;
}

function cookieHeader(cookies) {
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function setCookies(headers) {
  if (headers.getSetCookie) return headers.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function assertSetCookieSecurity(setCookie = []) {
  const text = setCookie.join("; ");
  for (const required of ["HttpOnly", "Secure", "SameSite=Lax"]) {
    if (!text.includes(required)) throw new Error(`session cookie missing ${required}`);
  }
}

async function testCorsAndCookies() {
  const apiUrl = process.env.STAGING_API_URL;
  const frontendOrigin = process.env.STAGING_FRONTEND_ORIGIN;
  if (!apiUrl || !frontendOrigin) {
    record("HTTPS cookie and real-domain CORS", "skip", "set STAGING_API_URL and STAGING_FRONTEND_ORIGIN");
    return;
  }

  const api = requireHttpsUrl("STAGING_API_URL", apiUrl);
  const allowedOrigin = requireHttpsUrl("STAGING_FRONTEND_ORIGIN", frontendOrigin).origin;
  const badOrigin = process.env.STAGING_BAD_ORIGIN || "https://not-allowed.example";

  const health = await fetch(new URL("/health", api), { headers: { Origin: allowedOrigin } });
  if (health.headers.get("access-control-allow-origin") !== allowedOrigin) {
    throw new Error("allowed origin did not receive matching Access-Control-Allow-Origin");
  }

  const blocked = await fetch(new URL("/health", api), { headers: { Origin: badOrigin } });
  if (blocked.headers.get("access-control-allow-origin")) {
    throw new Error("disallowed origin received Access-Control-Allow-Origin");
  }

  const csrf = await fetch(new URL("/api/auth/csrf", api), { headers: { Origin: allowedOrigin } });
  const csrfBody = await csrf.json().catch(() => ({}));
  const cookies = setCookies(csrf.headers);
  if (!csrfBody.csrfToken) throw new Error("CSRF endpoint did not return a token");
  assertSetCookieSecurity(cookies);

  if (!process.env.STAGING_ADMIN_EMAIL || !process.env.STAGING_ADMIN_PASSWORD) {
    record("HTTPS cookie and real-domain CORS", "pass", "CORS and CSRF cookie flags verified; login skipped");
    return;
  }

  const login = await fetch(new URL("/api/auth/login", api), {
    method: "POST",
    headers: {
      Origin: allowedOrigin,
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfBody.csrfToken,
      Cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      email: process.env.STAGING_ADMIN_EMAIL,
      password: process.env.STAGING_ADMIN_PASSWORD,
    }),
  });
  const loginBody = await login.json().catch(() => ({}));
  if (!login.ok && !loginBody.mfaRequired) throw new Error(loginBody.error || `login failed with ${login.status}`);
  const loginCookies = setCookies(login.headers);
  if (loginCookies.length) assertSetCookieSecurity(loginCookies);
  record("HTTPS cookie and real-domain CORS", "pass", loginBody.mfaRequired ? "login reached MFA challenge" : "login cookie verified");
}

async function testRedis() {
  if (!process.env.REDIS_URL) {
    record("Redis", "skip", "REDIS_URL missing");
    return;
  }
  const redis = new IORedis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    enableReadyCheck: false,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error(`unexpected ping response ${pong}`);
    record("Redis", "pass", "PING ok");
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

async function testCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    record("Cloudinary", "skip", "credentials missing");
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const folder = `${(process.env.CLOUDINARY_PROOF_FOLDER || "visionaries-banking/payment-proofs").replace(/^\/+|\/+$/g, "")}/smoke-tests`;
  const publicId = `${folder}/smoke-${Date.now()}`;
  let uploaded = null;
  try {
    uploaded = await cloudinary.uploader.upload("data:text/plain;base64,c21va2UtdGVzdA==", {
      resource_type: "raw",
      type: "authenticated",
      public_id: publicId,
      overwrite: true,
      tags: ["visionaries-smoke-test"],
    });
    const asset = await cloudinary.api.resource(uploaded.public_id, {
      resource_type: "raw",
      type: "authenticated",
    });
    if (asset.public_id !== uploaded.public_id) throw new Error("verified asset mismatch");
    record("Cloudinary", "pass", "authenticated upload, verify, cleanup");
  } finally {
    if (uploaded?.public_id) {
      await cloudinary.uploader.destroy(uploaded.public_id, {
        resource_type: "raw",
        type: "authenticated",
      }).catch(() => {});
    }
  }
}

async function testResend() {
  if (!process.env.RESEND_API_KEY) {
    record("Resend", "skip", "RESEND_API_KEY missing");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const domains = await resend.domains.list();
  if (domains.error) throw new Error(domains.error.message || "domains.list failed");

  if (process.env.SMOKE_EMAIL_TO) {
    const sent = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: process.env.SMOKE_EMAIL_TO,
      subject: "Visionaries smoke test",
      text: "This is a Visionaries Village Banking staging email smoke test.",
    });
    if (sent.error) throw new Error(sent.error.message || "email send failed");
    record("Resend", "pass", "API and email send ok");
    return;
  }
  record("Resend", "pass", "API ok; email send skipped without SMOKE_EMAIL_TO");
}

async function run(name, fn) {
  try {
    await fn();
  } catch (error) {
    record(name, "fail", errorMessage(error));
  }
}

await run("HTTPS cookie and real-domain CORS", testCorsAndCookies);
await run("Redis", testRedis);
await run("Cloudinary", testCloudinary);
await run("Resend", testResend);

const failed = results.filter((item) => item.status === "fail");
if (failed.length) process.exit(1);
