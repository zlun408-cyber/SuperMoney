import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('data-source in direct node runtime', () => {
  it('can be imported with node experimental strip types', async () => {
    const result = await execFileAsync(
      'node',
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        "import('./lib/funds/data-source.ts').then(() => console.log('loaded'))",
      ],
      {
        cwd: process.cwd(),
      },
    );

    expect(result.stdout).toContain('loaded');
  });

  it('allows the quote check script to run in direct node runtime', async () => {
    const result = await execFileAsync(
      'node',
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        `
globalThis.fetch = async () => ({
  ok: true,
  text: async () => 'jsonpgz({"fundcode":"588350","name":"Mock Fund","jzrq":"2026-03-25","dwjz":"1.4443","gsz":"1.2345","gszzl":"0.56","gztime":"2026-03-26 15:00"});',
});
await import('./scripts/check-fund-quote.ts');
        `,
      ],
      {
        cwd: process.cwd(),
      },
    );

    expect(result.stdout).toContain('588350');
    expect(result.stdout).toContain('Mock Fund');
  });
});
