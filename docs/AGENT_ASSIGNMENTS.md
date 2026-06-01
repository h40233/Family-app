# Family OS Subagent Assignments

此文件記錄平行開發分工。每個 subagent 都應遵守自己的寫入範圍，不要回復或覆蓋其他人的變更。

## 共同規則

- 先閱讀 `docs/PRD.md`、`docs/API_SPEC.md`、`docs/DATABASE_SPEC.md`、`docs/DEVELOPMENT_TASKS.md`。
- 不要修改其他 agent 負責的檔案，除非最後整合時必要。
- 若需要跨模組調整，先在回覆中說明，不要自行大範圍重構。
- 保留使用者既有文件與變更。
- 完成後回報：完成項目、修改檔案、如何驗證、未完成風險。

## Agent A: Database Foundation

負責範圍：

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `src/server/db/**`
- 必要時更新 `package.json` scripts

任務：

- 根據 `docs/DATABASE_SPEC.md` 建立 Prisma schema。
- 建立 Prisma client helper。
- 加入基本 seed 架構，如不實作完整 seed，至少留下清楚入口。

## Agent B: Backend Foundation

負責範圍：

- `src/server/auth/**`
- `src/server/families/**`
- `src/server/permissions/**`
- `src/app/api/v1/auth/**`
- `src/app/api/v1/families/**`
- `src/app/api/v1/permissions/**`

任務：

- 建立 auth / family / permission 的 domain service 與 API route 骨架。
- 實作統一錯誤與 session placeholder。
- API 需符合 `docs/API_SPEC.md`。

## Agent C: Tasks, Points, Wishes

負責範圍：

- `src/server/tasks/**`
- `src/server/points/**`
- `src/server/wishes/**`
- `src/app/api/v1/families/[familyId]/tasks/**`
- `src/app/api/v1/families/[familyId]/points/**`
- `src/app/api/v1/families/[familyId]/wishes/**`

任務：

- 建立任務、積分、願望狀態機的 service 與 API route 骨架。
- 願望狀態轉移需集中管理。
- 積分操作需以 ledger 為核心。

## Agent D: Frontend App Shell

負責範圍：

- `src/app/**`，但排除 `src/app/api/**`
- `src/components/**`
- `src/features/**`
- `src/lib/offline/**`

任務：

- 建立可持續擴充的 app shell、dashboard、主要功能頁入口。
- 建立個人記帳離線 IndexedDB helper。
- 建立權限驅動 UI 的 component 基礎。
