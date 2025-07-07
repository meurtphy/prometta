/*
  Warnings:

  - A unique constraint covering the columns `[accessToken]` on the table `audits` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "accessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "audits_accessToken_key" ON "audits"("accessToken");
