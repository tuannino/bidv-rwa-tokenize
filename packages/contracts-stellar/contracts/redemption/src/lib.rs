#![no_std]
//! Redemption — Hợp đồng MUA LẠI / HOÀN VỐN (redeem).
//! ---------------------------------------------------------------------------
//! Nhà đầu tư trả lại token WPT để nhận lại vốn bằng token VND theo tỷ giá.
//!   - Đốt (burn) WPT của nhà đầu tư -> giảm tổng cung, "rút" khỏi dự án.
//!   - Chuyển VND từ kho của hợp đồng cho nhà đầu tư.
//!
//! Tỷ giá `rate` lưu dạng số nguyên có thang: VND-stroop trả cho 1 WPT-stroop,
//! nhân với SCALE. Ví dụ muốn 1 WPT-unit đổi 10.000 VND-unit thì rate = 10_000*SCALE
//! (vì cùng 7 chữ số thập phân, hệ số stroop triệt tiêu).
//!     vnd_out = wpt_amount * rate / SCALE

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, Symbol};
use wpt_token::WptTokenClient;

const DAY: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY;

/// Hệ số thang cho tỷ giá (1e7). Cho phép biểu diễn tỷ giá có phần lẻ.
pub const SCALE: i128 = 10_000_000;

#[derive(Clone)]
#[contracttype]
pub enum RKey {
    Admin,
    Wpt,
    Vnd,
    Rate,
    Paused,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NegativeAmount = 2,
    Paused = 3,
    InsufficientTreasury = 4,
    Overflow = 5,
}

#[contract]
pub struct Redemption;

fn admin(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&RKey::Admin);
    a.unwrap()
}
fn wpt_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&RKey::Wpt);
    a.unwrap()
}
fn vnd_addr(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&RKey::Vnd);
    a.unwrap()
}
fn read_rate(env: &Env) -> i128 {
    let a: Option<i128> = env.storage().instance().get(&RKey::Rate);
    a.unwrap_or(0)
}
fn is_paused(env: &Env) -> bool {
    let a: Option<bool> = env.storage().instance().get(&RKey::Paused);
    a.unwrap_or(false)
}
fn bump(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

#[contractimpl]
impl Redemption {
    pub fn initialize(
        env: Env,
        admin_addr: Address,
        wpt_token: Address,
        vnd_token: Address,
        rate: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&RKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        if rate < 0 {
            return Err(Error::NegativeAmount);
        }
        env.storage().instance().set(&RKey::Admin, &admin_addr);
        env.storage().instance().set(&RKey::Wpt, &wpt_token);
        env.storage().instance().set(&RKey::Vnd, &vnd_token);
        env.storage().instance().set(&RKey::Rate, &rate);
        env.storage().instance().set(&RKey::Paused, &false);
        bump(&env);
        Ok(())
    }

    /// Cập nhật tỷ giá mua lại. Chỉ admin.
    pub fn set_rate(env: Env, new_rate: i128) -> Result<(), Error> {
        admin(&env).require_auth();
        if new_rate < 0 {
            return Err(Error::NegativeAmount);
        }
        env.storage().instance().set(&RKey::Rate, &new_rate);
        bump(&env);
        env.events()
            .publish((Symbol::new(&env, "set_rate"),), new_rate);
        Ok(())
    }

    /// Tạm dừng / mở lại việc mua lại. Chỉ admin.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        admin(&env).require_auth();
        env.storage().instance().set(&RKey::Paused, &paused);
        bump(&env);
        Ok(())
    }

    pub fn rate(env: Env) -> i128 {
        read_rate(&env)
    }

    /// Xem trước số VND nhận được khi hoàn lại `wpt_amount`.
    pub fn preview(env: Env, wpt_amount: i128) -> Result<i128, Error> {
        let prod = wpt_amount.checked_mul(read_rate(&env)).ok_or(Error::Overflow)?;
        Ok(prod / SCALE)
    }

    // -------------------------- QUY TRÌNH: REDEEM -------------------------
    /// Nhà đầu tư hoàn WPT để nhận lại vốn bằng VND.
    /// investor phải là bên KÝ giao dịch (source) để ủy quyền cho việc đốt WPT.
    pub fn redeem(env: Env, investor: Address, wpt_amount: i128) -> Result<i128, Error> {
        investor.require_auth();
        if wpt_amount < 0 {
            return Err(Error::NegativeAmount);
        }
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        bump(&env);

        let prod = wpt_amount.checked_mul(read_rate(&env)).ok_or(Error::Overflow)?;
        let vnd_out = prod / SCALE;

        let this = env.current_contract_address();
        let vnd = WptTokenClient::new(&env, &vnd_addr(&env));
        if vnd.balance(&this) < vnd_out {
            return Err(Error::InsufficientTreasury);
        }

        // Đốt WPT của nhà đầu tư (đã ủy quyền qua require_auth ở trên).
        let wpt = WptTokenClient::new(&env, &wpt_addr(&env));
        wpt.burn(&investor, &wpt_amount);

        // Trả VND từ kho HĐ.
        if vnd_out > 0 {
            vnd.transfer(&this, &investor, &vnd_out);
        }

        env.events().publish(
            (Symbol::new(&env, "redeem"), investor),
            (wpt_amount, vnd_out),
        );
        Ok(vnd_out)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::String;
    use wpt_token::{WptToken, WptTokenClient};

    #[test]
    fn test_redeem() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let inv = Address::generate(&env);

        let wpt_id = env.register(WptToken, ());
        let wpt = WptTokenClient::new(&env, &wpt_id);
        wpt.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "WPT"),
            &String::from_str(&env, "WPT"),
        );
        let vnd_id = env.register(WptToken, ());
        let vnd = WptTokenClient::new(&env, &vnd_id);
        vnd.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "VND"),
            &String::from_str(&env, "VND"),
        );

        // 1 WPT-unit đổi 10.000 VND-unit.
        let red_id = env.register(Redemption, ());
        let red = RedemptionClient::new(&env, &red_id);
        red.initialize(&admin, &wpt_id, &vnd_id, &(10_000i128 * SCALE));

        for who in [&inv, &red_id] {
            wpt.set_authorized(who, &true);
            vnd.set_authorized(who, &true);
        }
        wpt.mint(&inv, &100); // 100 WPT
        vnd.mint(&red_id, &2_000_000); // kho VND

        let out = red.redeem(&inv, &100);
        assert_eq!(out, 1_000_000); // 100 * 10.000
        assert_eq!(wpt.balance(&inv), 0);
        assert_eq!(vnd.balance(&inv), 1_000_000);
        assert_eq!(wpt.total_supply(), 0); // WPT đã đốt hết
    }
}
