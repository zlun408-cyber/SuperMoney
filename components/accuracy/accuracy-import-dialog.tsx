'use client';

import React, { useRef, useState } from 'react';

import { AccuracyStore } from '@/lib/accuracy/accuracy-store';
import { AccuracyImportValidationError } from '@/lib/accuracy/import';
import type { AccuracyImportSummary } from '@/lib/accuracy/import';

interface AccuracyImportDialogProps {
  open: boolean;
  onClose: () => void;
  accuracyStore: AccuracyStore;
  onImportSuccess: (summary: AccuracyImportSummary) => void;
}

function SummaryStat({
  label,
  value,
  subValue,
  testId,
}: {
  label: string;
  value: number | string;
  subValue?: string;
  testId?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:bg-slate-100/50" data-testid={testId}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {subValue && <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase">{subValue}</p>}
    </div>
  );
}

export function AccuracyImportDialog({
  open,
  onClose,
  accuracyStore,
  onImportSuccess,
}: AccuracyImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<{ message: string; issues?: string[] } | null>(null);
  const [dryRunSummary, setDryRunSummary] = useState<AccuracyImportSummary | null>(null);
  const [rawPayload, setRawPayload] = useState<unknown>(null);

  if (!open) {
    return null;
  }

  const reset = () => {
    setIsProcessing(false);
    setError(null);
    setDryRunSummary(null);
    setRawPayload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    setDryRunSummary(null);

    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error('文件格式错误：不是有效的 JSON 文件');
      }

      const result = accuracyStore.dryRunImport(payload);
      setDryRunSummary(result.summary);
      setRawPayload(payload);
    } catch (err) {
      if (err instanceof AccuracyImportValidationError) {
        setError({
          message: err.message,
          issues: err.issues.map((issue) => `${issue.path}: ${issue.message}`),
        });
      } else {
        setError({ message: err instanceof Error ? err.message : '解析文件失败' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!rawPayload) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = accuracyStore.applyImport(rawPayload);
      onImportSuccess(result.summary);
      reset();
      onClose();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : '导入失败' });
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <div data-testid="accuracy-import-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">导入估值准确度数据</h2>
          <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-wide">
            Import Accuracy Backups & Decisions
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div data-testid="accuracy-import-error" className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-5">
              <p className="font-bold text-rose-800">{error.message}</p>
              {Array.isArray(error.issues) && error.issues.length > 0 && (
                <ul className="mt-3 list-inside list-disc space-y-1 text-xs font-bold text-rose-700 uppercase tracking-tighter">
                  {error.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!dryRunSummary ? (
            <div
              className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-16 transition duration-300 ${
                isProcessing
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/20'
              }`}
            >
              <input
                data-testid="accuracy-import-file-input"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileChange}
                disabled={isProcessing}
                aria-label="选择 JSON 文件"
              />
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="mt-6 text-base font-bold text-slate-900">
                  {isProcessing ? '正在扫描 JSON 指纹...' : '点击或拖拽 JSON 文件到此处'}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-400 uppercase tracking-widest">Supports JSON Backup Format</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div data-testid="accuracy-import-summary" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryStat
                  label="待录入样本"
                  value={dryRunSummary.snapshots.new}
                  subValue={`总计 ${dryRunSummary.snapshots.total}`}
                  testId="import-stat-new-snapshots"
                />
                <SummaryStat
                  label="待录入决策"
                  value={dryRunSummary.decisions.new}
                  subValue={`总计 ${dryRunSummary.decisions.total}`}
                  testId="import-stat-new-decisions"
                />
                <SummaryStat
                  label="覆盖基金"
                  value={dryRunSummary.fundCount}
                  testId="import-stat-fund-count"
                />
                <SummaryStat
                  label="已存在跳过"
                  value={dryRunSummary.snapshots.conflict + dryRunSummary.snapshots.duplicate}
                  subValue="自动合并"
                  testId="import-stat-ignored"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-slate-400">Time Range 样本日期范围</span>
                  <span className="text-slate-900 font-mono">
                    {dryRunSummary.dateRange.startTradingDate ?? '--'} 至 {dryRunSummary.dateRange.endTradingDate ?? '--'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                  <span className="text-slate-400">Sync Strategy 导入策略</span>
                  <span className="inline-flex items-center rounded-lg bg-blue-900 px-2.5 py-1 text-white shadow-sm ring-1 ring-inset ring-blue-700/10">
                    只追加/补全
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 text-sm">
                <div className="flex gap-4 text-amber-800 font-bold leading-relaxed">
                  <svg className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>
                    <strong>安全声明：</strong>系统仅追加本地缺失的样本，绝不会删除或覆盖现有的本地决策。若导入数据与本地冲突，将严格优先保留本地已存记录。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-8 py-6">
          <button
            data-testid="accuracy-import-cancel"
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            取消
          </button>
          {dryRunSummary && (
            <button
              data-testid="accuracy-import-confirm"
              type="button"
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
              onClick={handleConfirmImport}
              disabled={isProcessing}
            >
              {isProcessing ? '正在提交指纹...' : '确认并只追加/补全 (不覆盖删除)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
