import bcrypt from "bcryptjs";
import { PassThrough, Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../src/db/pool.js", () => ({
  query: mocks.query,
  pool: {},
}));

const { app } = await import("../src/app.js");

function rows(data) {
  return { rows: data };
}

function inject({ method = "GET", url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = new Readable({
      read() {
        this.push(payload);
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = {
      host: "localhost",
      ...(body ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
      ...headers,
    };
    req.socket = new PassThrough();
    req.socket.remoteAddress = "127.0.0.1";
    req.connection = req.socket;

    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        const key = String(name).toLowerCase();
        if (key === "set-cookie") {
          this.headers[key] = [...(this.headers[key] || []), ...(Array.isArray(value) ? value : [value])];
          return;
        }
        this.headers[key] = value;
      },
      getHeader(name) {
        return this.headers[String(name).toLowerCase()];
      },
      removeHeader(name) {
        delete this.headers[String(name).toLowerCase()];
      },
      write(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        return true;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: text ? JSON.parse(text) : {},
          text,
        });
      },
    };
    res.status = function status(code) {
      this.statusCode = code;
      return this;
    };
    res.json = function json(payloadJson) {
      this.setHeader("content-type", "application/json; charset=utf-8");
      this.end(JSON.stringify(payloadJson));
      return this;
    };
    res.send = function send(payloadText) {
      this.end(typeof payloadText === "string" ? payloadText : JSON.stringify(payloadText));
      return this;
    };
    res.clearCookie = function clearCookie(name) {
      this.setHeader("set-cookie", `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
      return this;
    };

    app.handle(req, res, reject);
  });
}

function cookieHeader(response) {
  return (response.headers["set-cookie"] || []).map((cookie) => cookie.split(";")[0]).join("; ");
}

describe("passport session authentication", () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it("creates an HttpOnly session cookie, restores /me, and destroys the session on logout", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 4);
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@example.com",
      password_hash: passwordHash,
      role: "ADMIN",
      is_active: true,
      email_verified_at: "2026-01-01T00:00:00.000Z",
    };

    mocks.query
      .mockResolvedValueOnce(rows([user]))
      .mockResolvedValueOnce(rows([user]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: user.id, email: user.email, role: user.role, is_active: true, email_verified_at: user.email_verified_at }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: user.id, email: user.email, role: user.role, is_active: true, email_verified_at: user.email_verified_at }]));

    const login = await inject({
      method: "POST",
      url: "/api/auth/login",
      body: { email: "ADMIN@example.com", password: "Password123!" },
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      user: {
        id: user.id,
        email: user.email,
        role: "ADMIN",
        is_active: true,
        email_verified_at: user.email_verified_at,
      },
    });
    expect(login.body.csrfToken).toBeTruthy();
    expect(login.headers["set-cookie"]?.join(";")).toContain("vb_sid=");
    expect(login.headers["set-cookie"]?.join(";")).toContain("HttpOnly");
    expect(login.headers["set-cookie"]?.join(";")).not.toContain("vb_token");

    const me = await inject({
      url: "/api/auth/me",
      headers: { cookie: cookieHeader(login) },
    });

    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ id: user.id, email: user.email, role: "ADMIN", is_active: true });

    const logout = await inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieHeader(login) },
    });

    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.join(";")).toContain("vb_sid=;");

    const afterLogout = await inject({
      url: "/api/auth/me",
      headers: { cookie: cookieHeader(logout) },
    });
    expect(afterLogout.status).toBe(401);
  });

  it("rejects invalid credentials without setting a session cookie", async () => {
    mocks.query
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]));

    const response = await inject({
      method: "POST",
      url: "/api/auth/login",
      body: { email: "missing@example.com", password: "wrong" },
    });

    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
