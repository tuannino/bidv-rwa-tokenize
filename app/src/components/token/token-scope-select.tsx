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
