import React from 'react';

import { FundDetailCard } from '@/components/fund/fund-detail-card';
import { useFundQuotes } from '@/lib/hooks/use-fund-quotes';
import { useWatchlist } from '@/lib/hooks/use-watchlist';

interface FundDetailPageProps {
  params: Promise<{ code: string }>;
}

function FundDetailContent({ code }: { code: string }) {
  const { watchlist } = useWatchlist();
  const fund = watchlist.find((item) => item.code === code);
  const { quotes } = useFundQuotes([code]);
  const quote = quotes.find((item) => item.code === code);

  if (!fund) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          没有找到这只基金，请先回到首页添加。
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <FundDetailCard fund={fund} quote={quote} />
    </main>
  );
}

export default async function FundDetailPage({ params }: FundDetailPageProps) {
  const { code } = await params;

  return <FundDetailContent code={code} />;
}
