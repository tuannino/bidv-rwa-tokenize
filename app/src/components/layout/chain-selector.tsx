'use client';

import { Link2 } from 'lucide-react';
import { isChainKey } from '@bidv/shared';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';

/**
 * Dropdown chọn chain: hardhat-local (mặc định) · mock · evm · stellar. **KHÔNG Polygon**.
 *
 * Dùng `<select>` gốc: nhận bàn phím/screen-reader đúng chuẩn sẵn, và `disabled`
 * trên `<option>` diễn đạt được "chain có nhưng chưa dùng được" mà vẫn cho người xem thấy.
 */
export function ChainSelector() {
  const config = usePublicConfig();
  const { chain, setChain } = useSelectedChain();

  const active = config.chains.find((option) => option.key === chain);

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="chain-selector"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Chain</span>
      </label>

      <select
        id="chain-selector"
        value={chain}
        onChange={(event) => {
          const next = event.target.value;
          if (isChainKey(next)) setChain(next);
        }}
        title={active?.hint}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {config.chains.map((option) => (
          <option key={option.key} value={option.key} disabled={!option.selectable}>
            {option.label}
            {option.selectable ? '' : ' — chưa dùng được'}
          </option>
        ))}
      </select>

      {active?.disabledReason && (
        <span className="text-xs text-destructive" role="status">
          {active.disabledReason}
        </span>
      )}
    </div>
  );
}
