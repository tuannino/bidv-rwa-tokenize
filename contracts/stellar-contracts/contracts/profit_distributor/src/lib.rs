#![no_std]
//! Profit Distributor — Hợp đồng TÍNH và CHIA lợi nhuận định kỳ.
//! ---------------------------------------------------------------------------
//! Mô hình: mỗi kỳ (tháng/quý), doanh thu ròng của dự án (đã quy ra token VND)
//! được chia cho các nhà đầu tư theo TỶ LỆ nắm giữ token SPT.
//!
//! Công thức (làm tròn xuống):
//!     share_i = total_revenue * balance_i / registered_supply
//! trong đó registered_supply là tổng SPT của các nhà đầu tư đã đăng ký.
//!
//! Luồng vận hành:
//!   1. Admin nạp sẵn VND vào kho của chính hợp đồng này (transfer VND -> địa chỉ HĐ).
//!   2. Admin gọi distribute(period_id, total_revenue).
//!   3. HĐ đọc số dư SPT của từng holder, tính phần chia, đẩy VND cho từng người.
//!
//! Mô hình "push" (HĐ chủ động trả) phù hợp số nhà đầu tư vừa phải (tổ chức).
//! Với hàng nghìn holder, nên chuyển sang mô hình "pull" (từng người claim) để
//! tránh giới hạn tài nguyên mỗi giao dịch — xem ghi chú trong guide.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Symbol, Vec,
};
use spt_token::SptTokenClient;

const DAY: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY;
const PERIOD_BUMP: u32 = 400 * DAY;
const PERIOD_THRESHOLD: u32 = PERIOD_BUMP - DAY;

#[derive(Clone)]
#[contracttype]
pub enum DKey {
    Admin,
    Spt,
    Vnd,
    Holders,
    Period(u32),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PeriodRecord {
    pub total_revenue: i128,
    pub total_paid: i128,
    pub holder_count: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NegativeAmount = 2,
    PeriodAlreadyDistributed = 3,
    NoHolders = 4,
    ZeroSupply = 5,
    AlreadyRegistered = 6,
    NotRegistered = 7,
    Overflow = 8,
}

#[contract]
pub struct ProfitDistributor;

// --------------------------- helper ---------------------------------------
fn admin(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Admin);
    a.unwrap()
}
fn spt_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Spt);
    a.unwrap()
}
fn vnd_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DKey::Vnd);
    a.unwrap()
}
fn read_holders(env: &Env) -> Vec<Address> {
    let h: Option<Vec<Address>> = env.storage().instance().get(&DKey::Holders);
    h.unwrap_or(Vec::new(env))
}
fn bump(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

/// a*b/c an toàn với chống tràn (a,b,c >= 0).
/// i128 max ~1.7e38; với giá trị RWA thực tế (doanh thu, số dư) vẫn an toàn.
/// Muốn biên tuyệt đối, thay bằng soroban_sdk::I256 cho bước nhân.
fn mul_div(a: i128, b: i128, c: i128) -> Result<i128, Error> {
    let prod = a.checked_mul(b).ok_or(Error::Overflow)?;
    Ok(prod / c)
}

#[contractimpl]
impl ProfitDistributor {
    pub fn initialize(
        env: Env,
        admin_addr: Address,
        spt_token: Address,
        vnd_token: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DKey::Admin, &admin_addr);
        env.storage().instance().set(&DKey::Spt, &spt_token);
        env.storage().instance().set(&DKey::Vnd, &vnd_token);
        env.storage()
            .instance()
            .set(&DKey::Holders, &Vec::<Address>::new(&env));
        bump(&env);
        Ok(())
    }

    /// Đăng ký nhà đầu tư (đã KYC) vào danh sách nhận chia lợi nhuận. Chỉ admin.
    pub fn register_holder(env: Env, investor: Address) -> Result<(), Error> {
        admin(&env).require_auth();
        bump(&env);
        let mut hs = read_holders(&env);
        if hs.iter().any(|a| a == investor) {
            return Err(Error::AlreadyRegistered);
        }
        hs.push_back(investor.clone());
        env.storage().instance().set(&DKey::Holders, &hs);
        env.events()
            .publish((Symbol::new(&env, "register"), investor), ());
        Ok(())
    }

    /// Gỡ nhà đầu tư khỏi danh sách. Chỉ admin.
    pub fn remove_holder(env: Env, investor: Address) -> Result<(), Error> {
        admin(&env).require_auth();
        bump(&env);
        let hs = read_holders(&env);
        let mut out = Vec::new(&env);
        let mut found = false;
        for a in hs.iter() {
            if a == investor {
                found = true;
            } else {
                out.push_back(a);
            }
        }
        if !found {
            return Err(Error::NotRegistered);
        }
        env.storage().instance().set(&DKey::Holders, &out);
        env.events()
            .publish((Symbol::new(&env, "remove"), investor), ());
        Ok(())
    }

    pub fn holders(env: Env) -> Vec<Address> {
        read_holders(&env)
    }

    /// Tổng SPT của các nhà đầu tư đã đăng ký — mẫu số để chia tỷ lệ.
    pub fn registered_supply(env: Env) -> i128 {
        let spt = SptTokenClient::new(&env, &spt_addr(&env));
        let mut total: i128 = 0;
        for a in read_holders(&env).iter() {
            total += spt.balance(&a);
        }
        total
    }

    // -------------------- QUY TRÌNH: TÍNH LỢI NHUẬN -----------------------
    /// Xem trước phần lợi nhuận (VND) một nhà đầu tư nhận với doanh thu kỳ cho trước.
    /// Là hàm chỉ đọc, tách riêng để kiểm thử công thức độc lập với việc chuyển tiền.
    pub fn preview_share(env: Env, total_revenue: i128, investor: Address) -> i128 {
        let spt = SptTokenClient::new(&env, &spt_addr(&env));
        let mut total: i128 = 0;
        for a in read_holders(&env).iter() {
            total += spt.balance(&a);
        }
        if total <= 0 {
            return 0;
        }
        let bal = spt.balance(&investor);
        mul_div(total_revenue, bal, total).unwrap_or(0)
    }

    // -------------------- QUY TRÌNH: CHIA LỢI NHUẬN -----------------------
    /// Chia lợi nhuận cho một kỳ. Admin phải nạp đủ VND vào kho HĐ trước khi gọi.
    /// Mỗi period_id chỉ chia được một lần (chống chia trùng).
    pub fn distribute(
        env: Env,
        period_id: u32,
        total_revenue: i128,
    ) -> Result<PeriodRecord, Error> {
        admin(&env).require_auth();
        bump(&env);
        if total_revenue < 0 {
            return Err(Error::NegativeAmount);
        }
        if env.storage().persistent().has(&DKey::Period(period_id)) {
            return Err(Error::PeriodAlreadyDistributed);
        }
        let hs = read_holders(&env);
        if hs.len() == 0 {
            return Err(Error::NoHolders);
        }

        let spt = SptTokenClient::new(&env, &spt_addr(&env));
        let vnd = SptTokenClient::new(&env, &vnd_addr(&env));
        let this = env.current_contract_address();

        // Mẫu số.
        let mut total: i128 = 0;
        for a in hs.iter() {
            total += spt.balance(&a);
        }
        if total <= 0 {
            return Err(Error::ZeroSupply);
        }

        // Chia theo tỷ lệ. Phần dư do làm tròn nằm lại trong kho HĐ.
        let mut paid: i128 = 0;
        for a in hs.iter() {
            let bal = spt.balance(&a);
            if bal <= 0 {
                continue;
            }
            let share = mul_div(total_revenue, bal, total)?;
            if share > 0 {
                // VND chuyển từ kho HĐ (this) sang nhà đầu tư — HĐ tự ủy quyền cho
                // sub-call của chính nó nên không cần chữ ký ngoài.
                vnd.transfer(&this, &a, &share);
                paid += share;
                env.events()
                    .publish((Symbol::new(&env, "payout"), a.clone(), period_id), share);
            }
        }

        let rec = PeriodRecord {
            total_revenue,
            total_paid: paid,
            holder_count: hs.len(),
        };
        env.storage()
            .persistent()
            .set(&DKey::Period(period_id), &rec);
        env.storage()
            .persistent()
            .extend_ttl(&DKey::Period(period_id), PERIOD_THRESHOLD, PERIOD_BUMP);
        env.events().publish(
            (Symbol::new(&env, "distribute"), period_id),
            (total_revenue, paid),
        );
        Ok(rec)
    }

    pub fn period_info(env: Env, period_id: u32) -> Option<PeriodRecord> {
        env.storage().persistent().get(&DKey::Period(period_id))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::String;
    use spt_token::{SptToken, SptTokenClient};

    #[test]
    fn test_distribute_pro_rata() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);

        // Deploy hai token: SPT (quyền hưởng) và VND (chi trả).
        let spt_id = env.register(SptToken, ());
        let spt = SptTokenClient::new(&env, &spt_id);
        spt.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "SPT"),
            &String::from_str(&env, "SPT"),
        );
        let vnd_id = env.register(SptToken, ());
        let vnd = SptTokenClient::new(&env, &vnd_id);
        vnd.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "VND"),
            &String::from_str(&env, "VND"),
        );

        // Deploy distributor.
        let dist_id = env.register(ProfitDistributor, ());
        let dist = ProfitDistributorClient::new(&env, &dist_id);
        dist.initialize(&admin, &spt_id, &vnd_id);

        let a = Address::generate(&env);
        let b = Address::generate(&env);

        // KYC/authorize cho nhà đầu tư và cho chính địa chỉ HĐ (để giữ VND).
        for who in [&a, &b, &dist_id] {
            spt.set_authorized(who, &true);
            vnd.set_authorized(who, &true);
        }

        // Phát hành SPT: a=700, b=300.
        spt.mint(&a, &700);
        spt.mint(&b, &300);

        // Đăng ký holder.
        dist.register_holder(&a);
        dist.register_holder(&b);

        // Nạp VND vào kho HĐ phân phối.
        vnd.mint(&dist_id, &1_000_000);

        // Chia doanh thu kỳ 1 = 1.000.000.
        let rec = dist.distribute(&1u32, &1_000_000);
        assert_eq!(rec.total_paid, 1_000_000);
        assert_eq!(vnd.balance(&a), 700_000);
        assert_eq!(vnd.balance(&b), 300_000);

        // Chia trùng kỳ 1 -> lỗi.
        assert!(dist.try_distribute(&1u32, &1_000_000).is_err());

        // preview khớp phần thực chia.
        assert_eq!(dist.preview_share(&1_000_000, &a), 700_000);
    }
}
