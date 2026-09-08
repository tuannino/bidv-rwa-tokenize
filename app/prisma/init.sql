-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('ALLOWED', 'DENIED', 'SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "Txn" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "status" "TxStatus" NOT NULL,
    "fromWallet" TEXT,
    "toWallet" TEXT,
    "amount" DECIMAL(78,0),
    "reason" TEXT,
    "actorRole" TEXT NOT NULL,
    "actorAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Txn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "detail" TEXT,
    "chain" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "fullName" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kycReference" TEXT,
    "kycProvider" TEXT,
    "kycDecidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateIndex
CREATE INDEX "Txn_chain_createdAt_idx" ON "Txn"("chain", "createdAt");

-- CreateIndex
CREATE INDEX "Txn_toWallet_idx" ON "Txn"("toWallet");

-- CreateIndex
CREATE INDEX "Txn_txHash_idx" ON "Txn"("txHash");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorRole_action_idx" ON "AuditLog"("actorRole", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_wallet_key" ON "Investor"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_key" ON "Permission"("action");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

