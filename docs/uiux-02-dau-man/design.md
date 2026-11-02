# UIUX-02: thiết kế

## 1. `TokenScopeSelect`

`app/src/components/token/token-scope-select.tsx`. Supervisor đã dựng thử bản dưới đây trên `dev` @ `67ece1e` (typecheck, lint sạch) và:

- thử `tokenScopeReducer` bằng vitest: gõ `WPT`, `wpt` chỉ còn WPT; mũi tên xuống từ trạng thái đóng; dòng TCC không chọn được; khoá khi đang mở; `tokens` thành rỗng; `value` đổi từ ngoài;
- thao tác thật trong Chromium (máy tính và khung 390 px): bấm, gõ `WPT`, `wp` rồi Enter, gõ `tc` rồi bấm TCC, `zz`, Esc, `t` rồi mũi tên xuống, Enter, bấm ra ngoài, khoá khi đang mở, chuyển sang danh sách rỗng.

Dev dùng bản này làm gốc; đổi gì thì ghi lý do vào checkpoint.

```tsx
'use client';

import { useId, useReducer, type KeyboardEvent } from 'react';
import { WPT_TOKEN_SYMBOL } from '@/lib/config/issue-terms';
import { cn } from '@/lib/utils';

/**
 * UIUX-02: ô chọn token có gõ lọc ở đầu màn nghiệp vụ. CHỈ là giao diện: chưa nối dữ liệu, chưa
 * gửi mã token lên action (nợ MT-05, bỏ chọn dự án ngầm; xem docs/20261102_NO_KY_THUAT_DA_TOKEN.md).
 * Mọi chuyển trạng thái nằm trong hàm thuần `tokenScopeReducer` để kiểm được không cần DOM.
 */
export interface TokenScopeToken {
  tokenSymbol: string;
  projectName?: string;
}

export interface TokenScopeOption {
  tokenSymbol: string;
  /** Tên dự án hoặc tên loại token, dùng để hiển thị và để lọc. */
  name?: string;
  /** Có thì dòng bị khoá, hiện thẻ chữ mờ này. */
  unsupportedTag?: string;
}

/** Loại token đã có trong định hướng nhưng chưa hỗ trợ: luôn hiện, luôn khoá (tới MT-07, thực thể loại token). */
const UNSUPPORTED: TokenScopeOption = {
  tokenSymbol: 'TCC',
  name: 'Tokenized Carbon Credit',
  unsupportedTag: '(chưa hỗ trợ)',
};

const DEFAULT_TOKENS: readonly TokenScopeToken[] = [{ tokenSymbol: WPT_TOKEN_SYMBOL }];

/** Danh sách sau khi lọc (QĐ-2b): không phân biệt hoa thường; mã bắt đầu bằng truy vấn, rồi mã chứa, rồi tên chứa. */
export function tokenScopeOptions(tokens: readonly TokenScopeToken[], query: string): TokenScopeOption[] {
  const all: TokenScopeOption[] = [
    ...tokens.map((t) => ({ tokenSymbol: t.tokenSymbol, name: t.projectName })),
    UNSUPPORTED,
  ];
  const q = query.trim().toLowerCase();
  if (q === '') return all;
  const rank = (o: TokenScopeOption) => {
    const symbol = o.tokenSymbol.toLowerCase();
    if (symbol.startsWith(q)) return 0;
    if (symbol.includes(q)) return 1;
    if (o.name?.toLowerCase().includes(q)) return 2;
    return -1;
  };
  return all
    .map((o, index) => ({ o, index, r: rank(o) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.index - b.index)
    .map((x) => x.o);
}

export interface TokenScopeProps {
  tokens: readonly TokenScopeToken[];
  value: string | undefined;
  disabled: boolean;
}

export interface TokenScopeState extends TokenScopeProps {
  selected: string;
  /** Chữ trong ô. */
  text: string;
  /** Chữ người dùng ĐÃ GÕ; `null` khi vừa mở hoặc đã đóng: hiện đủ danh sách. */
  query: string | null;
  open: boolean;
  /** Chỉ số dòng đang trỏ trong danh sách đã lọc, -1 là chưa trỏ. */
  active: number;
}

export type TokenScopeAction =
  | ({ type: 'sync' } & TokenScopeProps)
  | { type: 'open' }
  | { type: 'type'; text: string }
  | { type: 'move'; step: 1 | -1 }
  | { type: 'choose'; index?: number }
  | { type: 'close' };

const keyOf = (tokens: readonly TokenScopeToken[]) => tokens.map((t) => t.tokenSymbol).join(',');

export function initTokenScope(props: TokenScopeProps): TokenScopeState {
  const selected = props.value ?? props.tokens[0]?.tokenSymbol ?? '';
  return { ...props, selected, text: selected, query: null, open: false, active: -1 };
}

export function scopeOptions(state: TokenScopeState): TokenScopeOption[] {
  return tokenScopeOptions(state.tokens, state.query ?? '');
}

const isSelectable = (options: TokenScopeOption[], i: number) =>
  i >= 0 && i < options.length && !options[i].unsupportedTag;

const closed = (state: TokenScopeState): TokenScopeState => ({
  ...state,
  open: false,
  active: -1,
  query: null,
  text: state.selected,
});

/**
 * Chuyển trạng thái (requirements QĐ-2c, QĐ-3c). Bị khoá thì mọi thao tác người dùng không làm gì;
 * props đổi từ bên ngoài thì đóng danh sách và chọn lại theo `value`, hoặc giữ token đang chọn nếu
 * còn trong danh sách, hoặc token đầu tiên, hoặc rỗng.
 */
export function tokenScopeReducer(state: TokenScopeState, action: TokenScopeAction): TokenScopeState {
  if (action.type === 'sync') {
    const listChanged = keyOf(action.tokens) !== keyOf(state.tokens);
    if (!listChanged && action.value === state.value && action.disabled === state.disabled) return state;
    const stillThere = action.tokens.some((t) => t.tokenSymbol === state.selected);
    const selected =
      action.value !== undefined && action.value !== state.value
        ? action.value
        : stillThere
          ? state.selected
          : (action.value ?? action.tokens[0]?.tokenSymbol ?? '');
    return closed({ ...state, tokens: action.tokens, value: action.value, disabled: action.disabled, selected });
  }
  if (state.disabled) return state;
  const options = scopeOptions(state);
  switch (action.type) {
    case 'open':
      return { ...state, open: true, query: null, active: -1 };
    case 'type':
      return { ...state, open: true, text: action.text, query: action.text, active: -1 };
    case 'move': {
      for (let i = state.active + action.step; i >= 0 && i < options.length; i += action.step) {
        if (isSelectable(options, i)) return { ...state, open: true, active: i };
      }
      return { ...state, open: true };
    }
    case 'choose': {
      if (!state.open) return state;
      const i =
        action.index ?? (state.active >= 0 ? state.active : options.findIndex((_, k) => isSelectable(options, k)));
      if (!isSelectable(options, i)) return state;
      return closed({ ...state, selected: options[i].tokenSymbol });
    }
    case 'close':
      return closed(state);
  }
}

export function TokenScopeSelect({
  id,
  tokens = DEFAULT_TOKENS,
  value,
  disabled = false,
  ariaLabel,
  className,
}: {
  id: string;
  tokens?: readonly TokenScopeToken[];
  value?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const listId = useId();
  const [state, dispatch] = useReducer(tokenScopeReducer, { tokens, value, disabled }, initTokenScope);
  // Props đổi từ bên ngoài: đồng bộ ngay trong lần dựng này (không dùng effect, tránh một khung hình lệch).
  if (keyOf(tokens) !== keyOf(state.tokens) || value !== state.value || disabled !== state.disabled) {
    dispatch({ type: 'sync', tokens, value, disabled });
  }
  const options = scopeOptions(state);
  const open = state.open && !disabled;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      dispatch({ type: 'move', step: event.key === 'ArrowDown' ? 1 : -1 });
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      dispatch({ type: 'choose' });
    } else if (event.key === 'Escape') {
      dispatch({ type: 'close' });
    }
  };

  return (
    <div className={cn('relative space-y-1 text-sm', className)}>
      <label htmlFor={id} className="block text-muted-foreground">
        Token
      </label>
      <input
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && state.active >= 0 ? `${listId}-${state.active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={tokens.length === 0 ? 'Chưa có token' : undefined}
        value={state.text}
        onChange={(event) => dispatch({ type: 'type', text: event.target.value })}
        // Chọn sẵn toàn bộ chữ khi vào ô hoặc bấm vào ô: gõ là thay, không nối vào token đang hiện.
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => {
          event.currentTarget.select();
          dispatch({ type: 'open' });
        }}
        onBlur={() => dispatch({ type: 'close' })}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {options.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled="true" className="px-3 py-2 text-muted-foreground">
              Không có token khớp
            </li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.tokenSymbol}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.tokenSymbol === state.selected}
                aria-disabled={o.unsupportedTag ? 'true' : undefined}
                title={o.unsupportedTag ? `${o.name}, chưa hỗ trợ trong PoC` : o.name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => dispatch({ type: 'choose', index: i })}
                className={cn(
                  'flex items-center gap-2 px-3 py-2',
                  o.unsupportedTag ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted',
                  i === state.active && 'bg-muted',
                )}
              >
                <span className="font-medium">{o.tokenSymbol}</span>
                {o.name && !o.unsupportedTag && <span className="truncate text-muted-foreground">{o.name}</span>}
                {o.unsupportedTag && <span className="text-muted-foreground">{o.unsupportedTag}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

Ghi chú:

- Đồng bộ props: so props với bản đang giữ trong trạng thái ngay lúc dựng và `dispatch({ type: 'sync' })` (mẫu "chỉnh trạng thái khi props đổi" của React, không dùng effect nên không có khung hình lệch). Danh sách token so theo chuỗi mã, không theo tham chiếu mảng.
- Lớp ô nhập theo lớp ô `select` cũ ở màn Giao dịch token (`FIELD`, `investor-trade.tsx:482-483`, bỏ phần `aria-invalid`). `FIELD` vẫn còn dùng ở dòng 340, 358 nên giữ.
- Dòng khoá dùng `aria-disabled`; Playwright coi dòng đó là không bấm được, nên e2e bấm thử bằng `click({ force: true })`. Gõ trong e2e bằng `page.keyboard.type`, không dùng `fill` (`fill` cùng giá trị không phát sự kiện thay đổi).
- Danh sách nổi (`absolute`, `z-20`) đè lên nội dung bên dưới, không đẩy bố cục.

## 2. Gắn vào màn

Mẫu chung (ngay sau phần tử `header` hoặc khối ngoài cùng chứa `h1`, theo QĐ-6; ví dụ `seller-overview.tsx`: sau thẻ `</header>` dòng 143, KHÔNG đặt vào trong `header` dạng flex):

```tsx
<TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
```

Màn Giao dịch token (ngoại lệ QĐ-6: thay tại chỗ khối `label` dòng 306-315 trong thẻ "Đặt lệnh"):

```tsx
<TokenScopeSelect
  id="token-scope"
  ariaLabel="Token"
  tokens={ctx.tokens}
  value={ctx.token?.tokenSymbol}
  disabled={tradeBlocked}
/>
```

`ctx.tokens` đã có dạng `{ tokenSymbol, projectName }` (`trade.service.ts:78`), không đổi kiểu.

## 3. Không làm

- Không đổi dữ liệu theo lựa chọn, không đọc hay ghi URL, `localStorage`, cookie, không lưu lựa chọn.
- Không sửa `lib/config/issue-terms.ts`; chỉ import hằng `WPT_TOKEN_SYMBOL`.
- Không thêm hằng TCC vào `lib/`; giữ trong component cho tới MT-07 (thực thể loại token).

## 4. `HoverHint`

`app/src/components/layout/hover-hint.tsx`, dựng trên `components/ui/tooltip.tsx` có sẵn (không cần `TooltipProvider`: độ trễ lấy từ `delay` của `TooltipTrigger`). Supervisor đã dựng thử trên `dev` @ `67ece1e` (typecheck, lint sạch) và thao tác trong Chromium: sau 1 giây chưa hiện, sau 3,5 giây hiện bên phải vùng menu có `overflow-y-auto` mà không bị cắt; rời chuột thì ẩn, đưa chuột vào bong bóng cũng ẩn; tên liên kết và tên tiêu đề không đổi; `aria-describedby` có ngay khi tải.

```tsx
'use client';

import { cloneElement, useId, type ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * UIUX-02: gợi ý hiện sau khi dừng chuột 3 giây, dựng trên `components/ui/tooltip` có sẵn (Base UI,
 * bong bóng nằm trong portal nên vùng cuộn của thanh bên không cắt). Câu gợi ý gắn vào chính phần
 * tử con qua `aria-describedby`, nên trình đọc màn hình đọc ngay, không phải chờ bong bóng; câu nằm
 * NGOÀI phần tử con nên không làm đổi tên của liên kết hay tiêu đề.
 */
const DELAY_MS = 3000;

export function HoverHint({
  hint,
  side = 'right',
  children,
}: {
  hint: string;
  side?: 'right' | 'bottom';
  children: ReactElement<{ 'aria-describedby'?: string }>;
}) {
  const hintId = useId();
  return (
    // Không cho giữ bong bóng mở bằng cách rê chuột vào nó: rời phần tử là ẩn.
    <Tooltip disableHoverablePopup>
      <TooltipTrigger delay={DELAY_MS} render={<div />}>
        {cloneElement(children, { 'aria-describedby': hintId })}
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} aria-hidden="true">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
```

Gắn vào mục menu, trong `NavLink` của `sidebar.tsx`, CHỈ nhánh `Link` (nhánh `disabled` dạng `div` giữ nguyên, không bọc):

```tsx
return (
  <HoverHint hint={item.hint}>
    <Link /* giữ nguyên mọi thuộc tính hiện có */>{body}</Link>
  </HoverHint>
);
```

Gắn vào tiêu đề màn ngoài menu (bọc `h1`, giữ nguyên lớp của `h1`):

```tsx
<HoverHint hint="Xem lịch sử mọi thao tác và lần kiểm quyền trong hệ thống." side="bottom">
  <h1 className="text-xl font-semibold">Sổ kiểm toán</h1>
</HoverHint>
```

Bong bóng là `[data-slot="tooltip-content"]`; Base UI không gắn `role` cho bong bóng tooltip, nên e2e định vị theo thuộc tính này.

## 5. Gắn `data-chain` (QĐ-11)

Phần tử ngoài cùng do component màn trả về thêm `data-chain={chain}`, ví dụ `<div className="space-y-6" data-chain={chain}>`, ở đúng 4 màn `draft.tsx`, `ops-transactions.tsx`, `approvals.tsx`, `seller-overview.tsx`. Biến `chain` đã có sẵn trong các màn này.

## 6. Câu mở đầu của dòng mô tả cũ (ca 8, quét theo TỪNG tệp)

| Tệp | Câu không được còn trong tệp |
|---|---|
| `components/pages/account-info.tsx` | Thông tin hồ sơ của tài |
| `components/pages/approvals.tsx` | Xem yêu cầu Giao dịch viên |
| `components/pages/assets.tsx` | Mỗi dự án phát hành WPT |
| `components/pages/dashboard.tsx` | Token hoá quyền hưởng lợi tức |
| `components/pages/distribution-approval.tsx` | Kiểm soát viên duyệt tổng số VNDB của kỳ trên chain |
| `components/pages/draft.tsx` | Lập yêu cầu tạo hoặc huỷ |
| `components/pages/investor-orders.tsx` | Lệnh mua và bán của ví |
| `components/pages/investor-portfolio.tsx` | Vị thế WPT của ví đang |
| `components/pages/investor-trade.tsx` | Mua token từ người bán theo giá phát hành |
| `components/pages/investor-withdraw.tsx` | Chuyển VNDB từ ví đã định |
| `components/pages/kyc.tsx` | Duyệt KYC, whitelist ví để được |
| `components/pages/mint.tsx` | KYC (mock auto-approve) |
| `components/pages/ops-transactions.tsx` | Mọi lệnh mua và bán tự |
| `components/pages/price-config.tsx` | Giá phát hành WPT áp dụng |
| `components/pages/recall.tsx` | Thanh toán thực hiện ngoài hệ thống |
| `components/pages/reconciliation.tsx` | So khớp sản lượng SCADA |
| `components/pages/seller-overview.tsx` | Tình hình bán token, nguồn cung |
| `components/pages/seller-transactions.tsx` | Lệnh mua bán token của nhà |
| `components/pages/seller-withdraw.tsx` | về ví nhận bạn chọn |
| `components/pages/vault-status.tsx` | Trạng thái giữ WPT, VNDB và |
| `components/pages/wallet-binding.tsx` | Ngân hàng định danh ví trên |
| `components/pages/wallet-connect.tsx` | Kết nối ví tự quản để xem vị thế |
| `app/(ops)/audit/page.tsx` | Mọi lần kiểm quyền và mọi |

Câu trong `distribution-approval.tsx:50` (lời trong hộp xác nhận duyệt chia, e2e đang kiểm) KHÔNG thuộc dòng mô tả, giữ nguyên; câu quét ở trên đã chọn để không trùng với nó.
