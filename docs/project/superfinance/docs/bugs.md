# SuperFinance 缺陷沉淀

## 元信息
- Project: superfinance
- 更新日期: 2026-04-09

## 已解决缺陷索引
- `sip-auto-nav-202604091610-a1b2`
  - `2026-04-09-BUG-a49ec5f4`：`/api/funds/nav` 最初错误返回实时估算净值，已切换为历史净值获取链路并通过 QA 复验
  - `2026-04-09-BUG-b7d2e9f8`：净值缓存与日期计算缺少单元测试，已补齐测试并通过 `npm run test`

## 残留风险
- `sip-auto-nav-202604091610-a1b2` 未执行 `npm run test:e2e`
- `sip-auto-nav-202604091610-a1b2` 尚未完成浏览器运行时“净值获取失败降级提示”手测

## 当前阻塞问题
- 暂无硬阻塞
- `npm run build` 在沙箱内会因 Next.js Turbopack 端口绑定限制失败，需在沙箱外验证

## 说明
- QA 缺陷产出路径：`docs/bugs/{FeatureId}/`
- 本文件由 PM 归档记录 Feature 与解决问题摘要
