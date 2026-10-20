const { expect } = require('chai');
const { ethers } = require('hardhat');
const { OPERATIONS, CYCLE_OPERATIONS, SENDER, assertSepolia, assertTarget, planFunding, feeBudget, parseArgs, fund, estimateOperationGas, withCycleTotal, safeFundingMessage } = require('../scripts/fund-sepolia');
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
    for (const address of [...Object.values(samples.wallets), samples.hardhatAccount0]) {
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
    const result = await fund({ target, operation: 'payment-mint', dryRun: true }, {
      provider: provider(), estimates: { 'payment-mint': { gas: 100n, txs: 1 } }, log: () => {},
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
    expect(parseArgs([target, '--for', 'demo-cycle', '--dry-run']).operation).to.equal('demo-cycle');
    for (const args of [[target], [target, '--eth', '1', '--for', 'trade'], [target, '--for', 'cycle'], [target, '--for', 'mint'], [target, '--eth', '-1'], [target, '--eth', '0'], [target, '--for', 'lạ'], [target, '--eth', '1', '--lạ']]) {
      expect(() => parseArgs(args)).to.throw();
    }
  });
  it('phân loại lỗi an toàn, không lộ URL hay thân lỗi RPC', function () {
    const raw = new Error('https://rpc.example/secret-key body private data');
    expect(safeFundingMessage(raw)).to.equal('Lỗi RPC khi đọc hoặc gửi giao dịch; kiểm endpoint và kết nối Sepolia.');
    expect(safeFundingMessage(raw)).not.to.include('secret-key');
    const local = new Error('raw');
    local.safeMessage = 'Ước lượng gas cục bộ thất bại; chạy npx hardhat compile rồi thử lại.';
    expect(safeFundingMessage(local)).to.include('Ước lượng gas cục bộ');
  });
  it('báo riêng thiếu khóa cấp phí', async function () {
    await expect(fund({ target, eth: '0.0000000000000001' }, {
      provider: provider(), log: () => {}, key: '',
    })).to.be.rejectedWith('Thiếu FUNDER_PRIVATE_KEY');
  });
  it('báo riêng số dư tài khoản tổng không đủ', async function () {
    const rpc = provider();
    rpc.estimateGas = async () => 21_000n;
    await expect(fund({ target, eth: '0.0000000000000001' }, {
      provider: rpc, key: 'khóa giả', log: () => {}, funderBalance: 0n,
      makeWallet: () => ({ address: target }),
    })).to.be.rejectedWith('Tài khoản tổng thiếu ETH');
  });
});

describe('OP-04 — preflight phí ví ký', function () {
  const { signerFunding } = require('../scripts/preflight-sepolia');
  const estimates = withCycleTotal(Object.fromEntries(OPERATIONS.filter((op) => op !== 'demo-cycle')
    .map((op) => [op, { gas: op === 'deploy' ? 1000n : op === 'whitelist' ? 100n : 50n, txs: 1 }])));
  it('thiếu phí in lệnh nạp tổng số dư yêu cầu, script sẽ chỉ bù phần thiếu', async function () {
    const result = await signerFunding(provider(11155111n, 1n), target, estimates);
    expect(result.enough).to.equal(false);
    // deploy 1000 + whitelist 100 + demo-cycle 7 x 50, giá 10 wei, dự phòng 20%.
    expect(result.required).to.equal(17400n);
    expect(result.command).to.equal(`node scripts/fund-sepolia.js ${target} --eth 0.0000000000000174`);
    expect(parseArgs(result.command.split(' ').slice(2)).eth).to.equal('0.0000000000000174');
    expect(result.table).to.include('| demo-cycle | 7 | 350 |');
  });
  it('báo đủ khi số dư ví ký đủ deploy + whitelist + một vòng trình diễn', async function () {
    expect((await signerFunding(provider(11155111n, 17400n), target, estimates)).enough).to.equal(true);
  });
});

describe('OP-05 ca 2: ước phí theo thao tác và theo ví gửi', function () {
  this.timeout(120_000);
  // Bảng QĐ-E. `deploy` đếm từ deploy.js: 9 constructor, 4 liên kết ERC-3643, 1 đăng ký vault, 3 vai
  // vault, 1 MATCHER_ROLE, 3 vai matcher, 1 SNAPSHOT_ROLE; MINTER/AGENT đã có từ constructor.
  const TXS = { deploy: 22, whitelist: 2, 'vault-config': 3, 'mint-initial': 1, 'payment-mint': 1, trade: 2, 'profit-mint': 1, distribute: 3, withdraw: 1 };
  let estimates;
  before(async function () { estimates = await estimateOperationGas(); });

  it('mỗi thao tác có gas lớn hơn 0 khi mô phỏng, số giao dịch khớp bảng; demo-cycle bằng tổng', function () {
    expect(OPERATIONS).to.deep.equal([...Object.keys(TXS), 'demo-cycle']);
    for (const [op, txs] of Object.entries(TXS)) {
      expect(estimates[op].txs, op).to.equal(txs);
      expect(estimates[op].gas > 0n, op).to.equal(true);
    }
    const sum = CYCLE_OPERATIONS.reduce((acc, op) => ({ gas: acc.gas + estimates[op].gas, txs: acc.txs + estimates[op].txs }), { gas: 0n, txs: 0 });
    expect(estimates['demo-cycle']).to.deep.equal(sum);
    expect(estimates['demo-cycle'].txs).to.equal(12);
  });

  it('bảng in theo thao tác, mỗi dòng ghi ví gửi; --dry-run không cần khoá tổng', async function () {
    const lines = [];
    const result = await fund({ target, operation: 'demo-cycle', dryRun: true }, {
      provider: provider(), estimates, log: (line) => lines.push(line), key: '',
      makeWallet: () => { throw new Error('không được tạo signer'); },
    });
    const table = lines.find((line) => line.startsWith('| Thao tác'));
    expect(table).to.include('Ví gửi');
    for (const op of [...CYCLE_OPERATIONS, 'demo-cycle']) {
      expect(table).to.match(new RegExp(`\\| ${op} \\| ${estimates[op].txs} \\| ${estimates[op].gas} \\| [0-9.]+ \\| ${SENDER} \\|`));
    }
    expect(result.required).to.equal(feeBudget(estimates['demo-cycle'].gas, 10n));
    expect(result.hash).to.equal(undefined);
    expect(lines.join('\n')).to.include('DRY-RUN');
  });

  it('bỏ thao tác cũ cycle, mint, burn', function () {
    for (const op of ['cycle', 'mint', 'burn']) expect(OPERATIONS).not.to.include(op);
  });
});
