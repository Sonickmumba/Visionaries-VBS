CREATE TABLE IF NOT EXISTS declaration_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES cycles(id),
  cycle_month_id UUID NOT NULL REFERENCES cycle_months(id),
  cycle_member_id UUID NOT NULL REFERENCES cycle_members(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  attachment_type TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'cloudinary',
  cloudinary_asset_id TEXT,
  public_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  delivery_type TEXT NOT NULL DEFAULT 'authenticated',
  format TEXT,
  version BIGINT,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  secure_url TEXT,
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT declaration_attachments_type_check CHECK (
    attachment_type IN (
      'SAVINGS_PAYMENT_PROOF',
      'PRINCIPAL_REPAYMENT_PROOF',
      'LOAN_INTEREST_PAYMENT_PROOF',
      'COMMON_INTEREST_PAYMENT_PROOF'
    )
  ),
  CONSTRAINT declaration_attachments_status_check CHECK (
    status IN ('UPLOADED','REVIEWED','REJECTED','DELETED')
  )
);

CREATE INDEX IF NOT EXISTS idx_declaration_attachments_declaration ON declaration_attachments(declaration_id);
CREATE INDEX IF NOT EXISTS idx_declaration_attachments_member_month ON declaration_attachments(cycle_member_id, cycle_month_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_declaration_attachments_public_id ON declaration_attachments(public_id);
