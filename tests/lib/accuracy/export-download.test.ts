import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadAccuracyCsvExportZip } from '@/lib/accuracy/export-download';

const mockBuildAccuracyCsvExportFiles = vi.fn();
const mockBuildZipArchive = vi.fn();

vi.mock('@/lib/accuracy/export', () => ({
  buildAccuracyCsvExportFiles: (...args: unknown[]) => mockBuildAccuracyCsvExportFiles(...args),
  buildZipArchive: (...args: unknown[]) => mockBuildZipArchive(...args),
  buildAccuracyJsonExport: vi.fn(),
}));

describe('downloadAccuracyCsvExportZip', () => {
  const originalBlob = globalThis.Blob;
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const blobCalls: Array<{ parts: unknown[]; options?: BlobPropertyBag }> = [];

  beforeEach(() => {
    blobCalls.length = 0;
    mockBuildAccuracyCsvExportFiles.mockReset();
    mockBuildZipArchive.mockReset();
    mockBuildAccuracyCsvExportFiles.mockReturnValue([
      { name: 'accuracy_snapshots.csv', content: 'a,b\n1,2' },
    ]);

    class MockBlob {
      public readonly type: string;

      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        blobCalls.push({ parts, options });
        this.type = options?.type ?? '';
      }
    }

    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      value: MockBlob,
      writable: true,
    });

    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      value: originalBlob,
      writable: true,
    });
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('converts zip bytes into a sliced ArrayBuffer before creating the download blob', () => {
    const archive = new Uint8Array([9, 1, 2, 8]).subarray(1, 3);
    mockBuildZipArchive.mockReturnValue(archive);

    downloadAccuracyCsvExportZip({
      snapshots: [],
      decisions: {},
      source: { mode: 'local' },
    });

    const downloadBlob = blobCalls[0];
    expect(downloadBlob?.options?.type).toBe('application/zip');
    expect(downloadBlob?.parts).toHaveLength(1);
    expect(downloadBlob?.parts[0]).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(downloadBlob?.parts[0] as ArrayBuffer))).toEqual([1, 2]);
  });
});
