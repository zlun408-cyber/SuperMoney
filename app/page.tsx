export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium text-emerald-600">SuperFinance</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">基金实时估值监控</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          项目骨架已初始化。下一步将开始搭建基金监控首页、数据服务和本地持仓管理能力。
        </p>
      </div>
    </main>
  );
}
