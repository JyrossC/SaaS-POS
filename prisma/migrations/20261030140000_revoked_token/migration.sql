-- Create RevokedToken table for token revocation (logout, password reset)

CREATE TABLE "RevokedToken" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "tokenHash" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "RevokedToken_userId_idx" ON "RevokedToken"("userId");
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");
