#![no_std]
//! Revenue Oracle — Hợp đồng đưa DOANH THU KỲ lên chuỗi.
//! ---------------------------------------------------------------------------
//! Tách nguồn doanh thu ra khỏi hợp đồng chia lợi nhuận: một vai `reporter`
//! (nên là ví multisig hoặc quy trình ký nhiều bên của ngân hàng) báo cáo doanh
//! thu từng kỳ; admin `finalize` để khóa số liệu trước khi chia. Hợp đồng chia
//! (profit_distributor_pull) đọc từ đây thay vì để một khóa đơn tự đặt doanh thu.
//!
//! Vòng đời một kỳ:
//!   report(period_id, revenue)   -> reporter ký, ghi/điều chỉnh khi CHƯA finalize
//!   finalize(period_id)          -> admin ký, khóa số liệu (bất biến sau đó)
//!   get(period_id) / is_finalized(period_id)  -> hợp đồng chia đọc

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, Symbol};

const DAY: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY;
const PERIOD_BUMP: u32 = 400 * DAY;
const PERIOD_THRESHOLD: u32 = PERIOD_BUMP - DAY;

#[derive(Clone)]
#[contracttype]
pub enum OKey {
    Admin,
    Reporter,
    Revenue(u32),
    Finalized(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NegativeAmount = 2,
    AlreadyFinalized = 3,
    NotReported = 4,
}

#[contract]
pub struct RevenueOracle;

fn admin(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&OKey::Admin);
    a.unwrap()
}
fn reporter(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&OKey::Reporter);
    a.unwrap()
}
fn is_final(env: &Env, period_id: u32) -> bool {
    let v: Option<bool> = env.storage().persistent().get(&OKey::Finalized(period_id));
    v.unwrap_or(false)
}
fn bump(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

#[contractimpl]
impl RevenueOracle {
    pub fn initialize(env: Env, admin_addr: Address, reporter_addr: Address) -> Result<(), Error> {
        if env.storage().instance().has(&OKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&OKey::Admin, &admin_addr);
        env.storage().instance().set(&OKey::Reporter, &reporter_addr);
        bump(&env);
        Ok(())
    }

    /// Đổi vai reporter (ví dụ chuyển sang ví multisig mới). Chỉ admin.
    pub fn set_reporter(env: Env, new_reporter: Address) -> Result<(), Error> {
        admin(&env).require_auth();
        env.storage().instance().set(&OKey::Reporter, &new_reporter);
        bump(&env);
        env.events()
            .publish((Symbol::new(&env, "set_reporter"), new_reporter), ());
        Ok(())
    }

    /// Báo cáo doanh thu kỳ. Reporter ký. Ghi hoặc điều chỉnh khi kỳ CHƯA finalize.
    pub fn report(env: Env, period_id: u32, revenue: i128) -> Result<(), Error> {
        reporter(&env).require_auth();
        bump(&env);
        if revenue < 0 {
            return Err(Error::NegativeAmount);
        }
        if is_final(&env, period_id) {
            return Err(Error::AlreadyFinalized);
        }
        env.storage()
            .persistent()
            .set(&OKey::Revenue(period_id), &revenue);
        env.storage().persistent().extend_ttl(
            &OKey::Revenue(period_id),
            PERIOD_THRESHOLD,
            PERIOD_BUMP,
        );
        env.events()
            .publish((Symbol::new(&env, "report"), period_id), revenue);
        Ok(())
    }

    /// Khóa số liệu kỳ. Sau khi finalize không sửa được nữa. Chỉ admin.
    pub fn finalize(env: Env, period_id: u32) -> Result<(), Error> {
        admin(&env).require_auth();
        bump(&env);
        if !env.storage().persistent().has(&OKey::Revenue(period_id)) {
            return Err(Error::NotReported);
        }
        if is_final(&env, period_id) {
            return Err(Error::AlreadyFinalized);
        }
        env.storage()
            .persistent()
            .set(&OKey::Finalized(period_id), &true);
        env.storage().persistent().extend_ttl(
            &OKey::Finalized(period_id),
            PERIOD_THRESHOLD,
            PERIOD_BUMP,
        );
        env.events()
            .publish((Symbol::new(&env, "finalize"), period_id), ());
        Ok(())
    }

    pub fn get(env: Env, period_id: u32) -> Option<i128> {
        env.storage().persistent().get(&OKey::Revenue(period_id))
    }

    pub fn is_finalized(env: Env, period_id: u32) -> bool {
        is_final(&env, period_id)
    }

    pub fn reporter(env: Env) -> Address {
        reporter(&env)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_report_finalize_lock() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let rep = Address::generate(&env);
        let id = env.register(RevenueOracle, ());
        let c = RevenueOracleClient::new(&env, &id);
        c.initialize(&admin, &rep);

        c.report(&1u32, &1_000_000);
        assert_eq!(c.get(&1u32), Some(1_000_000));
        // Điều chỉnh khi chưa finalize.
        c.report(&1u32, &1_200_000);
        assert_eq!(c.get(&1u32), Some(1_200_000));

        c.finalize(&1u32);
        assert!(c.is_finalized(&1u32));
        // Sau finalize không sửa được.
        assert!(c.try_report(&1u32, &9_999).is_err());
    }
}
