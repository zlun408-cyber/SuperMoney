import React from 'react';

import { FundDetailContent } from '@/components/fund/fund-detail-content';

interface FundDetailPageProps {
  params: Promise<{ code: string }>;
}

export default async function FundDetailPage({ params }: FundDetailPageProps) {
  const { code } = await params;

  return <FundDetailContent code={code} />;
}
