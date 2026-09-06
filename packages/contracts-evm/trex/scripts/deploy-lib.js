const { ethers } = require("hardhat");

// Topic KYC dùng cho pilot (bank tự quy ước; ví dụ 7 = "KYC verified")
const KYC_TOPIC = 7n;
const CLAIM_SCHEME = 1n; // ECDSA
const ZERO = ethers.ZeroAddress;

/**
 * Deploy TRỌN bộ ERC-3643 (T-REX) theo đúng mô hình Tokeny:
 *   - 6 implementation (Token, CTR, IR, IRS, TIR, MC)
 *   - TREXImplementationAuthority (reference) + nạp version
 *   - ONCHAINID: Identity impl + ImplementationAuthority + IdFactory
 *   - TREXFactory, liên kết idFactory
 *   - ClaimIssuer (tổ chức KYC tin cậy) do ngân hàng vận hành
 *   - deployTREXSuite(...) => token + 5 registry/compliance (đều là proxy)
 *
 * @param signers { deployer, tokenIssuer, claimIssuer } — các ví ký
 * @param opts    { name, symbol, decimals }
 */
async function deployFullSuite(signers, opts = {}) {
  const { deployer, tokenIssuer, claimIssuer } = signers;
  const name = opts.name || "Solar Project Token";
  const symbol = opts.symbol || "SPT";
  const decimals = opts.decimals ?? 0;

  // 1) Implementation contracts (chỉ deploy 1 lần, dùng lại cho mọi proxy)
  const tokenImpl = await ethers.deployContract("Token", deployer);
  const ctrImpl = await ethers.deployContract("ClaimTopicsRegistry", deployer);
  const irImpl = await ethers.deployContract("IdentityRegistry", deployer);
  const irsImpl = await ethers.deployContract("IdentityRegistryStorage", deployer);
  const tirImpl = await ethers.deployContract("TrustedIssuersRegistry", deployer);
  const mcImpl = await ethers.deployContract("ModularCompliance", deployer);

  // 2) TREX ImplementationAuthority (reference) + nạp version 4.1.6
  const trexIA = await ethers.deployContract(
    "TREXImplementationAuthority",
    [true, ZERO, ZERO],
    deployer
  );
  const version = { major: 4, minor: 1, patch: 6 };
  const contracts = {
    tokenImplementation: await tokenImpl.getAddress(),
    ctrImplementation: await ctrImpl.getAddress(),
    irImplementation: await irImpl.getAddress(),
    irsImplementation: await irsImpl.getAddress(),
    tirImplementation: await tirImpl.getAddress(),
    mcImplementation: await mcImpl.getAddress(),
  };
  await (await trexIA.connect(deployer).addAndUseTREXVersion(version, contracts)).wait();

  // 3) ONCHAINID: Identity implementation + ImplementationAuthority + IdFactory
  const identityImpl = await ethers.deployContract("Identity", [deployer.address, true], deployer);
  const idIA = await ethers.deployContract(
    "@onchain-id/solidity/contracts/proxy/ImplementationAuthority.sol:ImplementationAuthority",
    [await identityImpl.getAddress()],
    deployer
  );
  const idFactory = await ethers.deployContract("IdFactory", [await idIA.getAddress()], deployer);

  // 4) TREXFactory + liên kết
  const trexFactory = await ethers.deployContract(
    "TREXFactory",
    [await trexIA.getAddress(), await idFactory.getAddress()],
    deployer
  );
  await (await trexIA.connect(deployer).setTREXFactory(await trexFactory.getAddress())).wait();
  await (await idFactory.connect(deployer).addTokenFactory(await trexFactory.getAddress())).wait();
  // Giao quyền vận hành onboarding (tạo ONCHAINID cho nhà đầu tư) cho đơn vị phát hành
  await (await idFactory.connect(deployer).transferOwnership(tokenIssuer.address)).wait();

  // 5) ClaimIssuer — tổ chức KYC tin cậy (ngân hàng/đối tác) ký claim cho nhà đầu tư
  const claimIssuerContract = await ethers.deployContract("ClaimIssuer", [claimIssuer.address], deployer);

  // 6) deployTREXSuite: token issuer là owner; token agent & IR agent = tokenIssuer
  const tokenDetails = {
    owner: tokenIssuer.address,
    name,
    symbol,
    decimals,
    irs: ZERO, // deploy storage mới
    ONCHAINID: ZERO, // để factory tự tạo ONCHAINID cho token
    irAgents: [tokenIssuer.address],
    tokenAgents: [tokenIssuer.address],
    complianceModules: [],
    complianceSettings: [],
  };
  const claimDetails = {
    claimTopics: [KYC_TOPIC],
    issuers: [await claimIssuerContract.getAddress()],
    issuerClaims: [[KYC_TOPIC]],
  };

  const salt = "RWA-SOLAR-" + Date.now();
  const tx = await trexFactory.connect(deployer).deployTREXSuite(salt, tokenDetails, claimDetails);
  const receipt = await tx.wait();

  // Đọc địa chỉ token từ event TREXSuiteDeployed
  let tokenAddr;
  for (const log of receipt.logs) {
    try {
      const parsed = trexFactory.interface.parseLog(log);
      if (parsed && parsed.name === "TREXSuiteDeployed") {
        tokenAddr = parsed.args._token;
        break;
      }
    } catch (_) {}
  }
  if (!tokenAddr) throw new Error("Không đọc được địa chỉ token từ event TREXSuiteDeployed");

  const token = await ethers.getContractAt("Token", tokenAddr);
  const identityRegistry = await ethers.getContractAt("IdentityRegistry", await token.identityRegistry());
  const compliance = await ethers.getContractAt("ModularCompliance", await token.compliance());

  return {
    token,
    identityRegistry,
    compliance,
    idFactory,
    claimIssuerContract,
    trexFactory,
    trexIA,
    addresses: {
      token: tokenAddr,
      identityRegistry: await identityRegistry.getAddress(),
      compliance: await compliance.getAddress(),
      idFactory: await idFactory.getAddress(),
      claimIssuer: await claimIssuerContract.getAddress(),
      trexFactory: await trexFactory.getAddress(),
    },
  };
}

/**
 * Onboard 1 nhà đầu tư: tạo ONCHAINID, ký claim KYC, đăng ký vào IdentityRegistry.
 * Sau bước này nhà đầu tư "isVerified" và đủ điều kiện nhận token.
 */
async function onboardInvestor(suite, agent, claimIssuerSigner, investor, country = 704 /* VN */) {
  const { idFactory, identityRegistry, claimIssuerContract } = suite;

  // 1) Tạo ONCHAINID cho ví nhà đầu tư
  await (await idFactory.connect(agent).createIdentity(investor.address, "id-" + investor.address)).wait();
  const identityAddr = await idFactory.getIdentity(investor.address);
  const identity = await ethers.getContractAt("Identity", identityAddr);

  // 2) ClaimIssuer ký claim KYC cho identity này
  const data = ethers.hexlify(ethers.toUtf8Bytes("KYC-OK"));
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256", "bytes"], [identityAddr, KYC_TOPIC, data])
  );
  const signature = await claimIssuerSigner.signMessage(ethers.getBytes(dataHash));

  // 3) Ví nhà đầu tư (management key) thêm claim vào ONCHAINID của mình
  await (
    await identity
      .connect(investor)
      .addClaim(KYC_TOPIC, CLAIM_SCHEME, await claimIssuerContract.getAddress(), signature, data, "")
  ).wait();

  // 4) Agent đăng ký identity vào IdentityRegistry
  await (await identityRegistry.connect(agent).registerIdentity(investor.address, identityAddr, country)).wait();

  return identityAddr;
}

module.exports = { deployFullSuite, onboardInvestor, KYC_TOPIC, CLAIM_SCHEME };
