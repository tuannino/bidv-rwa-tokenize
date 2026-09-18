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
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "investorWallet" TEXT NOT NULL,
    "wptAmount" DECIMAL(78,0) NOT NULL,
    "vndAmount" DECIMAL(78,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "txHash" TEXT,
    "reason" TEXT,
    "actorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionPeriod" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(78,0) NOT NULL,
    "totalSupplyAt" DECIMAL(78,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "chain" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "DistributionPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionPayout" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "investorWallet" TEXT NOT NULL,
    "balanceAt" DECIMAL(78,0) NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "batchNo" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DistributionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRound" (
    "id" TEXT NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "navRate" DECIMAL(78,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "chain" TEXT NOT NULL,
    "initiatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SettlementRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementCase" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "holderWallet" TEXT NOT NULL,
    "wptAmount" DECIMAL(78,0) NOT NULL,
    "payoutAmount" DECIMAL(78,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOTIFIED',
    "notifiedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "paidTxHash" TEXT,
    "burnedAt" TIMESTAMPTZ(3),
    "burnTxHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SettlementCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeeperRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,

    CONSTRAINT "KeeperRun_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "PurchaseOrder_txHash_key" ON "PurchaseOrder"("txHash");

-- CreateIndex
CREATE INDEX "PurchaseOrder_investorWallet_createdAt_idx" ON "PurchaseOrder"("investorWallet", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionPeriod_periodKey_key" ON "DistributionPeriod"("periodKey");

-- CreateIndex
CREATE INDEX "DistributionPeriod_status_openedAt_idx" ON "DistributionPeriod"("status", "openedAt");

-- CreateIndex
CREATE INDEX "DistributionPeriod_chain_openedAt_idx" ON "DistributionPeriod"("chain", "openedAt");

-- CreateIndex
CREATE INDEX "DistributionPayout_investorWallet_createdAt_idx" ON "DistributionPayout"("investorWallet", "createdAt");

-- CreateIndex
CREATE INDEX "DistributionPayout_periodId_status_idx" ON "DistributionPayout"("periodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionPayout_periodId_investorWallet_key" ON "DistributionPayout"("periodId", "investorWallet");

-- CreateIndex
CREATE INDEX "SettlementRound_status_initiatedAt_idx" ON "SettlementRound"("status", "initiatedAt");

-- CreateIndex
CREATE INDEX "SettlementRound_chain_initiatedAt_idx" ON "SettlementRound"("chain", "initiatedAt");

-- CreateIndex
CREATE INDEX "SettlementCase_holderWallet_createdAt_idx" ON "SettlementCase"("holderWallet", "createdAt");

-- CreateIndex
CREATE INDEX "SettlementCase_roundId_status_idx" ON "SettlementCase"("roundId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementCase_roundId_holderWallet_key" ON "SettlementCase"("roundId", "holderWallet");

-- CreateIndex
CREATE INDEX "KeeperRun_jobName_startedAt_idx" ON "KeeperRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "KeeperRun_status_startedAt_idx" ON "KeeperRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeeperRun_jobName_periodKey_key" ON "KeeperRun"("jobName", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_wallet_key" ON "Investor"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_key" ON "Permission"("action");

-- AddForeignKey
ALTER TABLE "DistributionPayout" ADD CONSTRAINT "DistributionPayout_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "DistributionPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementCase" ADD CONSTRAINT "SettlementCase_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "SettlementRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

