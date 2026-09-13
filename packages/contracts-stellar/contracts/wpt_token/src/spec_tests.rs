//! SPEC TEST - P4 MINT (Stellar / Soroban)
//!
//! Kiểm acceptance criteria của `.kiro/specs/p4-mint-stellar/requirements.md`
//! ở tầng contract. Chạy bằng `cargo test` (không cần mạng, không cần testnet).
//!
//! Cách bật: thêm hai dòng sau vào cuối `src/lib.rs` của crate này:
//! ```ignore
//! #[cfg(test)]
//! mod spec_tests;
//! ```
//!
//! Ghi chú đơn vị: token Stellar quy ước decimals 7 (1 đơn vị hiển thị = 1e7
//! đơn vị nhỏ nhất). Các số trong test là ĐƠN VỊ NHỎ NHẤT để khỏi lẫn thang.

#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;

/// Dựng token đã initialize, trả về client và địa chỉ admin.
fn setup(env: &Env) -> (SptTokenClient<'static>, Address) {
    let admin = Address::generate(env);
    let id = env.register(SptToken, ());
    let c = SptTokenClient::new(env, &id);
    c.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(env, "Wind Project Token"),
        &soroban_sdk::String::from_str(env, "WPT"),
    );
    (c, admin)
}

// ===========================================================================
//  WHITELIST (set_authorized) - điều kiện tuân thủ
// ===========================================================================

#[test]
fn p4_1_authorize_reflects_state() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let inv = Address::generate(&env);

    assert!(!c.authorized(&inv), "mặc định phải là chưa KYC");
    c.set_authorized(&inv, &true);
    assert!(c.authorized(&inv), "sau khi whitelist phải là đã KYC");
}

#[test]
fn p4_2_deauthorize_works() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let inv = Address::generate(&env);

    c.set_authorized(&inv, &true);
    c.set_authorized(&inv, &false);
    assert!(!c.authorized(&inv), "gỡ whitelist phải có hiệu lực");
}

// ===========================================================================
//  MINT
// ===========================================================================

#[test]
fn p4_3_mint_to_authorized_holder() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let inv = Address::generate(&env);

    c.set_authorized(&inv, &true);
    c.mint(&inv, &1_000);

    assert_eq!(c.balance(&inv), 1_000);
    assert_eq!(c.total_supply(), 1_000);
}

#[test]
fn p4_4_mint_blocked_when_not_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let inv = Address::generate(&env);

    // Chưa KYC -> phải lỗi HolderNotAuthorized.
    assert!(c.try_mint(&inv, &1_000).is_err());
    assert_eq!(c.total_supply(), 0, "không được tạo token khi chưa KYC");
}

#[test]
fn p4_5_mint_negative_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let inv = Address::generate(&env);

    c.set_authorized(&inv, &true);
    assert!(c.try_mint(&inv, &-1).is_err(), "số âm phải bị từ chối");
}

// ===========================================================================
//  CHUYỂN NHƯỢNG - cả hai đầu phải KYC
// ===========================================================================

#[test]
fn p4_6_transfer_requires_both_sides_authorized() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    c.set_authorized(&a, &true);
    c.mint(&a, &1_000);

    // b chưa KYC -> chuyển phải lỗi.
    assert!(c.try_transfer(&a, &b, &100).is_err());

    c.set_authorized(&b, &true);
    c.transfer(&a, &b, &100);
    assert_eq!(c.balance(&b), 100);
    assert_eq!(c.balance(&a), 900);
}

#[test]
fn p4_7_transfer_more_than_balance_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    c.set_authorized(&a, &true);
    c.set_authorized(&b, &true);
    c.mint(&a, &100);

    assert!(c.try_transfer(&a, &b, &101).is_err(), "vượt số dư phải lỗi");
}

// ===========================================================================
//  THU HỒI CƯỠNG CHẾ (clawback) - quyền của ngân hàng
// ===========================================================================

#[test]
fn p4_8_clawback_reduces_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let inv = Address::generate(&env);

    c.set_authorized(&inv, &true);
    c.mint(&inv, &1_000);
    c.clawback(&inv, &400);

    assert_eq!(c.balance(&inv), 600);
    assert_eq!(c.total_supply(), 600);
}

// ===========================================================================
//  SNAPSHOT - nền cho P7, kiểm ở đây vì thuộc token
// ===========================================================================

#[test]
fn p4_9_snapshot_freezes_balance_at_that_point() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let a = Address::generate(&env);
    let b = Address::generate(&env);

    c.set_authorized(&a, &true);
    c.set_authorized(&b, &true);
    c.mint(&a, &700);
    c.mint(&b, &300);

    let snap = c.snapshot();

    // Chuyển sau khi chốt.
    c.transfer(&a, &b, &700);

    // Số dư hiện tại đã đổi...
    assert_eq!(c.balance(&a), 0);
    assert_eq!(c.balance(&b), 1_000);

    // ...nhưng số dư TẠI SNAPSHOT phải giữ nguyên.
    assert_eq!(c.balance_at(&a, &snap), 700);
    assert_eq!(c.balance_at(&b, &snap), 300);
    assert_eq!(c.total_supply_at(&snap), 1_000);
}

#[test]
fn p4_10_invalid_snapshot_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);
    let a = Address::generate(&env);

    c.set_authorized(&a, &true);
    c.mint(&a, &100);

    // Snapshot chưa tồn tại -> phải lỗi InvalidSnapshot.
    assert!(c.try_balance_at(&a, &999u32).is_err());
}

// ===========================================================================
//  THÔNG TIN TOKEN
// ===========================================================================

#[test]
fn p4_11_token_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _admin) = setup(&env);

    assert_eq!(c.decimals(), 7, "Stellar quy ước decimals 7");
    assert_eq!(
        c.symbol(),
        soroban_sdk::String::from_str(&env, "WPT"),
        "ký hiệu phải là WPT (ký hiệu cũ SPT đã bỏ)"
    );
}

#[test]
fn p4_12_initialize_only_once() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, admin) = setup(&env);

    // Gọi initialize lần hai phải lỗi AlreadyInitialized.
    assert!(c
        .try_initialize(
            &admin,
            &7u32,
            &soroban_sdk::String::from_str(&env, "X"),
            &soroban_sdk::String::from_str(&env, "X"),
        )
        .is_err());
}
