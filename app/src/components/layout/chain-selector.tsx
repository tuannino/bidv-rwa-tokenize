'use client';

import { Link2 } from 'lucide-react';
import { isChainKey } from '@bidv/shared';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';

/**
 * Dropdown chọn chain: mock (mặc định) · hardhat-local · evm · stellar. **KHÔNG Polygon**.
 *
 * Dùng `<select>` gốc: nhận bàn phím/screen-reader đúng chuẩn sẵn, và `disabled`
 * trên `<option>` diễn đạt được "chain có nhưng chưa dùng được" mà vẫn cho người xem thấy.
 */
export function ChainSelector({
  collapsed = false,
  onExpand,
}: {
  /** FE-UX-01b: thanh bên thu gọn thì chỉ còn nút biểu tượng; `select` vẫn trong DOM (`sr-only`). */
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const config = usePublicConfig();
  const { chain, setChain } = useSelectedChain();

  const active = config.chains.find((option) => option.key === chain);

  return (
    <div>
      {collapsed && (
        <button
          type="button"
          title={active?.label ?? chain}
          aria-label={`Chain: ${active?.label ?? chain}. Mở rộng thanh bên để đổi`}
          onClick={onExpand}
          className="mx-auto flex size-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground hover:bg-muted"
        >
          <Link2 className="size-4" aria-hidden="true" />
        </button>
      )}
      <div className={collapsed ? "sr-only" : "space-y-1"}>
        <label
          htmlFor="chain-selector"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Chain</span>
        </label>

        <select
          id="chain-selector"
          value={chain}
          onChange={(event) => {
            const next = event.target.value;
            if (isChainKey(next)) setChain(next);
          }}
          title={active?.hint}
          className="h-9 w-full rounded-full border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {config.chains.map((option) => (
            <option key={option.key} value={option.key} disabled={!option.selectable}>
              {option.label}
              {option.selectable ? '' : ': chưa dùng được'}
            </option>
          ))}
        </select>

        {active?.disabledReason && (
          <span className="block text-xs text-bad-ink" role="status">
            {active.disabledReason}
          </span>
        )}
      </div>
    </div>
  );
}
