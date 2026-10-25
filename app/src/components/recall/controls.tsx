'use client';

import { Button } from '@/components/ui/button';
import type { RecallControls as RecallControlState } from './gates';

export type RecallStage = 'idle' | 'open' | 'reschedule' | 'cancel' | 'freeze' | 'unfreeze' | 'first-recall';

export function RecallControls({
  state,
  busy,
  onStage,
  onRecheckFreeze,
  onRecheckUnfreeze,
  onRecall,
}: {
  state: RecallControlState;
  busy: boolean;
  onStage: (stage: RecallStage) => void;
  onRecheckFreeze: () => void;
  onRecheckUnfreeze: () => void;
  onRecall: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {state.open && <Button disabled={busy} onClick={() => onStage('open')}>Mở đợt thu hồi</Button>}
        {state.reschedule && <Button variant="outline" disabled={busy} onClick={() => onStage('reschedule')}>Sửa mốc</Button>}
        {state.cancel && <Button variant="outline" disabled={busy} onClick={() => onStage('cancel')}>Huỷ đợt</Button>}
        {state.freeze === 'send' && <Button disabled={busy} onClick={() => onStage('freeze')}>Đóng băng trên toàn hệ thống</Button>}
        {state.freeze === 'recheck' && <><span className="text-sm text-muted-foreground">Đang chờ xác nhận đóng băng</span><Button disabled={busy} onClick={onRecheckFreeze}>Kiểm tra lại</Button></>}
        {state.unfreeze === 'send' && <Button variant="outline" disabled={busy} onClick={() => onStage('unfreeze')}>Mở đóng băng trên toàn hệ thống</Button>}
        {state.unfreeze === 'recheck' && <><span className="text-sm text-muted-foreground">Đang chờ xác nhận mở đóng băng</span><Button variant="outline" disabled={busy} onClick={onRecheckUnfreeze}>Kiểm tra lại</Button></>}
        {state.recall.mode === 'first' && <Button variant="destructive" disabled={busy} onClick={() => onStage('first-recall')}>{busy ? 'Đang thu hồi lô (tối đa 10 ví)...' : 'Thu hồi toàn bộ'}</Button>}
        {state.recall.mode === 'next' && <Button variant="destructive" disabled={busy} onClick={onRecall}>{busy ? 'Đang thu hồi lô (tối đa 10 ví)...' : 'Thu hồi lô tiếp theo'}</Button>}
      </div>
      {(state.freeze === 'recheck' || state.unfreeze === 'recheck') && <p className="text-xs text-muted-foreground">Quá 10 phút chưa có xác nhận, hệ thống sẽ gửi lại lệnh. Gửi lại không gây hại.</p>}
      {state.openBlockedReason && <p className="text-sm text-muted-foreground">{state.openBlockedReason}</p>}
      {state.unfreeze === 'locked-after-burn' && <p className="text-sm text-muted-foreground">Đã bắt đầu thu hồi, không mở đóng băng được nữa.</p>}
      {state.recall.blockedReason && <p className="text-sm text-muted-foreground">{state.recall.blockedReason}</p>}
    </div>
  );
}
