import React, { useState } from 'react';

interface AddFundDialogProps {
  onAddFund: (fund: { code: string; name: string }) => void;
}

export function AddFundDialog({ onAddFund }: AddFundDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!code.trim() || !name.trim()) {
      return;
    }

    onAddFund({ code: code.trim(), name: name.trim() });
    setCode('');
    setName('');
    setOpen(false);
  };

  return (
    <div>
      <button className="rounded-xl bg-emerald-600 px-4 py-2 text-white" onClick={() => setOpen(true)}>
        添加基金
      </button>
      {open ? (
        <form className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="基金代码"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="基金名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-white" type="submit">
              保存
            </button>
            <button className="rounded-lg border border-slate-300 px-3 py-2" type="button" onClick={() => setOpen(false)}>
              取消
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
