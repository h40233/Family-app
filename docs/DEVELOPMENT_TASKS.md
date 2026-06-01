# Family OS 開發 Task Tracker

本文件是給多位 subagent 平行開發使用的主線 task tracker。主線 MVP 目標是：

> 串接前後端核心流程，讓個人記帳、共用基金、任務、積分、願望、通知、報表與權限能通過驗收測試。

## 狀態定義

| 狀態 | 定義 |
|---|---|
| Done | 該 Phase 的主要開發項目已具備可驗證產出，且有對應測試或可執行驗證。 |
| Partial | 已有 API、UI skeleton、in-memory store、placeholder 或部分測試，但尚未達到可上線 MVP。 |
| Pending | 尚未開始，或只有文件設計而沒有可運作產出。 |

## 2026-05-31 MVP 串接狀態總結

目前主線已完成「MVP 階段：串接前後端並且通過測試」的可執行版本候選：

- 前端頁面已串接核心 API：dashboard、個人記帳、共用基金、任務、積分、願望、通知、報表、方案與 admin。
- 後端已具備 REST API、Prisma schema/migrations、memory runtime 與可切換的 DB-backed runtime path。
- DB-backed runtime 已覆蓋 auth/session、family/member/permissions、personal money、shared funds、points、tasks、wishes、notifications、budgets、reports、plans 與 admin 的 MVP 主流程。
- PWA manifest、service worker、Web Push 訂閱與 VAPID sender scaffold 已可驗證；缺 VAPID 時 local/test 會清楚 skip，production env check 會要求設定。
- Billing 已有 provider abstraction、mock checkout、webhook contract、plan persistence path、免費版廣告與多主題 gating；真實金流 adapter 屬於正式商業化 hardening。
- Admin MVP 已包含 admin guard、metrics、users/families、ban/unban、ads toggle 與 audit log。

本文件前段的 Phase 表保留早期 backlog snapshot；若和下方 dated update 衝突，以最新 dated update 與目前程式碼/測試結果為準。剩餘 Partial 多屬正式上線 hardening 或產品細節，不阻擋目前 MVP 串接候選版。

本次整合驗證已通過 `db:validate`、`db:generate`、`typecheck`、`lint`、`test`、`audit`、`build`、`smoke`、`e2e`、`env:check`。本機 `db:smoke:money` 未執行，原因是 Docker daemon 未啟動且本機既有 PostgreSQL 不接受測試帳密；該 smoke 已在 CI 中配置 PostgreSQL service 後執行。

## 目前整體狀態

| Phase | 名稱 | 目前狀態 | 現況摘要 | 下一步 |
|---|---|---|---|---|
| Phase 0 | 專案初始化 | Partial | Next.js / TypeScript 專案、API route 基礎、PWA manifest / service worker、CI 與驗證指令已存在。 | 補正式 DB-backed runtime 後再調整部署參數。 |
| Phase 1 | 帳號、家庭、權限 | Partial | Auth 已有 MVP cookie session flow，family/permission API routes 與 permission service 已可用；仍保留 dev header fallback。 | 接正式 password hash / DB session provider，補登入 UI 流程。 |
| Phase 2 | 個人記帳 | Partial | 已有個人記帳 API/UI skeleton 與 IndexedDB queue helper 雛形；資料層仍未落正式 DB。 | 串接 API、完成 CRUD UI、補離線同步 API 與測試。 |
| Phase 3 | 共用基金 | Partial | 已有共用基金 API/UI skeleton；協作操作應保持 online-only。 | 完成基金權限、餘額一致性、UI 串接與測試。 |
| Phase 4 | 積分系統 | Partial | 已有 points API/UI skeleton 與 ledger 概念；需確認不可竄改流水。 | 完成資料持久化、調分權限、任務/願望串接測試。 |
| Phase 5 | 任務清單 | Partial | 已有 tasks API skeleton；需和積分發放、審核流程完整整合。 | 完成 auto/review 發分、重複任務與 UI 驗收。 |
| Phase 6 | 願望與兌換 | Partial | 已有 wishes API skeleton；狀態機規則需以測試鎖住。 | 完成價格提案、兌換扣分、完成願望與非法轉移測試。 |
| Phase 7 | 通知 | Partial | App 內通知已串接，任務、積分、願望與預算超支可產生通知；Web Push 訂閱 API/UI 與 service worker handler 已具備 MVP 基礎。 | 補 VAPID key 管理、真正推播發送器與瀏覽器推播 E2E。 |
| Phase 8 | 預算、報表、匯出 | Partial | 預算 API、報表摘要、報表頁與 CSV / Excel-compatible 匯出 API 已串接；免費版匯出會被 plan guard 阻擋。 | 完成近 3 個月查詢限制與正式 DB 聚合。 |
| Phase 9 | 方案、廣告、主題 | Partial | 方案限制 API、MVP checkout 與 billing 頁已串接，可顯示免費版限制並升級解鎖付費功能。 | 補正式金流 provider、廣告顯示判斷、多主題與持久化。 |
| Phase 10 | 管理後台 | Pending | 尚未建立完整 admin workflow。 | 建立 admin auth、metrics、users/families、ads admin。 |
| Phase 11 | 整合測試與上線準備 | Partial | 已有 unit/API route/PWA asset 測試、smoke script、Playwright browser E2E、npm audit gate、CI、Render Blueprint、環境檢查與備份腳本。 | 補正式錯誤監控與 DB-backed runtime 驗證。 |

## 重要風險

- Auth 目前已有 MVP cookie session，但使用者資料與 session 仍在 memory store，尚未達正式 password hash / DB session 安全模型。
- 資料層仍以 in-memory store / placeholder 為主，尚未達正式 PostgreSQL 持久化與 transaction consistency。
- 權限需在 API 層強制檢查，不能只靠前端 UI 隱藏按鈕。
- 多 agent 平行開發時，需避免同時改同一個 route/service；若有衝突，以 API_SPEC / DATABASE_SPEC / 本 tracker 為準同步。
- 前端 skeleton 不等於功能完成；必須串 API 並通過驗收矩陣才可標 Done。

## Phase 0: 專案初始化

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P0-001 | 建立 Next.js + TypeScript 專案 | 可啟動前端 | Done |
| P0-002 | 建立後端 API 架構 | `/api/v1` health check | Done |
| P0-003 | 建立 PostgreSQL 連線 | DB connection | Pending |
| P0-004 | 設定 ORM 與 migration | migration workflow | Partial |
| P0-005 | 設定 lint / format / test | CI-ready scripts | Done |
| P0-006 | 建立 PWA manifest 與 service worker 基礎 | 可安裝 PWA | Partial |

## Phase 1: 帳號、家庭、權限

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P1-001 | 實作使用者註冊 / 登入 | Auth API + UI | Partial |
| P1-002 | 實作 session 驗證 | API guard | Partial |
| P1-003 | 實作建立家庭 | Family API + UI | Partial |
| P1-004 | 實作家庭列表與切換 | Family switcher | Partial |
| P1-005 | 實作家庭成員列表 | Members page | Partial |
| P1-006 | 實作兒童簡易帳號建立 | Child account flow | Partial |
| P1-007 | 實作角色模型 | owner/admin/member/child/viewer | Partial |
| P1-008 | 實作權限檢查服務 | Permission service | Partial |
| P1-009 | 實作資源權限覆寫 | Resource permissions | Partial |
| P1-010 | 權限測試 | P-001 到 P-005 | Partial |

## Phase 2: 個人記帳

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P2-001 | 建立個人帳戶資料表 | `personal_accounts` | Pending |
| P2-002 | 建立個人交易資料表 | `personal_transactions` | Pending |
| P2-003 | 實作個人帳戶 CRUD API | Account API | Partial |
| P2-004 | 實作個人交易 CRUD API | Transaction API | Partial |
| P2-005 | 實作帳戶餘額更新 | Balance transaction | Partial |
| P2-006 | 實作帳戶交易列表 UI | Account detail | Partial |
| P2-007 | 實作新增交易 UI | Income / expense form | Pending |
| P2-008 | 實作分類基礎功能 | Default + custom categories | Partial |
| P2-009 | 實作分享層級設定 | Sharing settings | Pending |
| P2-010 | 實作 IndexedDB 離線交易佇列 | Offline queue | Partial |
| P2-011 | 實作離線同步 API | `/personal/offline-sync` | Pending |
| P2-012 | 個人記帳測試 | A-001 到 A-005 | Partial |

## Phase 3: 共用基金

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P3-001 | 建立共用基金資料表 | `shared_funds` | Pending |
| P3-002 | 建立基金交易資料表 | `fund_transactions` | Pending |
| P3-003 | 實作基金 CRUD API | Fund API | Partial |
| P3-004 | 實作基金權限設定 | Fund permissions | Partial |
| P3-005 | 實作基金交易新增 API | Fund transaction API | Partial |
| P3-006 | 實作基金餘額更新 | Balance transaction | Partial |
| P3-007 | 實作基金列表 UI | Fund list | Partial |
| P3-008 | 實作基金明細 UI | Fund detail | Pending |
| P3-009 | 實作離線狀態阻止協作操作 | Online-only guard | Pending |
| P3-010 | 共用基金測試 | F-001 到 F-005 | Partial |

## Phase 4: 積分系統

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P4-001 | 建立積分流水資料表 | `point_ledger` | Pending |
| P4-002 | 建立積分餘額資料表 | `point_balances` | Pending |
| P4-003 | 實作積分查詢 API | Balance + ledger API | Partial |
| P4-004 | 實作手動調分 API | Adjust API | Partial |
| P4-005 | 實作積分頁面 | Points UI | Partial |
| P4-006 | 實作調分必填原因 | Audit-ready form | Partial |
| P4-007 | 積分權限測試 | 調分權限與流水 | Partial |

## Phase 5: 任務清單

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P5-001 | 建立任務資料表 | `tasks` | Pending |
| P5-002 | 建立任務指派資料表 | `task_assignments` | Pending |
| P5-003 | 建立任務完成資料表 | `task_completions` | Pending |
| P5-004 | 實作任務 CRUD API | Task API | Partial |
| P5-005 | 實作任務指派 | Single / multiple / open | Partial |
| P5-006 | 實作自動發分完成流程 | Auto points | Partial |
| P5-007 | 實作審核發分流程 | Review points | Partial |
| P5-008 | 實作重複任務生成 | Repeat rule | Pending |
| P5-009 | 實作任務列表與明細 UI | Task UI | Partial |
| P5-010 | 實作待審核 UI | Review queue | Partial |
| P5-011 | 任務與積分測試 | T-001 到 T-006 | Partial |

## Phase 6: 願望與兌換

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P6-001 | 建立願望資料表 | `wishes` | Pending |
| P6-002 | 建立價格提案資料表 | `wish_price_proposals` | Pending |
| P6-003 | 建立兌換資料表 | `wish_redemptions` | Pending |
| P6-004 | 實作願望提出 API | Create wish | Partial |
| P6-005 | 實作接受 / 駁回 API | Accept / reject | Partial |
| P6-006 | 實作定價與改價 API | Price proposal | Partial |
| P6-007 | 實作價格同意 / 拒絕 API | Approve / reject price | Partial |
| P6-008 | 實作兌換 API | Redeem + deduct points | Partial |
| P6-009 | 實作完成願望 API | Complete wish | Partial |
| P6-010 | 實作願望狀態機防呆 | Legal transitions only | Partial |
| P6-011 | 實作願望列表與明細 UI | Wish UI | Partial |
| P6-012 | 實作願望時間軸 | Status timeline | Pending |
| P6-013 | 願望測試 | W-001 到 W-008 | Partial |

## Phase 7: 通知

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P7-001 | 建立通知資料表 | `notifications` | Pending |
| P7-002 | 實作 App 內通知 API | Notification API | Partial |
| P7-003 | 實作通知中心 UI | Notification center | Partial |
| P7-004 | 建立 Web Push 訂閱資料表 | `push_subscriptions` | Partial |
| P7-005 | 實作 Web Push 訂閱流程 | Push subscribe | Partial |
| P7-006 | 任務通知事件 | Assigned / review | Partial |
| P7-007 | 積分通知事件 | Awarded / adjusted | Partial |
| P7-008 | 願望通知事件 | Accepted / rejected / price / redeemed | Partial |
| P7-009 | 預算超支通知事件 | Budget exceeded | Partial |
| P7-010 | 通知測試 | N-001 到 N-005 | Partial |

## Phase 8: 預算、報表、匯出

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P8-001 | 建立預算資料表 | `budgets` | Partial |
| P8-002 | 實作預算 CRUD API | Budget API | Partial |
| P8-003 | 實作月支出分類統計 API | Pie chart data | Partial |
| P8-004 | 實作帳戶餘額報表 API | Account balances | Partial |
| P8-005 | 實作共用基金餘額報表 API | Fund balances | Partial |
| P8-006 | 實作報表頁 UI | Reports UI | Partial |
| P8-007 | 實作免費版近 3 個月限制 | Plan guard | Partial |
| P8-008 | 實作付費版 CSV 匯出 | CSV export | Partial |
| P8-009 | 實作付費版 Excel 匯出 | Excel export | Partial |
| P8-010 | 報表與方案測試 | S-001/S-002/S-005/S-006 | Partial |

## Phase 9: 方案、廣告、主題

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P9-001 | 實作家庭方案資料 | free / paid | Partial |
| P9-002 | 實作免費版限制 | Members/tasks/wishes/reports | Partial |
| P9-003 | 實作付費版功能開關 | Feature flags | Partial |
| P9-004 | 實作廣告顯示判斷 | Ad placements | Pending |
| P9-005 | 實作首頁資訊流廣告 | Dashboard ads | Pending |
| P9-006 | 實作報表頁底部廣告 | Report ads | Pending |
| P9-007 | 實作切頁廣告 | Interstitial ads | Pending |
| P9-008 | 實作主題 token 系統 | Theme tokens | Partial |
| P9-009 | 實作多主題選擇 | Theme picker | Pending |
| P9-010 | 方案限制測試 | S-001 到 S-006 | Partial |

## Phase 10: 管理後台

狀態：Pending

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P10-001 | 實作系統管理員角色 | Admin auth | Pending |
| P10-002 | 實作營運數據 API | Metrics API | Pending |
| P10-003 | 實作使用者列表 | Admin users | Pending |
| P10-004 | 實作家庭列表 | Admin families | Pending |
| P10-005 | 實作封鎖帳號 | Ban user | Pending |
| P10-006 | 實作廣告管理 | Ads admin | Pending |
| P10-007 | 實作管理後台 UI | Admin UI | Pending |
| P10-008 | 實作管理操作 audit log | Admin audit | Pending |

## Phase 11: 整合測試與上線準備

狀態：Partial

| ID | Task | 產出 | 狀態 |
|---|---|---|---|
| P11-001 | 補齊 unit tests | Core logic tests | Partial |
| P11-002 | 補齊 API integration tests | API tests | Partial |
| P11-003 | 補齊前端 E2E tests | Critical flows | Partial |
| P11-004 | 測試 PWA 安裝 | Installable app | Partial |
| P11-005 | 測試離線交易同步 | Offline sync verified | Pending |
| P11-006 | 測試權限繞過 | Security checks | Partial |
| P11-007 | 測試方案限制 | Plan checks | Pending |
| P11-008 | 建立部署流程 | Production deployment | Partial |
| P11-009 | 建立錯誤監控 | Error tracking | Pending |
| P11-010 | 建立備份策略 | DB backup | Partial |

## MVP 里程碑建議

### Milestone 1: 可登入與家庭空間

目標：完成 Phase 0-1 的 MVP 子集。

目前狀態：Partial

完成條件：
- 使用者可註冊、登入、取得 MVP cookie session。
- 使用者可建立家庭、切換家庭、查看成員。
- 權限可在 API 層阻擋未授權操作。
- Auth 不再只依賴 dev-only header；MVP 階段已有 cookie session，正式版需替換為 DB session / password hash。

### Milestone 2: 可記帳

目標：完成 Phase 2-3 的 MVP 子集，使用者可做個人記帳與共用基金。

目前狀態：Partial

完成條件：
- 個人帳戶與交易可 CRUD。
- 個人帳戶餘額正確更新。
- 共用基金可存入 / 支出，餘額正確更新。
- 個人離線交易可進入 queue，回線後同步。
- 共用基金協作操作在離線時被阻止。

### Milestone 3: 可玩核心循環

目標：完成 Phase 4-6 的 MVP 子集，任務、積分、願望兌換可完整跑通。

目前狀態：Partial

完成條件：
- 任務完成可依 auto/review 模式發分。
- 積分流水不可跳過，所有調整都有原因與紀錄。
- 願望可提出、接受、定價、同意、兌換、完成。
- 願望非法狀態轉移會被 API 拒絕。

### Milestone 4: 可商業化測試

目標：完成 Phase 7-9 的 MVP 子集，通知、報表、方案、廣告、主題可用。

目前狀態：Partial

完成條件：
- App 內通知可查詢、標示已讀。
- 主要事件會建立通知。
- 報表可顯示月支出分類、帳戶餘額、基金餘額。
- 免費版限制與付費版匯出權限有效。
- 廣告位置與主題 token 可驗證。

### Milestone 5: 可營運

目標：完成 Phase 10-11 的 MVP 子集，具備管理後台、測試、部署與監控。

目前狀態：Pending

完成條件：
- 管理員可查看基本營運資料。
- 核心 API integration tests、smoke tests 與 Playwright 前端 E2E tests 通過。
- 部署、錯誤監控、資料備份策略已建立。
## 2026-05-31 DB Deployment Verification Update

- Added `npm run db:validate`, `npm run db:migrate`, and `npm run db:check`.
- CI now runs Prisma schema validation, `prisma migrate deploy`, and a Prisma DB connectivity check against the PostgreSQL service.
- Render build now runs Prisma generate, migration deploy, DB check, and Next.js build before serving traffic.
- Status impact: `P0-003 DB connection` moves from Pending to Partial for deployment verification. It is not Done yet because application runtime services still use the memory-backed MVP store.
- Remaining work: replace memory-backed repositories with PostgreSQL-backed implementations, then promote DB runtime acceptance items from Partial to Done.

## 2026-05-31 DB-Backed Money Slice Update

- Unified MVP fixture ids to UUID values shared by memory runtime, frontend constants, smoke tests, and database seed data.
- Added `src/server/dev-fixtures.ts` as the authoritative MVP fixture id source.
- Added `npm run db:seed` to create deterministic MVP database data for owner, child, family, accounts, transaction, budget, fund, task, wish, points, and notification.
- Added a database runtime switch through `FAMILY_OS_DATA_SOURCE=database` or `FAMILY_OS_MONEY_DATA_SOURCE=database`.
- Personal money service can now list accounts, create accounts, list transactions, create transactions, update balances, and deduplicate UUID client mutation ids through Prisma when the money DB runtime flag is enabled.
- Added `npm run db:smoke:money` and wired it into CI after migration and seed. This proves the DB-backed personal money service can create a transaction and observe the updated balance.
- Status impact: Phase 2 personal accounting moves closer to Done for data persistence, but reports/budgets still need DB-backed reads before the whole money domain can be marked Done.

## 2026-05-31 DB-Backed Reports and Budgets Update

- Added DB-backed report summary reads behind `FAMILY_OS_REPORTS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Report exports now reuse the DB-backed summary when that runtime flag is enabled, so DB personal transactions flow through to CSV / Excel-compatible exports.
- Added DB-backed budget list and spent calculation behind `FAMILY_OS_BUDGETS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Expanded `npm run db:smoke:money` to verify the DB-backed flow writes a personal transaction, reads it through reports, reflects the updated account balance, and keeps seeded Food budget spent isolated from unrelated categories.
- Status impact: Phase 8 reports/export and budget listing are closer to Done for DB runtime. Budget create/update/delete and budget overage notifications still use memory runtime.

## 2026-05-31 DB-Backed Shared Funds Update

- Added DB-backed shared fund listing and creation behind `FAMILY_OS_FUNDS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Added DB-backed fund transaction listing and creation with Prisma transaction-wrapped balance updates.
- Fund transaction categories are created/reused under `shared_fund` scope.
- Expanded `npm run db:smoke:money` again to verify DB fund deposit creation, transaction listing, updated fund balance, and DB report fund balance aggregation.
- Status impact: Phase 3 shared funds now has a DB-backed persistence path for the core fund transaction workflow. Fund permission storage and budget overage notifications still need full DB runtime migration.

## 2026-05-31 DB-Backed Points Update

- Added DB-backed point balances, current-user balance, ledger listing, and manual adjustments behind `FAMILY_OS_POINTS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Point adjustments now upsert/update `point_balances` and create `point_ledger` entries in a Prisma transaction when DB runtime is enabled.
- Cleaned point-change notification text to stable ASCII copy.
- Expanded `npm run db:smoke:money` to verify DB point adjustment, balance update, returned ledger balance, and ledger listing.
- Status impact: Phase 4 points now has a DB-backed persistence path for balances and manual ledger entries. Task award and wish redemption flows still need to be switched to DB runtime so they write into the same point ledger.

## 2026-05-31 DB-Backed Task Awards Update

- Added DB-backed task listing, creation, lookup, completion, and review behind `FAMILY_OS_TASKS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Auto task completion now creates `task_completions` and writes the award into the DB-backed point ledger when tasks and points DB runtime are enabled.
- Review task approval updates the DB completion and writes awarded points into the same point ledger.
- Expanded `npm run db:smoke:money` to verify seeded task listing, auto completion approval, point balance increase, and point ledger entry linked to the task completion.
- Status impact: Phase 5 task completion and award flow now has a DB-backed persistence path. Task update/delete and richer repeat-task lifecycle are still MVP-level.

## 2026-05-31 DB-Backed Wish Redemption Update

- Added DB-backed wish listing, creation, lookup, accept/reject, price proposal resolution, redemption, completion, and delete status updates behind `FAMILY_OS_WISHES_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Wish redemption now validates DB point balance, creates `wish_redemptions`, moves the wish to pending fulfillment, and writes a negative `wish_redemption` point ledger entry when DB runtime is enabled.
- Wish completion now marks the pending redemption fulfilled and moves the wish to `completed`.
- Expanded `npm run db:smoke:money` to verify seeded wish listing, point funding, redemption point deduction, ledger linkage to redemption, and completion.
- Status impact: Phase 6 wish redemption has a DB-backed persistence path tied to the shared point ledger. More granular delete-consent workflows remain MVP-level.

## 2026-05-31 DB-Backed Notifications Update

- Added DB-backed app notification create/list/read/read-all behind `FAMILY_OS_NOTIFICATIONS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Added DB-backed push subscription create/list/delete using the existing `push_subscriptions` table.
- Expanded `npm run db:smoke:money` to verify point-change notifications are persisted, read-all updates unread notifications, and push subscriptions can be created, listed, and deleted.
- Status impact: Phase 7 App in-app notifications and Web Push subscription storage now have a DB-backed persistence path. Real Web Push delivery still needs VAPID senders and background delivery jobs.

## 2026-05-31 DB-Backed Auth Sessions Update

- Added `auth_sessions` table and migration for hashed cookie session tokens, issued/expiry timestamps, and revocation.
- Added DB-backed auth/session behavior behind `FAMILY_OS_AUTH_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Register now creates DB users with PBKDF2 password hashes when DB auth runtime is enabled.
- Login verifies DB password hashes, creates `auth_sessions`, and resolves `/me` from the hashed cookie token.
- Child login resolves seeded child users through DB family membership.
- Logout revokes DB sessions by setting `revoked_at`.
- Expanded `npm run db:smoke:money` to verify seeded owner login, cookie session lookup, logout revocation, and child login.
- Status impact: Phase 1 auth/session now has a DB-backed persistence path. Full production auth still needs account recovery, password policy hardening, session cleanup jobs, and removal of dev fallback paths outside local MVP mode.

## 2026-05-31 Admin / Monitoring MVP Update

- Added admin identity through `users.is_admin`, `FAMILY_OS_ADMIN_EMAILS`, `FAMILY_OS_ADMIN_USER_IDS`, and the seeded development admin user.
- Added ban fields on `users` and DB auth now rejects banned users during login/session lookup.
- Added `/api/v1/admin/metrics`, `/api/v1/admin/users`, `/api/v1/admin/families`, `/api/v1/admin/users/{userId}/ban`, `/api/v1/admin/users/{userId}/unban`, `/api/v1/admin/ads`, and `/api/v1/admin/audit-logs`.
- Added an Admin UI at `/admin` for metrics, users, families, ban/unban, ad toggles, and recent audit entries.
- Admin ban/unban and ad updates write audit log entries. DB runtime writes to `audit_logs`; memory runtime keeps an MVP audit buffer for tests/local development.
- Added admin API tests for guard, metrics, ban/unban audit, and ad audit.
- Status impact: Phase 10 moves from Pending to Partial. It is not Done yet because ads use MVP in-memory placement config and production admin policy still needs role management, pagination/search, and operational hardening.

## 2026-05-31 DB-Backed Budget Write Path Update

- Added `name` and `updated_at` budget columns plus a migration so DB-backed budget CRUD preserves user-facing budget names.
- Budget create/update/delete now use Prisma behind `FAMILY_OS_BUDGETS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`; list and spent calculation continue to use the same DB path.
- Personal expense and shared-fund expense creation now call budget overage checks in DB runtime and create app notifications through the DB-backed notification service when notifications DB runtime is enabled.
- Expanded `npm run db:smoke:money` to create, update, and delete a DB-backed budget and verify a personal expense overage creates a persisted `budget_exceeded` notification while still allowing the transaction.
- Status impact: Phase 8 budget persistence and Phase 7 budget notifications now have an end-to-end DB-backed MVP path. Remaining work is mostly UI polish for budget edit/delete and production-grade notification delivery.
## 2026-05-31 Web Push Sender Update

- Added a VAPID-backed Web Push sender abstraction in `src/server/notifications`.
- App notification creation can now attempt delivery to the recipient user's saved push subscriptions; local/test environments skip clearly when VAPID env vars are absent.
- Expired push subscriptions returning `404` or `410` are removed during delivery.
- Added focused unit coverage for sender injection, no-VAPID skipped delivery, and expired subscription cleanup without touching the real push network.
- Status impact: Phase 7 Web Push moves closer to Done for the server delivery path. Remaining gaps are browser permission E2E and durable retry/background queueing.

## 2026-05-31 DB-Backed Family and Permissions Update

- Added DB-backed family list/create/get/update, family member list/update/remove, and child account creation behind `FAMILY_OS_FAMILIES_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`.
- Added `family_role_permissions` migration and seed data so family-scoped role permission overrides can persist in PostgreSQL while falling back to the existing default role matrix.
- Added DB-backed permission checks behind `FAMILY_OS_PERMISSIONS_DATA_SOURCE=database` or the global database flag, including member custom allow/deny permissions and resource permission overrides from `resource_permissions`.
- Updated role permission and resource permission APIs to pass the route `familyId` into the DB-backed permission service.
- Added focused mocked-Prisma coverage for DB permission composition and persistence.
- Status impact: Phase 1 family/member/role/resource-permission runtime now has a DB-backed path. Remaining gaps are invite persistence, full API-level permission enforcement on every family mutation route, and production child credential policy.

## 2026-05-31 Billing, Ads, and Theme Slice Update

- Added a provider-agnostic billing contract in `src/server/billing` with the existing mock provider retained as the default.
- Checkout now runs through the billing provider abstraction and applies completed checkout sessions through the shared plan update path.
- Added `/api/v1/billing/webhook` with raw-body parsing, provider event parsing, and configurable signature validation through `FAMILY_OS_BILLING_WEBHOOK_SECRET`.
- Added DB-backed family plan status and plan update behavior behind `FAMILY_OS_PLANS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database`, using the existing `families.plan` column.
- Added free-plan ad placements for dashboard feed, report bottom, and route-change interstitials; paid plans hide these through the existing plan limits flag.
- Added a theme picker on the billing page with Classic available to everyone and Ocean/Sunset gated behind `canUseMultipleThemes`.
- Added focused webhook tests covering plan application and signature validation.
- Status impact: Phase 9 provider/webhook scaffold, ad placements, and theme picker move from Pending/Partial toward MVP-complete. Real payment capture, provider session persistence, admin-managed ad inventory, and persisted theme preferences remain future work.
