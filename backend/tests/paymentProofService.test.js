import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import {
  buildPaymentProofUploadSignature,
  signedPaymentProofUrl,
  validateCloudinaryUploadResult,
  validatePaymentProofRequest,
  verifyCloudinaryUploadedAsset,
} from "../src/services/paymentProofService.js";

const declaration = {
  id: "11111111-1111-4111-8111-111111111111",
  cycle_id: "22222222-2222-4222-8222-222222222222",
  cycle_month_id: "33333333-3333-4333-8333-333333333333",
  cycle_member_id: "44444444-4444-4444-8444-444444444444",
  savings_amount: 15000,
  principal_repayment_amount: 0,
  loan_interest_repayment_amount: 250,
  common_interest_payment_amount: 100,
};

describe("payment proof service", () => {
  it("validates proof type, matching amount, content type, and file size", () => {
    expect(() => validatePaymentProofRequest({
      declaration,
      attachmentType: "SAVINGS_PAYMENT_PROOF",
      contentType: "image/jpeg",
      fileSizeBytes: 12000,
    })).not.toThrow();

    expect(() => validatePaymentProofRequest({
      declaration,
      attachmentType: "PRINCIPAL_REPAYMENT_PROOF",
      contentType: "image/jpeg",
      fileSizeBytes: 12000,
    })).toThrow(/only allowed/);

    expect(() => validatePaymentProofRequest({
      declaration,
      attachmentType: "SAVINGS_PAYMENT_PROOF",
      contentType: "text/html",
      fileSizeBytes: 12000,
    })).toThrow(/JPG, PNG, WEBP, or PDF/);
  });

  it("creates signed authenticated Cloudinary upload parameters", () => {
    env.cloudinaryCloudName = "demo-cloud";
    env.cloudinaryApiKey = "demo-key";
    env.cloudinaryApiSecret = "demo-secret";
    env.cloudinaryProofFolder = "village-banking/payment-proofs";

    const signature = buildPaymentProofUploadSignature({
      declaration,
      attachmentType: "LOAN_INTEREST_PAYMENT_PROOF",
      contentType: "application/pdf",
    });

    expect(signature.uploadUrl).toBe("https://api.cloudinary.com/v1_1/demo-cloud/raw/upload");
    expect(signature.params.type).toBe("authenticated");
    expect(signature.params.api_key).toBe("demo-key");
    expect(signature.params.signature).toBeTruthy();
    expect(signature.publicId).toContain(declaration.id);
    expect(signature.publicId).toMatch(/\.pdf$/);
  });

  it("validates direct upload confirmation and builds signed viewing URLs", () => {
    env.cloudinaryCloudName = "demo-cloud";
    env.cloudinaryApiKey = "demo-key";
    env.cloudinaryApiSecret = "demo-secret";

    expect(() => validateCloudinaryUploadResult({
      expectedPublicId: "proofs/file-1",
      expectedResourceType: "image",
      upload: { publicId: "proofs/file-1", resourceType: "image", bytes: 1000 },
    })).not.toThrow();

    expect(() => validateCloudinaryUploadResult({
      expectedPublicId: "proofs/file-1",
      expectedResourceType: "image",
      upload: { publicId: "proofs/file-2", resourceType: "image", bytes: 1000 },
    })).toThrow(/does not match/);

    const url = signedPaymentProofUrl({
      public_id: "proofs/file-1",
      format: "jpg",
      resource_type: "image",
      delivery_type: "authenticated",
    });
    expect(url).toContain("demo-cloud");
    expect(url).toContain("public_id=proofs%2Ffile-1");
    expect(url).toContain("signature=");
  });

  it("verifies uploaded assets with Cloudinary before persistence", async () => {
    env.cloudinaryCloudName = "demo-cloud";
    env.cloudinaryApiKey = "demo-key";
    env.cloudinaryApiSecret = "demo-secret";
    const resource = vi.spyOn(cloudinary.api, "resource").mockResolvedValueOnce({
      public_id: "proofs/file-1",
      resource_type: "image",
      bytes: 1000,
      asset_id: "asset-1",
    });

    const asset = await verifyCloudinaryUploadedAsset({
      expectedPublicId: "proofs/file-1",
      expectedResourceType: "image",
    });

    expect(asset.asset_id).toBe("asset-1");
    expect(resource).toHaveBeenCalledWith("proofs/file-1", {
      resource_type: "image",
      type: "authenticated",
    });
    resource.mockRestore();
  });
});
