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
    env.emailDevFallback = false;
    env.nodeEnv = "test";
    resendMocks.send.mockReset();
  });

  it("surfaces Resend provider rejections instead of treating them as sent", async () => {
    process.env.RESEND_ENABLE_TEST_DELIVERY = "true";
    env.emailDevFallback = false;
    env.nodeEnv = "production";
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

  it("returns a development fallback link when Resend cannot be reached locally", async () => {
    process.env.RESEND_ENABLE_TEST_DELIVERY = "true";
    env.nodeEnv = "development";
    env.emailDevFallback = true;
    env.resendApiKey = "test-key";
    env.emailFrom = "Visionaries Village Banking <onboarding@resend.dev>";
    resendMocks.send.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Unable to fetch data. The request could not be resolved.",
        name: "application_error",
        statusCode: 502,
      },
    });

    const { sendVerificationEmail } = await import("../src/services/emailDeliveryService.js");

    const delivery = await sendVerificationEmail({
      to: "member@example.com",
      token: "dev-token",
      firstName: "Mary",
    });

    expect(delivery).toMatchObject({
      skipped: true,
      devFallback: true,
      provider: "resend",
      to: "member@example.com",
      link: "http://localhost:5173/?verifyToken=dev-token",
    });
    expect(delivery.reason).toContain("Unable to fetch data");
  });
});
