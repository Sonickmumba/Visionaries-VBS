import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { badRequest } from "../utils/httpError.js";

export const PAYMENT_PROOF_TYPES = {
  SAVINGS_PAYMENT_PROOF: {
    amountField: "savings_amount",
    label: "Savings proof of payment",
  },
  PRINCIPAL_REPAYMENT_PROOF: {
    amountField: "principal_repayment_amount",
    label: "Principal repayment proof",
  },
  LOAN_INTEREST_PAYMENT_PROOF: {
    amountField: "loan_interest_repayment_amount",
    label: "Loan interest repayment proof",
  },
  COMMON_INTEREST_PAYMENT_PROOF: {
    amountField: "common_interest_payment_amount",
    label: "Common-interest payment proof",
  },
};

const CONTENT_TYPES = {
  "image/jpeg": { resourceType: "image", extension: "" },
  "image/png": { resourceType: "image", extension: "" },
  "image/webp": { resourceType: "image", extension: "" },
  "application/pdf": { resourceType: "raw", extension: ".pdf" },
};

export function resourceTypeForContentType(contentType) {
  return CONTENT_TYPES[contentType]?.resourceType || "";
}

export function configureCloudinary() {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

export function assertCloudinaryConfigured() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw badRequest("Cloudinary payment proof upload is not configured.");
  }
}

export function validatePaymentProofRequest({ declaration, attachmentType, contentType, fileSizeBytes }) {
  const config = PAYMENT_PROOF_TYPES[attachmentType];
  if (!config) throw badRequest("Unsupported payment proof type.");
  if (Number(declaration?.[config.amountField] || 0) <= 0) {
    throw badRequest(`${config.label} is only allowed when the matching declaration amount is greater than zero.`);
  }
  if (!CONTENT_TYPES[contentType]) {
    throw badRequest("Payment proof must be a JPG, PNG, WEBP, or PDF file.");
  }
  if (Number(fileSizeBytes || 0) <= 0 || Number(fileSizeBytes || 0) > env.paymentProofMaxBytes) {
    throw badRequest(`Payment proof must be between 1 byte and ${env.paymentProofMaxBytes} bytes.`);
  }
}

export function buildPaymentProofUploadSignature({ declaration, attachmentType, contentType }) {
  assertCloudinaryConfigured();
  configureCloudinary();

  const timestamp = Math.floor(Date.now() / 1000);
  const typeConfig = CONTENT_TYPES[contentType];
  const extension = typeConfig.extension;
  const publicId = [
    env.cloudinaryProofFolder.replace(/^\/+|\/+$/g, ""),
    declaration.cycle_id,
    declaration.cycle_month_id,
    declaration.id,
    `${attachmentType.toLowerCase()}-${crypto.randomUUID()}${extension}`,
  ].join("/");
  const tags = "village-banking,payment-proof";
  const context = [
    `declaration_id=${declaration.id}`,
    `cycle_member_id=${declaration.cycle_member_id}`,
    `attachment_type=${attachmentType}`,
  ].join("|");
  const paramsToSign = {
    context,
    public_id: publicId,
    tags,
    timestamp,
    type: "authenticated",
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.cloudinaryApiSecret);

  return {
    cloudName: env.cloudinaryCloudName,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/${typeConfig.resourceType}/upload`,
    params: {
      ...paramsToSign,
      api_key: env.cloudinaryApiKey,
      signature,
    },
    publicId,
    resourceType: typeConfig.resourceType,
    deliveryType: "authenticated",
    expiresInSeconds: 300,
  };
}

export function validateCloudinaryUploadResult({ expectedPublicId, expectedResourceType, upload }) {
  if (!upload?.publicId || upload.publicId !== expectedPublicId) {
    throw badRequest("Uploaded proof does not match the signed upload request.");
  }
  if (upload.resourceType && upload.resourceType !== expectedResourceType) {
    throw badRequest("Uploaded proof resource type does not match the signed upload request.");
  }
  if (upload.bytes && Number(upload.bytes) > env.paymentProofMaxBytes) {
    throw badRequest(`Uploaded proof exceeds ${env.paymentProofMaxBytes} bytes.`);
  }
}

export function signedPaymentProofUrl(attachment, { asAttachment = false } = {}) {
  assertCloudinaryConfigured();
  configureCloudinary();
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  return cloudinary.utils.private_download_url(
    attachment.public_id,
    attachment.format || undefined,
    {
      resource_type: attachment.resource_type,
      type: attachment.delivery_type || "authenticated",
      expires_at: expiresAt,
      attachment: asAttachment,
    }
  );
}
