//! SPEC TEST - P7 CHIA LỢI TỨC (Stellar / Soroban)
//!
//! Kiểm acceptance criteria của `.kiro/specs/p7-profit-distribution-stellar/`.
//! Chạy bằng `cargo test` (không cần mạng).
//!
//! Cách bật: thêm vào cuối `src/lib.rs` của crate này:
//! ```ignore
//! #[cfg(test)]
//! mod spec_tests;
//! ```
//!
//! Khác biệt cần nhớ so với bản EVM:
//!   - Doanh thu CHỈ đến từ oracle (không có đường nhập tay amount).
//!   - Kho VNDB nạp bằng cách mint/transfer thẳng vào ĐỊA CHỈ hợp đồng.
//!   - Địa chỉ hợp đồng distributor PHẢI được authorized trên token VNDB.

#![cfg(test)]

use super::*;
use revenue_oracle::{RevenueOracle, RevenueOracleClient};
use soroban_sdk::testutils::Address as _;
use wpt_token::{WptToken, WptTokenClient};

/// Toàn bộ môi trường cho một kỳ chia.
struct Ctx<'a> {
    admin: Address,
    a: Address,
    b: Address,
    wpt: WptTokenClient<'a>,
    vnd: WptTokenClient<'a>,
    orc: RevenueOracleClient<'a>,
    dist: ProfitDistributorPullClient<'a>,
}

/// Dựng: A giữ 700 WPT, B giữ 300 WPT, kho VNDB của distributor = `treasury`.
fn setup(env: &Env, treasury: i128) -> Ctx<'static> {
    let admin = Address::generate(env);

    let wpt_id = env.register(WptToken, ());
    let wpt = WptTokenClient::new(env, &wpt_id);
    wpt.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(env, "Wind Project Token"),
        &soroban_sdk::String::from_str(env, "WPT"),
    );

    let vnd_id = env.register(WptToken, ());
    let vnd = WptTokenClient::new(env, &vnd_id);
    vnd.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(env, "Tokenized VND"),
        &soroban_sdk::String::from_str(env, "VNDB"),
    );

    let orc_id = env.register(RevenueOracle, ());
    let orc = RevenueOracleClient::new(env, &orc_id);
    orc.initialize(&admin, &admin); // reporter = admin cho gọn khi test

    let dist_id = env.register(ProfitDistributorPull, ());
    let dist = ProfitDistributorPullClient::new(env, &dist_id);
    dist.initialize(&admin, &wpt_id, &vnd_id, &orc_id);

    let a = Address::generate(env);
    let b = Address::generate(env);

    // Bước wiring bắt buộc: authorize CẢ địa chỉ hợp đồng, không chỉ nhà đầu tư.
    for who in [&a, &b, &dist_id] {
        wpt.set_authorized(who, &true);
        vnd.set_authorized(who, &true);
    }

    wpt.mint(&a, &700);
    wpt.mint(&b, &300);
    if treasury > 0 {
        vnd.mint(&dist_id, &treasury);
    }

    Ctx { admin, a, b, wpt, vnd, orc, dist }
}

// ===========================================================================
//  ORACLE DOANH THU
// ===========================================================================

#[test]
fn p7_1_report_then_finalize_locks_revenue() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    assert!(!c.orc.is_finalized(&1u32), "chưa finalize thì chưa khóa");

    c.orc.finalize(&1u32);
    assert!(c.orc.is_finalized(&1u32));
    assert_eq!(c.orc.get(&1u32), Some(1_000_000));
}

#[test]
fn p7_2_report_after_finalize_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);

    // Số liệu đã khóa, không được sửa.
    assert!(c.orc.try_report(&1u32, &2_000_000).is_err());
}

#[test]
fn p7_3_finalize_without_report_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    // Chưa report -> NotReported.
    assert!(c.orc.try_finalize(&7u32).is_err());
}

// ===========================================================================
//  MỞ KỲ CHIA
// ===========================================================================

#[test]
fn p7_4_open_period_snapshots_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    let info = c.dist.open_period(&1u32);

    assert_eq!(info.total_revenue, 1_000_000);
    assert_eq!(info.total_supply, 1_000, "700 + 300");
    assert_eq!(info.claimed_total, 0);
}

#[test]
fn p7_5_open_period_requires_finalized_revenue() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000); // chưa finalize
    assert!(
        c.dist.try_open_period(&1u32).is_err(),
        "phải lỗi RevenueNotFinalized"
    );
}

#[test]
fn p7_6_open_period_twice_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    assert!(
        c.dist.try_open_period(&1u32).is_err(),
        "phải lỗi PeriodAlreadyOpen"
    );
}

#[test]
fn p7_7_open_period_with_zero_supply_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    // Dựng riêng: KHÔNG mint WPT cho ai.
    let wpt_id = env.register(WptToken, ());
    let wpt = WptTokenClient::new(&env, &wpt_id);
    wpt.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(&env, "WPT"),
        &soroban_sdk::String::from_str(&env, "WPT"),
    );
    let vnd_id = env.register(WptToken, ());
    let vnd = WptTokenClient::new(&env, &vnd_id);
    vnd.initialize(
        &admin,
        &7u32,
        &soroban_sdk::String::from_str(&env, "VNDB"),
        &soroban_sdk::String::from_str(&env, "VNDB"),
    );
    let orc_id = env.register(RevenueOracle, ());
    let orc = RevenueOracleClient::new(&env, &orc_id);
    orc.initialize(&admin, &admin);
    let dist_id = env.register(ProfitDistributorPull, ());
    let dist = ProfitDistributorPullClient::new(&env, &dist_id);
    dist.initialize(&admin, &wpt_id, &vnd_id, &orc_id);

    orc.report(&1u32, &1_000_000);
    orc.finalize(&1u32);

    assert!(dist.try_open_period(&1u32).is_err(), "phải lỗi ZeroSupply");
}

// ===========================================================================
//  TÍNH VÀ NHẬN PHẦN CHIA (theo snapshot)
// ===========================================================================

#[test]
fn p7_8_share_follows_snapshot_not_current_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    // A bán toàn bộ cho B SAU khi chốt kỳ.
    c.wpt.transfer(&c.a, &c.b, &700);
    assert_eq!(c.wpt.balance(&c.a), 0);

    // Phần chia KHÔNG đổi vì dùng balance_at.
    assert_eq!(c.dist.preview_claim(&1u32, &c.a), 700_000);
    assert_eq!(c.dist.preview_claim(&1u32, &c.b), 300_000);
}

#[test]
fn p7_9_claim_pays_correct_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    assert_eq!(c.dist.claim(&1u32, &c.a), 700_000);
    assert_eq!(c.dist.claim(&1u32, &c.b), 300_000);

    assert_eq!(c.vnd.balance(&c.a), 700_000);
    assert_eq!(c.vnd.balance(&c.b), 300_000);
}

#[test]
fn p7_10_double_claim_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);
    c.dist.claim(&1u32, &c.a);

    assert!(
        c.dist.try_claim(&1u32, &c.a).is_err(),
        "phải lỗi AlreadyClaimed"
    );
    assert!(c.dist.has_claimed(&1u32, &c.a));
    assert_eq!(c.vnd.balance(&c.a), 700_000, "không trả thêm lần hai");
}

#[test]
fn p7_11_claim_on_unopened_period_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    assert!(
        c.dist.try_claim(&9u32, &c.a).is_err(),
        "phải lỗi PeriodNotOpen"
    );
}

#[test]
fn p7_12_insufficient_treasury_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    // Kho VNDB chỉ 1.000, không đủ trả 700.000 cho A.
    let c = setup(&env, 1_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    assert!(
        c.dist.try_claim(&1u32, &c.a).is_err(),
        "phải lỗi InsufficientTreasury"
    );
    assert!(
        !c.dist.has_claimed(&1u32, &c.a),
        "thất bại thì KHÔNG được đánh dấu đã nhận"
    );
}

#[test]
fn p7_13_non_holder_gets_nothing() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);
    let outsider = Address::generate(&env);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    assert_eq!(c.dist.preview_claim(&1u32, &outsider), 0);
}

#[test]
fn p7_14_period_info_readable() {
    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    assert!(c.dist.period_info(&1u32).is_none(), "chưa mở thì rỗng");

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    let info = c.dist.period_info(&1u32).unwrap();
    assert_eq!(info.total_supply, 1_000);
    let _ = c.admin; // giữ field admin được dùng, tránh cảnh báo dead_code
}

// ===========================================================================
//  TTL / STATE ARCHIVAL - loại test bản EVM KHÔNG cần
// ===========================================================================

#[test]
fn p7_15_period_survives_long_gap_between_open_and_claim() {
    use soroban_sdk::testutils::Ledger as _;

    let env = Env::default();
    env.mock_all_auths();
    let c = setup(&env, 1_000_000);

    c.orc.report(&1u32, &1_000_000);
    c.orc.finalize(&1u32);
    c.dist.open_period(&1u32);

    // Tua ledger ~60 ngày (1 ledger ≈ 5 giây => 17.280 ledger/ngày).
    // Kỳ chia lợi tức điện gió kéo dài hàng quý, nên dữ liệu kỳ PHẢI còn đọc được.
    env.ledger().with_mut(|l| {
        l.sequence_number += 60 * 17_280;
    });

    assert_eq!(
        c.dist.claim(&1u32, &c.a),
        700_000,
        "dữ liệu kỳ bị lưu trữ giữa chừng: cần tăng ngưỡng extend_ttl"
    );
}
