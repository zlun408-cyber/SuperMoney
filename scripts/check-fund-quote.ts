import { fetchSingleFundQuote } from '../lib/funds/data-source.ts';

async function main() {
  const result = await fetchSingleFundQuote('588350');
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
