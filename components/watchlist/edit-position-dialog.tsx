import React, { useEffect, useState } from 'react';

import type { PositionInput } from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

interface EditPositionDialogProps {
  fund: WatchlistFund | null;
  onClose: () => void;
  onSave: (code: string, position: PositionInput) => void;
}

export function EditPositionDialog({ fund, onClose, onSave }: EditPositionDialogProps) {
  const [cost, setCost] = useState('');
  const [shares, setShares] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    setCost(fund?.position?.cost?.toString() ?? '');
    setShares(fund?.position?.shares?.toString() ?? '');
    setAmount(fund?.position?.amount?.toString() ?? '');
  }, [fund]);

  if (!fund) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSave(fund.code, {
      cost: cost ? Number(cost) : undefined,
      shares: shares ? Number(shares) : undefined,
      amount: amount ? Number(amount) : undefined,
    });
    onClose();
  };

  return (
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
      <p className="text-sm font-medium text-slate-900">编辑持仓：{fund.name}</p>
      <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="总成本" value={cost} onChange={(e) => setCost(e.target.value)} />
      <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="持有份额" value={shares} onChange={(e) => setShares(e.target.value)} />
      <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="持仓金额" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex gap-2">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-white" type="submit">保存持仓</button>
        <button className="rounded-lg border border-slate-300 px-3 py-2" type="button" onClick={onClose}>关闭</button>
      </div>
    </form>
  );
}
