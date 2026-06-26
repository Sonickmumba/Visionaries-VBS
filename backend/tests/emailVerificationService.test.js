import { describe, expect, it, vi } from "vitest";
import {
  acceptInvitationToken,
  createAuthEmailToken,
  verifyEmailToken,
} from "../src/services/emailVerificationService.js";

describe("email verification service", () => {
  it("stores only hashed tokens when creating auth email tokens", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    const token = await createAuthEmailToken(client, {
      userId: "user-1",
      tokenType: "EMAIL_VERIFICATION",
      ttlHours: 24,
    });

    expect(token.length).toBeGreaterThan(20);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO auth_email_tokens"),
      expect.arrayContaining(["user-1", "EMAIL_VERIFICATION"])
    );
    const params = client.query.mock.calls[0][1];
    expect(params[2]).not.toBe(token);
    expect(params[2]).toHaveLength(64);
  });

  it("consumes verification tokens once and activates the user", async () => {
    const token = "verification-token";
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: "token-1",
            user_id: "user-1",
            expires_at: new Date(Date.now() + 60000).toISOString(),
            used_at: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "user-1", email: "member@example.com", role: "MEMBER", is_active: true, email_verified_at: new Date().toISOString() }] }),
    };

    const user = await verifyEmailToken(client, { token });

    expect(user.email).toBe("member@example.com");
    expect(client.query.mock.calls[1][0]).toContain("UPDATE auth_email_tokens SET used_at = now()");
    expect(client.query.mock.calls[2][0]).toContain("email_verified_at = COALESCE");
  });

  it("accepts invitation tokens by setting password and verified status", async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: "token-1",
            user_id: "user-1",
            expires_at: new Date(Date.now() + 60000).toISOString(),
            used_at: null,
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "user-1", email: "admin@example.com", role: "ADMIN", is_active: true }] }),
    };

    const user = await acceptInvitationToken(client, { token: "invite-token", passwordHash: "hash" });

    expect(user.role).toBe("ADMIN");
    expect(client.query.mock.calls[2][0]).toContain("invitation_accepted_at = now()");
    expect(client.query.mock.calls[2][1]).toEqual(["user-1", "hash"]);
  });
});
