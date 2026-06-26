import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";

const resendMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: resendMocks.send,
    },
  })),
}));

describe("email delivery service", () => {
  afterEach(() => {
    delete process.env.RESEND_ENABLE_TEST_DELIVERY;
  });

  it("surfaces Resend provider rejections instead of treating them as sent", async () => {
    process.env.RESEND_ENABLE_TEST_DELIVERY = "true";
    env.resendApiKey = "test-key";
    env.emailFrom = "Visionaries Village Banking <onboarding@your-domain.com>";
    resendMocks.send.mockResolvedValueOnce({
      data: null,
      error: {
        message: "The domain your-domain.com is not verified.",
        name: "validation_error",
        statusCode: 400,
      },
    });

    const { sendVerificationEmail } = await import("../src/services/emailDeliveryService.js");

    await expect(sendVerificationEmail({
      to: "member@example.com",
      token: "token",
      firstName: "Mary",
    })).rejects.toMatchObject({
      status: 400,
      message: "Email provider rejected the message: The domain your-domain.com is not verified.",
      details: {
        provider: "resend",
        code: "validation_error",
        providerStatus: 400,
      },
    });
  });
});
