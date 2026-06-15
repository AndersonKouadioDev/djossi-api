-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referred_by_code" TEXT;

-- CreateIndex
CREATE INDEX "users_referred_by_code_idx" ON "users"("referred_by_code");
