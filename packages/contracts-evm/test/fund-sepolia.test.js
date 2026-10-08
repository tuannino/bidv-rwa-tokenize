const { expect } = require('chai');
const { ethers } = require('hardhat');
const { assertSepolia, assertTarget, planFunding, feeBudget, parseArgs, fund } = require('../scripts/fund-sepolia');
const samples = require('../../shared/src/sample-wallets.json');
const target = '0x1234567890123456789012345678901234567890';
const provider = (chainId = 11155111n, balance = 0n) => ({
  getNetwork: async () => ({ chainId }), getBalance: async () => balance,
  getFeeData: async () => ({ maxFeePerGas: 10n, maxPriorityFeePerGas: 1n }),
});
describe('OP-04 — cấp phí Sepolia', function () {
  it('từ chối chain khác Sepolia trước khi có thể ký', async function () {
    expect(() => assertSepolia(31337n)).to.throw('11155111');
    await expect(fund({ target, eth: '1' }, { provider: provider(31337n) })).to.be.rejectedWith('11155111');
  });
  it('từ chối ví mẫu từ nguồn chung và Hardhat #0, kể cả khác hoa thường', function () {
    for (const address of [...Object.values(samples.wallets), '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']) {
      expect(() => assertTarget(address.toLowerCase())).to.throw('Hardhat');
    }
    expect(() => assertTarget(ethers.ZeroAddress)).to.throw('địa chỉ');
    expect(() => assertTarget('sai')).to.throw('địa chỉ');
  });
  it('chỉ bù phần thiếu, dùng số nguyên và làm tròn phí lên', function () {
    expect(planFunding(100n, 40n)).to.equal(60n);
    expect(planFunding(100n, 100n)).to.equal(0n);
    expect(planFunding(100n, 150n)).to.equal(0n);
    expect(feeBudget(101n, 1n)).to.equal(122n);
  });
  it('đủ số dư thì không tạo signer và không gửi', async function () {
    const result = await fund({ target, eth: '0.0000000000000001' }, {
      provider: provider(11155111n, 100n), log: () => {},
      makeWallet: () => { throw new Error('không được tạo signer'); },
    });
    expect(result.missing).to.equal(0n);
  });
  it('--dry-run thiếu phí cũng không đọc khóa hoặc gửi giao dịch', async function () {
    const result = await fund({ target, operation: 'mint', dryRun: true }, {
      provider: provider(), estimates: { mint: 100n }, log: () => {},
      makeWallet: () => { throw new Error('không được tạo signer'); },
    });
    expect(result.missing).to.equal(1200n);
    expect(result.hash).to.equal(undefined);
  });
  it('gửi đúng phần thiếu, gắn chain Sepolia và chờ receipt', async function () {
    let sent;
    const rpc = provider(11155111n, 40n);
    rpc.estimateGas = async () => 21000n;
    const result = await fund({ target, eth: '0.0000000000000001' }, {
      provider: rpc, key: 'khóa giả dùng với signer giả', log: () => {}, funderBalance: 1_000_000n,
      makeWallet: () => ({ address: target, sendTransaction: async (tx) => {
        sent = tx; return { hash: '0xtest', wait: async () => ({ status: 1 }) };
      } }),
    });
    expect(sent.value).to.equal(60n);
    expect(sent.chainId).to.equal(11155111n);
    expect(result.hash).to.equal('0xtest');
  });
  it('tham số phải chọn một chế độ và số ETH phải dương', function () {
    expect(parseArgs([target, '--for', 'mint', '--dry-run']).operation).to.equal('mint');
    for (const args of [[target], [target, '--eth', '1', '--for', 'mint'], [target, '--eth', '-1'], [target, '--eth', '0'], [target, '--for', 'lạ'], [target, '--eth', '1', '--lạ']]) {
      expect(() => parseArgs(args)).to.throw();
    }
  });
});

describe('OP-04 — preflight phí ví ký', function () {
  const { signerFunding } = require('../scripts/preflight-sepolia');
  const estimates = { deploy: 1000n, whitelist: 100n, cycle: 400n };
  it('thiếu phí in lệnh nạp tổng số dư yêu cầu, script sẽ chỉ bù phần thiếu', async function () {
    const result = await signerFunding(provider(11155111n, 1n), target, estimates);
    expect(result.enough).to.equal(false);
    expect(result.required).to.equal(18000n);
    expect(result.command).to.equal(`node scripts/fund-sepolia.js ${target} --eth 0.000000000000018`);
    expect(parseArgs(result.command.split(' ').slice(2)).eth).to.equal('0.000000000000018');
  });
  it('báo đủ khi số dư ví ký đủ deploy + whitelist + một vòng Mint/Mint/Burn', async function () {
    expect((await signerFunding(provider(11155111n, 18000n), target, estimates)).enough).to.equal(true);
  });
});
