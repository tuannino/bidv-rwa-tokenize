#![no_std]
//! Profit Distributor (Pull + Snapshot) — chia lợi nhuận quy mô nhiều nhà đầu tư.
//! ---------------------------------------------------------------------------
//! Khác với bản "push" (hợp đồng chủ động trả cho từng holder, giới hạn bởi số
//! holder mỗi giao dịch), bản này dùng mô hình PULL:
//!   1. open_period(period_id): admin mở kỳ. Hợp đồng đọc doanh thu đã finalize từ
//!      oracle, gọi wpt.snapshot() để CHỐT số dư mọi người tại thời điểm này, và
//!      lưu tổng cung tại snapshot làm mẫu số. Không cần danh sách holder.
//!   2. claim(period_id, investor): từng nhà đầu tư tự nhận phần của mình, tính
//!      theo số dư ĐÃ CHỐT (balance_at) nên không thể gian lận bằng cách mua thêm
//!      WPT sau khi mở kỳ. Mỗi người claim đúng một lần.
//!
//! Nhờ chốt số dư ở tầng token, mô hình này mở rộng tới số lượng nhà đầu tư lớn:
//! chi phí mỗi giao dịch cố định, không phụ thuộc tổng số holder.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Symbol,
};
use revenue_oracle::RevenueOracleClient;
use wpt_token::WptTokenClient;

const DAY: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY;
const PERIOD_BUMP: u32 = 400 * DAY;
const PERIOD_THRESHOLD: u32 = PERIOD_BUMP - DAY;

#[derive(Clone)]
#[contracttype]
pub struct ClaimKey {
    pub period_id: u32,
    pub holder: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct PeriodInfo {
    pub snapshot_id: u32,
    pub total_revenue: i128,
    pub total_supply: i128,
    pub claimed_total: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DKey {
    Admin,
    Wpt,
    Vnd,
    Oracle,
    Period(u32),
    Claimed(ClaimKey),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    PeriodAlreadyOpen = 2,
    RevenueNotFinalized = 3,
    ZeroSupply = 4,
    AlreadyClaimed = 5,
    PeriodNotOpen = 6,
    Overflow = 7,
    InsufficientTreasury = 8,
}

#[contract]
pub struct ProfitDistributorPull;

fn admin(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Admin);
    a.unwrap()
}
fn wpt_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Wpt);
    a.unwrap()
}
fn vnd_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Vnd);
    a.unwrap()
}
fn oracle_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Oracle);
    a.unwrap()
}
fn bump(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}
fn mul_div(a: i128, b: i128, c: i128) -> Result<i128, Error> {
    let prod = a.checked_mul(b).ok_or(Error::Overflow)?;
    Ok(prod / c)
}

#[contractimpl]
impl ProfitDistributorPull {
    pub fn initialize(
        env: Env,
        admin_addr: Address,
        wpt_token: Address,
        vnd_token: Address,
        oracle: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DKey::Admin, &admin_addr);
        env.storage().instance().set(&DKey::Wpt, &wpt_token);
        env.storage().instance().set(&DKey::Vnd, &vnd_token);
        env.storage().instance().set(&DKey::Oracle, &oracle);
        bump(&env);
        Ok(())
    }

    /// Mở kỳ chia: đọc doanh thu đã finalize từ oracle, chốt snapshot số dư.
    /// admin phải là bên ký (đồng thời là admin của token để cho phép snapshot).
    pub fn open_period(env: Env, period_id: u32) -> Result<PeriodInfo, Error> {
        admin(&env).require_auth();
        bump(&env);
        if env.storage().persistent().has(&DKey::Period(period_id)) {
            return Err(Error::PeriodAlreadyOpen);
        }

        let oracle = RevenueOracleClient::new(&env, &oracle_addr(&env));
        if !oracle.is_finalized(&period_id) {
            return Err(Error::RevenueNotFinalized);
        }
        let revenue = oracle.get(&period_id).ok_or(Error::RevenueNotFinalized)?;

        let wpt = WptTokenClient::new(&env, &wpt_addr(&env));
        let snapshot_id = wpt.snapshot();
        let supply = wpt.total_supply_at(&snapshot_id);
        if supply <= 0 {
            return Err(Error::ZeroSupply);
        }

        let info = PeriodInfo {
            snapshot_id,
            total_revenue: revenue,
            total_supply: supply,
            claimed_total: 0,
        };
        env.storage().persistent().set(&DKey::Period(period_id), &info);
        env.storage().persistent().extend_ttl(
            &DKey::Period(period_id),
            PERIOD_THRESHOLD,
            PERIOD_BUMP,
        );
        env.events().publish(
            (Symbol::new(&env, "open_period"), period_id),
            (snapshot_id, revenue, supply),
        );
        Ok(info)
    }

    /// Xem trước phần của một nhà đầu tư trong kỳ.
    pub fn preview_claim(env: Env, period_id: u32, investor: Address) -> i128 {
        let info: Option<PeriodInfo> = env.storage().persistent().get(&DKey::Period(period_id));
        let info = match info {
            Some(i) => i,
            None => return 0,
        };
        let wpt = WptTokenClient::new(&env, &wpt_addr(&env));
        let bal = wpt.balance_at(&investor, &info.snapshot_id);
        mul_div(info.total_revenue, bal, info.total_supply).unwrap_or(0)
    }

    /// Nhà đầu tư tự nhận phần lợi nhuận theo số dư đã chốt. Mỗi người một lần.
    pub fn claim(env: Env, period_id: u32, investor: Address) -> Result<i128, Error> {
        investor.require_auth();
        bump(&env);

        let mut info: PeriodInfo = env
            .storage()
            .persistent()
            .get(&DKey::Period(period_id))
            .ok_or(Error::PeriodNotOpen)?;

        let ckey = DKey::Claimed(ClaimKey {
            period_id,
            holder: investor.clone(),
        });
        let already: bool = env.storage().persistent().get(&ckey).unwrap_or(false);
        if already {
            return Err(Error::AlreadyClaimed);
        }

        let wpt = WptTokenClient::new(&env, &wpt_addr(&env));
        let bal = wpt.balance_at(&investor, &info.snapshot_id);
        let share = mul_div(info.total_revenue, bal, info.total_supply)?;

        // Đánh dấu đã claim trước khi chuyển tiền (chống claim lại).
        env.storage().persistent().set(&ckey, &true);
        env.storage()
            .persistent()
            .extend_ttl(&ckey, PERIOD_THRESHOLD, PERIOD_BUMP);

        if share > 0 {
            let this = env.current_contract_address();
            let vnd = WptTokenClient::new(&env, &vnd_addr(&env));
            if vnd.balance(&this) < share {
                return Err(Error::InsufficientTreasury);
            }
            vnd.transfer(&this, &investor, &share);
            info.claimed_total += share;
            env.storage().persistent().set(&DKey::Period(period_id), &info);
        }

        env.events().publish(
            (Symbol::new(&env, "claim"), investor, period_id),
            share,
        );
        Ok(share)
    }

    pub fn period_info(env: Env, period_id: u32) -> Option<PeriodInfo> {
        env.storage().persistent().get(&DKey::Period(period_id))
    }

    pub fn has_claimed(env: Env, period_id: u32, investor: Address) -> bool {
        let ckey = DKey::Claimed(ClaimKey {
            period_id,
            holder: investor,
        });
        env.storage().persistent().get(&ckey).unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::String;
    use revenue_oracle::{RevenueOracle, RevenueOracleClient};
    use wpt_token::{WptToken, WptTokenClient};

    #[test]
    fn test_pull_claim_uses_snapshot_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        // Token WPT và VND (dùng chung mã token).
        let wpt_id = env.register(WptToken, ());
        let wpt = WptTokenClient::new(&env, &wpt_id);
        wpt.initialize(&admin, &7u32, &String::from_str(&env, "WPT"), &String::from_str(&env, "WPT"));
        let vnd_id = env.register(WptToken, ());
        let vnd = WptTokenClient::new(&env, &vnd_id);
        vnd.initialize(&admin, &7u32, &String::from_str(&env, "VND"), &String::from_str(&env, "VND"));

        // Oracle.
        let orc_id = env.register(RevenueOracle, ());
        let orc = RevenueOracleClient::new(&env, &orc_id);
        orc.initialize(&admin, &admin); // reporter = admin cho gọn khi test

        // Distributor pull.
        let dist_id = env.register(ProfitDistributorPull, ());
        let dist = ProfitDistributorPullClient::new(&env, &dist_id);
        dist.initialize(&admin, &wpt_id, &vnd_id, &orc_id);

        let a = Address::generate(&env);
        let b = Address::generate(&env);
        for who in [&a, &b, &dist_id] {
            wpt.set_authorized(who, &true);
            vnd.set_authorized(who, &true);
        }

        // Phát hành WPT: a=700, b=300.
        wpt.mint(&a, &700);
        wpt.mint(&b, &300);

        // Nạp VND vào kho distributor.
        vnd.mint(&dist_id, &1_000_000);

        // Oracle: báo cáo và finalize doanh thu kỳ 1.
        orc.report(&1u32, &1_000_000);
        orc.finalize(&1u32);

        // Mở kỳ: chốt snapshot.
        dist.open_period(&1u32);

        // Sau khi mở kỳ, a bán bớt cho b — KHÔNG ảnh hưởng phần chia (dùng số dư đã chốt).
        wpt.transfer(&a, &b, &700);
        assert_eq!(wpt.balance(&a), 0);

        assert_eq!(dist.preview_claim(&1u32, &a), 700_000);
        let got_a = dist.claim(&1u32, &a);
        assert_eq!(got_a, 700_000);
        let got_b = dist.claim(&1u32, &b);
        assert_eq!(got_b, 300_000);

        assert_eq!(vnd.balance(&a), 700_000);
        assert_eq!(vnd.balance(&b), 300_000);

        // Claim lần hai phải lỗi.
        assert!(dist.try_claim(&1u32, &a).is_err());
    }
}
