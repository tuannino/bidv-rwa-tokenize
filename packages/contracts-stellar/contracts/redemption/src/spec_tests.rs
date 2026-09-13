//! SPEC TEST - P12 TẤT TOÁN / HOÀN VỐN (Stellar / Soroban)
//!
//! Kiểm acceptance criteria của `.kiro/specs/p12-redemption-stellar/`.
//! Chạy bằng `cargo test` (không cần mạng).
//!
//! Cách bật: thêm vào cuối `src/lib.rs` của crate này:
//! ```ignore
//! #[cfg(test)]
//! mod spec_tests;
//! ```
//!
//! Khác biệt cần nhớ so với bản EVM:
//!   - KHÔNG cần approve trước khi redeem (Soroban burn chính chủ, không dùng
//!     allowance). Chữ ký của nhà đầu tư phủ luôn lời gọi con `wpt.burn`.
//!   - Kho VNDB nạp bằng mint/transfer thẳng vào ĐỊA CHỈ hợp đồng.
//!   - Tỷ giá có thang SCALE = 1e7: preview = wpt * rate / SCALE.

#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use spt_token::{SptToken, SptTokenClient};

/// 1 WPT đổi 10.000 VNDB (đơn vị nhỏ nhất).
const RATE_PER_WPT: i128 = 10_000;

struct Ctx<'a> {
    admin: Address,
    inv: Address,
    wpt: SptTokenClient<'a>,
    vnd: SptTokenClient<'a>,
    red: RedemptionClient<'a>,
    red_id: Address,
}

/// Dựng: nhà đầu tư giữ `wpt_amount` WPT, kho VNDB của hợp đồng = `treasury`.
fn setup(env: &Env, wpt_amount: i128, treasury: i128) -> Ctx<'static> {
    let admin = Address::generate(env);
    let inv = Address::generate(env);

    let wpt_id = env.register(SptToken, ());
    let wpt = SptTokenClient::new(env, &wpt_id);
    wpt.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(env, "Wind Project Token"),
        &soroban_sdk::String::from_str(env, "WPT"),
    );

    let vnd_id = env.register(SptToken, ());
    let vnd = SptTokenClient::new(env, &vnd_id);
    vnd.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(env, "Tokenized VND"),
        &soroban_sdk::String::from_str(env, "VNDB"),
    );

    let red_id = env.register(Redemption, ());
    let red = RedemptionClient::new(env, &red_id);
    red.initialize(&admin, &wpt_id, &vnd_id, &(RATE_PER_WPT * SCALE));

    // Wiring: authorize cả nhà đầu tư VÀ địa chỉ hợp đồng trên hai token.
    for who in [&inv, &red_id] {
        wpt.set_authorized(who, &true);
        vnd.set_authorized(who, &true);
    }

    if wpt_amount > 0 {
        wpt.mint(&inv, &wpt_amount);
    }
    if treasury > 0 {
        vnd.mint(&red_id, &treasury);
    }

    Ctx { admin, inv, wpt, vnd, red, red_id }
}

// ===========================================================================
//  CẤU HÌNH CỦA NGÂN HÀNG
// ===========================================================================

#[test]
fn p12_1_rate_readable_and_updatable() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    assert_eq!(c.red.rate(), RATE_PER_WPT * SCALE);

    c.red.set_rate(&(12_000i128 * SCALE));
    assert_eq!(c.red.rate(), 12_000i128 * SCALE);
    let _ = &c.admin;
}

#[test]
fn p12_2_negative_rate_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    assert!(c.red.try_set_rate(&-1).is_err(), "tỷ giá âm phải bị từ chối");
}

#[test]
fn p12_3_preview_uses_scale() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    // 100 WPT * 10.000 = 1.000.000 VNDB
    assert_eq!(c.red.preview(&100), 1_000_000);
}

// ===========================================================================
//  LUỒNG TẤT TOÁN THÀNH CÔNG
// ===========================================================================

#[test]
fn p12_4_redeem_burns_wpt_and_pays_vndb() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    let out = c.red.redeem(&c.inv, &100);

    assert_eq!(out, 1_000_000);
    assert_eq!(c.wpt.balance(&c.inv), 0, "WPT phải bị đốt hết");
    assert_eq!(c.wpt.total_supply(), 0, "tổng cung phải giảm");
    assert_eq!(c.vnd.balance(&c.inv), 1_000_000);
}

#[test]
fn p12_5_partial_redeem_keeps_remainder() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    let out = c.red.redeem(&c.inv, &40);

    assert_eq!(out, 400_000);
    assert_eq!(c.wpt.balance(&c.inv), 60);
    assert_eq!(c.wpt.total_supply(), 60);
}

#[test]
fn p12_6_treasury_decreases_by_paid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    c.red.redeem(&c.inv, &50);

    assert_eq!(c.vnd.balance(&c.red_id), 2_000_000 - 500_000);
}

#[test]
fn p12_7_no_approve_needed_unlike_evm() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    // Bản EVM đòi approve WPT cho hợp đồng trước (vì dùng burnFrom).
    // Bản Soroban KHÔNG cần: burn là chính chủ, chữ ký nhà đầu tư phủ lời gọi con.
    assert_eq!(
        c.wpt.allowance(&c.inv, &c.red_id),
        0,
        "cố ý không approve"
    );

    // Vẫn phải tất toán được.
    assert_eq!(c.red.redeem(&c.inv, &100), 1_000_000);
    assert_eq!(c.wpt.balance(&c.inv), 0);
}

// ===========================================================================
//  CÁC CA BỊ CHẶN
// ===========================================================================

#[test]
fn p12_8_paused_blocks_redeem() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    c.red.set_paused(&true);

    assert!(c.red.try_redeem(&c.inv, &100).is_err(), "phải lỗi Paused");
    assert_eq!(c.wpt.balance(&c.inv), 100, "không được đốt WPT khi bị chặn");
}

#[test]
fn p12_9_unpause_restores_redeem() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    c.red.set_paused(&true);
    c.red.set_paused(&false);

    assert_eq!(c.red.redeem(&c.inv, &100), 1_000_000);
}

#[test]
fn p12_10_negative_amount_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    assert!(c.red.try_redeem(&c.inv, &-1).is_err());
}

#[test]
fn p12_11_insufficient_treasury_rejected_without_burning() {
    let env = Env::default();
    env.mock_all_auths();
    // Kho chỉ 1.000 VNDB, cần 1.000.000 -> phải từ chối.
    let c = setup(&env, 100, 1_000);

    assert!(
        c.red.try_redeem(&c.inv, &100).is_err(),
        "phải lỗi InsufficientTreasury"
    );
    assert_eq!(
        c.wpt.balance(&c.inv),
        100,
        "thất bại thì WPT KHÔNG được đốt"
    );
    assert_eq!(c.wpt.total_supply(), 100);
}

#[test]
fn p12_12_redeem_more_than_balance_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    assert!(
        c.red.try_redeem(&c.inv, &101).is_err(),
        "vượt số dư WPT phải lỗi"
    );
}

#[test]
fn p12_13_initialize_only_once() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 100, 2_000_000);

    assert!(c
        .red
        .try_initialize(&c.admin, &c.red_id, &c.red_id, &1)
        .is_err());
}
