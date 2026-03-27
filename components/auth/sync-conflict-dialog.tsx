'use client';

interface SyncConflictDialogProps {
  open: boolean;
  onChooseCloud: () => void;
  onChooseLocal: () => void;
}

export function SyncConflictDialog({ open, onChooseCloud, onChooseLocal }: SyncConflictDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">发现本地和云端都有数据</h2>
      <p className="mt-2 text-sm text-slate-600">请选择要保留哪一份数据，本阶段不会自动合并。</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button
          aria-label="使用云端数据"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left"
          onClick={onChooseCloud}
          type="button"
        >
          <span className="block font-medium text-slate-900">使用云端数据</span>
          <span className="mt-1 block text-sm text-slate-500">当前设备恢复云端已有数据。</span>
        </button>

        <button
          aria-label="使用本地数据"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left"
          onClick={onChooseLocal}
          type="button"
        >
          <span className="block font-medium text-slate-900">使用本地数据</span>
          <span className="mt-1 block text-sm text-slate-500">当前设备数据上传并覆盖云端。</span>
        </button>
      </div>
    </div>
  );
}
