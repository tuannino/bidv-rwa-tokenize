#![no_std]
//! SPT — Solar Project Token
//! ---------------------------------------------------------------------------
//! Token quyền hưởng lợi nhuận cho dự án điện mặt trời (RWA) trên Stellar/Soroban.
//!
//! Hợp đồng tuân thủ giao diện SEP-41 (Soroban Token Interface) và mở rộng thêm
//! phần QUẢN TRỊ giống Stellar Asset Contract, để ngân hàng phát hành giữ quyền
//! kiểm soát:
//!   - Chỉ địa chỉ đã KYC (authorized = true) mới được nắm giữ / nhận token.
//!   - Admin có quyền phát hành (mint), thu hồi cưỡng chế (clawback),
//!     đóng băng / mở băng (set_authorized).
//!   - Người nắm giữ tự đốt (burn) token của mình.
//!
//! Trên Stellar còn một cách làm KHÁC: dùng "classic asset" với các cờ ở tầng
//! giao thức (auth_required, auth_revocable, clawback_enabled) rồi bọc bằng SAC.
//! Cách đó không cần viết hợp đồng này; xem phần so sánh trong guide. Hợp đồng
//! này là lựa chọn "token tùy biến bằng Soroban" khi cần logic riêng.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, String, Symbol,
};

// ===========================================================================
// Hằng số quản lý vòng đời lưu trữ (State Archival / TTL)
// Soroban thu phí "thuê" cho mỗi ô lưu trữ; ta chủ động gia hạn để dữ liệu sống.
// 1 ngày ~ 17.280 ledger (mỗi ledger ~5 giây).
// ===========================================================================
const DAY: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY;
const ENTRY_BUMP: u32 = 120 * DAY;
const ENTRY_THRESHOLD: u32 = ENTRY_BUMP - DAY;

// ===========================================================================
// Khóa lưu trữ
// ===========================================================================
#[derive(Clone)]
#[contracttype]
pub struct AllowanceKey {
    pub from: Address,
    pub spender: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Authorized(Address),
    Allowance(AllowanceKey),
}

// ===========================================================================
// Mã lỗi (trả về cho client thay vì panic khi lỗi nghiệp vụ)
// ===========================================================================
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NegativeAmount = 2,
    HolderNotAuthorized = 3,
    InsufficientBalance = 4,
    InsufficientAllowance = 5,
    InvalidExpiration = 6,
}

#[contract]
pub struct SptToken;

// ===========================================================================
// Hàm nội bộ (helper) — đọc/ghi lưu trữ + gia hạn TTL
// ===========================================================================
fn read_admin(env: &Env) -> Address {
    let a: Option<Address> = env.storage().instance().get(&DataKey::Admin);
    a.unwrap()
}

fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn read_balance(env: &Env, addr: &Address) -> i128 {
    let key = DataKey::Balance(addr.clone());
    let b: Option<i128> = env.storage().persistent().get(&key);
    match b {
        Some(v) => {
            env.storage()
                .persistent()
                .extend_ttl(&key, ENTRY_THRESHOLD, ENTRY_BUMP);
            v
        }
        None => 0,
    }
}

fn write_balance(env: &Env, addr: &Address, amount: i128) {
    let key = DataKey::Balance(addr.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, ENTRY_THRESHOLD, ENTRY_BUMP);
}

fn is_authorized(env: &Env, addr: &Address) -> bool {
    let key = DataKey::Authorized(addr.clone());
    let v: Option<bool> = env.storage().persistent().get(&key);
    v.unwrap_or(false)
}

fn write_authorized(env: &Env, addr: &Address, val: bool) {
    let key = DataKey::Authorized(addr.clone());
    env.storage().persistent().set(&key, &val);
    env.storage()
        .persistent()
        .extend_ttl(&key, ENTRY_THRESHOLD, ENTRY_BUMP);
}

fn read_total_supply(env: &Env) -> i128 {
    let v: Option<i128> = env.storage().instance().get(&DataKey::TotalSupply);
    v.unwrap_or(0)
}

fn write_total_supply(env: &Env, v: i128) {
    env.storage().instance().set(&DataKey::TotalSupply, &v);
}

fn read_allowance(env: &Env, from: &Address, spender: &Address) -> AllowanceValue {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    let v: Option<AllowanceValue> = env.storage().temporary().get(&key);
    match v {
        Some(a) => {
            if a.expiration_ledger < env.ledger().sequence() {
                AllowanceValue {
                    amount: 0,
                    expiration_ledger: a.expiration_ledger,
                }
            } else {
                a
            }
        }
        None => AllowanceValue {
            amount: 0,
            expiration_ledger: 0,
        },
    }
}

fn write_allowance(env: &Env, from: &Address, spender: &Address, amount: i128, exp: u32) {
    let key = DataKey::Allowance(AllowanceKey {
        from: from.clone(),
        spender: spender.clone(),
    });
    env.storage().temporary().set(
        &key,
        &AllowanceValue {
            amount,
            expiration_ledger: exp,
        },
    );
    if amount > 0 {
        let live = exp.saturating_sub(env.ledger().sequence());
        if live > 0 {
            env.storage().temporary().extend_ttl(&key, live, live);
        }
    }
}

fn spend_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) -> Result<(), Error> {
    let allow = read_allowance(env, from, spender);
    if allow.amount < amount {
        return Err(Error::InsufficientAllowance);
    }
    write_allowance(env, from, spender, allow.amount - amount, allow.expiration_ledger);
    Ok(())
}

fn check_nonneg(amount: i128) -> Result<(), Error> {
    if amount < 0 {
        Err(Error::NegativeAmount)
    } else {
        Ok(())
    }
}

fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) -> Result<(), Error> {
    check_nonneg(amount)?;
    extend_instance(env);
    // KYC gate: cả bên gửi và bên nhận phải nằm trong danh sách trắng.
    if !is_authorized(env, from) || !is_authorized(env, to) {
        return Err(Error::HolderNotAuthorized);
    }
    let fb = read_balance(env, from);
    if fb < amount {
        return Err(Error::InsufficientBalance);
    }
    write_balance(env, from, fb - amount);
    let tb = read_balance(env, to);
    write_balance(env, to, tb + amount);
    env.events()
        .publish((Symbol::new(env, "transfer"), from.clone(), to.clone()), amount);
    Ok(())
}

fn do_burn(env: &Env, from: &Address, amount: i128) -> Result<(), Error> {
    check_nonneg(amount)?;
    extend_instance(env);
    let fb = read_balance(env, from);
    if fb < amount {
        return Err(Error::InsufficientBalance);
    }
    write_balance(env, from, fb - amount);
    write_total_supply(env, read_total_supply(env) - amount);
    env.events()
        .publish((Symbol::new(env, "burn"), from.clone()), amount);
    Ok(())
}

// ===========================================================================
// Giao diện công khai
// ===========================================================================
#[contractimpl]
impl SptToken {
    /// Khởi tạo: đặt admin và metadata. Chỉ gọi được một lần.
    pub fn initialize(
        env: Env,
        admin: Address,
        decimals: u32,
        name: String,
        symbol: String,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        extend_instance(&env);
        Ok(())
    }

    // ------------------------- QUY TRÌNH: MINT -----------------------------
    /// Phát hành token cho nhà đầu tư đã KYC. Chỉ admin.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        check_nonneg(amount)?;
        read_admin(&env).require_auth();
        extend_instance(&env);
        if !is_authorized(&env, &to) {
            return Err(Error::HolderNotAuthorized);
        }
        let bal = read_balance(&env, &to);
        write_balance(&env, &to, bal + amount);
        write_total_supply(&env, read_total_supply(&env) + amount);
        env.events()
            .publish((Symbol::new(&env, "mint"), to.clone()), amount);
        Ok(())
    }

    // ------------------------- QUY TRÌNH: CLAWBACK -------------------------
    /// Thu hồi cưỡng chế token từ một địa chỉ (không cần địa chỉ đó đồng ý).
    /// Dùng khi vi phạm tuân thủ, sự cố pháp lý, lệnh cơ quan quản lý. Chỉ admin.
    pub fn clawback(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        check_nonneg(amount)?;
        read_admin(&env).require_auth();
        extend_instance(&env);
        let bal = read_balance(&env, &from);
        if bal < amount {
            return Err(Error::InsufficientBalance);
        }
        write_balance(&env, &from, bal - amount);
        write_total_supply(&env, read_total_supply(&env) - amount);
        env.events()
            .publish((Symbol::new(&env, "clawback"), from.clone()), amount);
        Ok(())
    }

    // ------------------- QUY TRÌNH: FREEZE / WHITELIST ---------------------
    /// Bật/tắt quyền nắm giữ của một địa chỉ (danh sách trắng KYC + đóng băng).
    /// authorize=true: cho phép nắm giữ/nhận; false: đóng băng. Chỉ admin.
    pub fn set_authorized(env: Env, id: Address, authorize: bool) -> Result<(), Error> {
        read_admin(&env).require_auth();
        extend_instance(&env);
        write_authorized(&env, &id, authorize);
        env.events()
            .publish((Symbol::new(&env, "set_auth"), id.clone()), authorize);
        Ok(())
    }

    pub fn authorized(env: Env, id: Address) -> bool {
        is_authorized(&env, &id)
    }

    /// Chuyển quyền admin. Chỉ admin hiện tại.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        read_admin(&env).require_auth();
        extend_instance(&env);
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events()
            .publish((Symbol::new(&env, "set_admin"),), new_admin);
        Ok(())
    }

    pub fn admin(env: Env) -> Address {
        read_admin(&env)
    }

    // --------------------------- SEP-41 lõi -------------------------------
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        do_transfer(&env, &from, &to, amount)
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), Error> {
        spender.require_auth();
        check_nonneg(amount)?;
        spend_allowance(&env, &from, &spender, amount)?;
        do_transfer(&env, &from, &to, amount)
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), Error> {
        from.require_auth();
        check_nonneg(amount)?;
        if amount > 0 && expiration_ledger < env.ledger().sequence() {
            return Err(Error::InvalidExpiration);
        }
        write_allowance(&env, &from, &spender, amount, expiration_ledger);
        extend_instance(&env);
        env.events().publish(
            (Symbol::new(&env, "approve"), from, spender),
            (amount, expiration_ledger),
        );
        Ok(())
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        read_allowance(&env, &from, &spender).amount
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, &id)
    }

    // --------------------------- QUY TRÌNH: BURN --------------------------
    /// Người nắm giữ tự đốt token của mình.
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        do_burn(&env, &from, amount)
    }

    /// Đốt token thông qua hạn mức ủy quyền (spender đốt hộ from).
    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) -> Result<(), Error> {
        spender.require_auth();
        check_nonneg(amount)?;
        spend_allowance(&env, &from, &spender, amount)?;
        do_burn(&env, &from, amount)
    }

    // --------------------------- Metadata ---------------------------------
    pub fn total_supply(env: Env) -> i128 {
        read_total_supply(&env)
    }
    pub fn decimals(env: Env) -> u32 {
        let v: Option<u32> = env.storage().instance().get(&DataKey::Decimals);
        v.unwrap()
    }
    pub fn name(env: Env) -> String {
        let v: Option<String> = env.storage().instance().get(&DataKey::Name);
        v.unwrap()
    }
    pub fn symbol(env: Env) -> String {
        let v: Option<String> = env.storage().instance().get(&DataKey::Symbol);
        v.unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_mint_requires_authorized_holder() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let inv = Address::generate(&env);
        let id = env.register(SptToken, ());
        let c = SptTokenClient::new(&env, &id);
        c.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "Solar Project Token"),
            &String::from_str(&env, "SPT"),
        );

        // Chưa KYC (authorized=false) -> mint phải lỗi.
        assert!(c.try_mint(&inv, &1_000).is_err());

        // Sau khi đưa vào danh sách trắng -> mint được.
        c.set_authorized(&inv, &true);
        c.mint(&inv, &1_000);
        assert_eq!(c.balance(&inv), 1_000);
        assert_eq!(c.total_supply(), 1_000);
    }

    #[test]
    fn test_transfer_and_clawback() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let id = env.register(SptToken, ());
        let c = SptTokenClient::new(&env, &id);
        c.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "SPT"),
            &String::from_str(&env, "SPT"),
        );
        c.set_authorized(&a, &true);
        c.set_authorized(&b, &true);
        c.mint(&a, &1_000);

        c.transfer(&a, &b, &400);
        assert_eq!(c.balance(&a), 600);
        assert_eq!(c.balance(&b), 400);

        // Thu hồi cưỡng chế từ b.
        c.clawback(&b, &400);
        assert_eq!(c.balance(&b), 0);
        assert_eq!(c.total_supply(), 600);
    }

    #[test]
    fn test_transfer_blocked_when_not_authorized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let id = env.register(SptToken, ());
        let c = SptTokenClient::new(&env, &id);
        c.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "SPT"),
            &String::from_str(&env, "SPT"),
        );
        c.set_authorized(&a, &true);
        c.mint(&a, &1_000);
        // b chưa được KYC -> chuyển sang b phải lỗi.
        assert!(c.try_transfer(&a, &b, &100).is_err());
    }
}
