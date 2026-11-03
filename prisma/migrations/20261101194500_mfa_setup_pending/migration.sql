ALTER TABLE "User"
  ADD COLUMN "mfaPendingSecretEncrypted" TEXT;

ALTER TABLE "PlatformAdmin"
  ADD COLUMN "mfaPendingSecretEncrypted" TEXT;
