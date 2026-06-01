# Family OS MVP 驗收矩陣

本矩陣用來追蹤 MVP 是否真正達到「前後端串接並通過測試」。狀態保守標示；UI skeleton、API route skeleton、in-memory store 不等於完成。

## 驗收狀態定義

| 狀態 | 定義 |
|---|---|
| Pass | API、UI、資料層與測試皆可驗證，已達 MVP 驗收條件。 |
| Partial | 已有部分 API/UI/service/test，但尚未完整串接或仍依賴 placeholder。 |
| Blocked | 受 Auth、DB、依賴、資料模型或跨模組流程阻塞。 |
| Pending | 尚未開始實作。 |

## 2026-05-31 MVP 串接驗收總結

目前版本已達成 MVP 階段的前後端串接候選狀態：核心頁面能從真實 API 載入或提交資料，API route、service、Prisma schema/migration、PWA asset、Web Push scaffold、billing/plan guard、admin MVP 與權限檢查皆有可執行測試覆蓋。

已通過的主要驗證閘門：

- `npm run db:validate` 與 `npm run db:generate`。
- `npm run typecheck`。
- `npm run lint`.
- `npm run test`.
- `npm run audit`.
- `npm run build`.
- `npm run smoke`.
- `npm run e2e`.
- `npm run env:check` 在 local/test 缺 VAPID 時通過並輸出 skip warning；production 模式會要求 VAPID env。

本機驗證備註：`db:smoke:money` 已在 CI workflow 中接上 PostgreSQL service、migration、seed 後執行；本機沒有可用測試 DB 帳密，Docker CLI 可用但 daemon 未啟動，因此本次本機驗證未執行 live DB smoke。Prisma schema validation/generate 已通過，DB-backed smoke 仍以 CI 的 Postgres service 作為權威驗證環境。

下方早期矩陣保留為 backlog 與風險追蹤；若早期列仍顯示 Pending/Partial，但後方 dated update 已列出完成證據，請以最新 dated update 與目前測試結果為準。未完成項目多屬正式上線 hardening，例如真實金流 adapter、durable push retry queue、營運後台搜尋/分頁、廣告 inventory persistence、theme preference persistence、帳號復原與更嚴格安全政策。

## MVP 功能驗收矩陣

| 功能 | 對應 API | 對應 UI | 主要測試 | 驗收條件 | 目前狀態 | 目前風險 |
|---|---|---|---|---|---|---|
| 健康檢查與 API 基礎 | `GET /api/v1/health` | 無 | API health test + smoke script | health check 回傳標準 JSON 格式。 | Pass | `npm run test` 與 `npm run smoke` 會覆蓋 health check。 |
| Auth 註冊 / 登入 | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/child-login` | 登入 / 註冊 / 兒童登入流程 | Auth API integration + smoke session check | 使用者可登入並取得 session；兒童帳號可由家長建立後登入。 | Partial | MVP cookie session 已可用；使用者資料、密碼與 session 尚未落正式 DB / password hash。 |
| 家庭建立與切換 | `/families`, `/families/{familyId}` | 家庭列表、建立家庭、家庭切換器 | Family API + UI flow | 使用者可建立多家庭並切換，目前家庭上下文正確套用。 | Partial | 前端 family context 需和 API session 整合。 |
| 家庭成員與角色 | `/families/{familyId}/members`, `/members/invite`, `/members/children` | 成員頁、邀請頁、兒童帳號建立 | P-001 到 P-005 | 管理者可邀請成員、建立兒童帳號、更新角色。 | Partial | 角色與權限資料需落 DB，且 API 必須檢查操作者權限。 |
| 權限檢查 | `/permissions/me`, `/permissions/roles`, `/resources/{type}/{id}/permissions` | 權限設定頁、`Can` / hook | 權限繞過測試 | 無權限者即使直接打 API 也會被拒絕。 | Partial | 前端權限 hook 目前只能當 placeholder；真正安全性必須在 API 層。 |
| 個人帳戶 | `/personal/accounts` | 個人記帳頁、帳戶列表 | A-001, A-002, A-003 | 使用者可建立帳戶；各帳戶交易隔離；餘額正確。 | Partial | 尚需正式 DB schema 與餘額 transaction consistency。 |
| 個人交易 | `/personal/accounts/{accountId}/transactions`, `/personal/transactions/{transactionId}` | 新增收入 / 支出表單、帳戶明細 | A-001 到 A-003 | 交易必須綁定帳戶；收入增加餘額、支出減少餘額。 | Partial | UI form 與 API 串接需補齊。 |
| 個人記帳離線 queue | `/personal/offline-sync` | 離線提示、待同步交易列表 | A-004, A-005 | 離線可新增個人交易；回線後以 `clientMutationId` 同步且避免重複。 | Partial | IndexedDB helper 有雛形；同步 API 與衝突/重試策略需完成。 |
| 個人帳本分享層級 | `/personal/sharing/{familyId}` | 分享設定頁 | 分享權限測試 | 不分享、只分享總餘額、分類統計、部分交易、完整帳本皆符合可見性。 | Pending | 需要細緻資料遮罩與 API 查詢策略。 |
| 共用基金 | `/families/{familyId}/funds` | 共用基金列表 / 明細 | F-001 到 F-005 | 可建立多本基金；有權限者可查看基金與交易明細。 | Partial | 資料層仍未持久化；資源權限覆寫需整合。 |
| 基金交易 | `/funds/{fundId}/transactions` | 存入 / 支出表單 | F-001, F-002, F-003 | 存入增加餘額，支出減少餘額，操作者與備註完整保存。 | Partial | 餘額更新需 DB transaction；協作功能必須 online-only。 |
| 任務 CRUD | `/families/{familyId}/tasks` | 任務列表、任務明細、建立任務 | T-001 到 T-006 | 任務可指派單人、多人或開放完成，支援期限與發分模式。 | Partial | 重複任務、審核 UI 與資料持久化需補。 |
| 任務完成與發分 | `/tasks/{taskId}/complete`, `/tasks/{taskId}/review` | 完成任務、待審核佇列 | T-001 到 T-005 | auto 模式立即發分；review 模式審核者可發 0 到最高分。 | Partial | 必須和 point ledger 在同一一致性流程內處理。 |
| 積分餘額與流水 | `/points/balances`, `/points/me`, `/points/ledger` | 積分頁 | 積分流水測試 | 每個家庭獨立計分；所有加扣分都有流水。 | Partial | in-memory 會遺失資料；需 DB 持久化與不可跳過的 ledger write。 |
| 手動調分 | `/points/adjust` | 調分表單 | 調分權限測試 | 只有有權限者可調分，且必須填原因。 | Partial | 需確認 API 層權限與 audit log。 |
| 願望狀態機 | `/wishes`, `/accept`, `/reject`, `/price-proposals`, `/redeem`, `/complete` | 願望列表、願望明細、狀態時間線 | W-001 到 W-008 | 願望可按合法狀態流轉；非法轉移被拒絕。 | Partial | 狀態機需以測試鎖住，避免前端流程繞過。 |
| 願望兌換扣分 | `/wishes/{wishId}/redeem` | 兌換按鈕、待實現區 | W-006, W-007, W-008 | 積分不足不能兌換；兌換後扣分並等待實現者完成。 | Partial | 扣分與狀態變更需同 transaction。 |
| 通知中心 | `/notifications`, `/notifications/{id}/read`, `/notifications/read-all` | 通知中心 | N-001 到 N-005 | 主要事件會建立 App 內通知，使用者可標示已讀。 | Partial | 任務、積分、願望與預算超支已有 App 內通知；Web Push 訂閱保存/取消已有 MVP 基礎，尚未真正發送推播。 |
| Web Push | `/push/subscriptions` | 通知中心推播訂閱設定 | Push subscription route test + PWA worker test + smoke | 使用者可訂閱與取消 Web Push。 | Partial | 訂閱保存/取消與 service worker push handler 已有 MVP 基礎；尚需 VAPID key、真正推播發送器與瀏覽器權限 E2E。 |
| 預算 | `/budgets`, `/budgets/{budgetId}` | 報表頁預算區塊 | Budget unit/API tests + DB smoke | 支援月預算與自訂期間資料模型；超支仍可記帳，剩餘可顯示負數並建立通知。 | Partial | DB-backed CRUD/write path 已可用；前端編輯/刪除 UI 尚未完成。 |
| 報表 | `/reports/summary` | 報表頁 | S-001, S-002 | 可查看月支出分類、帳戶餘額、共用基金餘額。 | Partial | 報表頁已串 live API；資料仍需改由正式 DB 聚合。 |
| 匯出 | `/reports/export` | 匯出按鈕 | S-005, S-006 | 免費版阻擋匯出，付費版可匯出 CSV / Excel。 | Partial | CSV 與 Excel-compatible 匯出已有 API/UI/tests；正式 `.xlsx` 產生與 DB 聚合尚未完成。 |
| 方案限制 | `/plan`, `/plan/limits`, `/billing/checkout` | 方案頁、升級入口 | S-001 到 S-006 | 免費版成員/任務/願望/報表限制有效，付費版解鎖。 | Partial | MVP mock checkout 可升級解鎖；尚未接真正 billing provider / webhook。 |
| 廣告 | 方案 / 廣告設定 API | 首頁資訊流、報表頁底部、切頁廣告 | 廣告顯示測試 | 免費版顯示廣告，付費版不顯示廣告。 | Pending | 需避免干擾核心操作，也需後台管理。 |
| 主題 | 使用者 / 家庭偏好 API | 主題選擇器 | 主題 UI test | 主題 token 可切換，且響應式版面不破版。 | Partial | CSS token 有基礎，但尚未有正式 theme picker 與持久化。 |
| 管理後台 | `/admin/metrics`, `/admin/users`, `/admin/families`, `/admin/ads` | Admin UI | Admin API + access control | 管理員可看營運資料、封鎖帳號、管理廣告。 | Pending | 需獨立 admin auth 與 audit log。 |
| PWA 基礎 | `GET /manifest.webmanifest`, `GET /sw.js` | production service worker registration | PWA asset test + smoke script | manifest 可安裝、包含 icon/shortcut，service worker 快取核心 shell 且不快取 API。 | Partial | 已有基礎資產與測試；尚未用真瀏覽器完成 Lighthouse / installability 驗證。 |
| 整合測試 | API integration、E2E、PWA、security tests | 測試報告 | P/T/W/A/F/S/N cases | MVP 核心流程可在 CI 或本機穩定通過。 | Partial | `typecheck/lint/test/build/smoke/e2e/audit` 與 CI workflow 已建立；尚未建立正式 DB/Auth runtime 測試。 |
| 部署與備份 | `render.yaml`, `env:check`, `db:backup` | Runbook | Deployment smoke + backup command | 有部署藍圖、環境檢查、健康檢查與備份指令。 | Partial | Render Blueprint 與 pg_dump script 已有；正式 DB-backed runtime、監控與定期備份排程尚未完成。 |

## MVP 出口條件

MVP 不應只以「頁面存在」或「API route 存在」作為完成。至少需達到：

1. 核心資料不再依賴 in-memory store，重啟後資料仍存在。
2. Auth 不再只依賴 dev-only header 或手動假 session；正式版需具備 DB-backed session 與 password hash。
3. 權限在 API 層強制執行，並有繞過測試。
4. 個人記帳、共用基金、任務發分、願望兌換可完成端到端流程。
5. 積分、基金餘額、個人帳戶餘額更新具備一致性保證。
6. 免費/付費限制至少對報表與匯出生效。
7. 主要驗收測試 A/F/T/W/P/S/N 至少 MVP 子集通過。
8. PWA manifest / service worker 可由自動化 smoke script 驗證，並完成真瀏覽器安裝檢查。

## 主線整合順序建議

1. 先修復依賴、typecheck、test、build、smoke command，讓所有 agent 有共同驗證基線。
2. 將 in-memory store 替換為正式 DB repository/service，但保留 API contract。
3. 將 MVP auth/session 從 memory store 替換為正式 DB-backed session / password hash。
4. 串接前端 skeleton 與已存在 API routes。
5. 補齊 MVP 驗收測試，逐項把矩陣狀態從 Partial 推到 Pass。
## 2026-05-31 Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| DB deployment gate | Partial | `npm run db:validate`, `npm run db:migrate`, and `npm run db:check` are wired into CI; Render build verifies Prisma Client generation and Supabase DB connectivity. | Supabase production migrations are applied through Supabase MCP/CLI, so Render should not run Prisma migration deploy against the already-created schema unless migration history is baselined. |
| Production release safety | Partial | Deployment fails if migrations cannot be applied or Prisma cannot connect to `DATABASE_URL`. | Need DB-backed repositories, production auth/session persistence, monitoring, and real backup scheduling. |

## 2026-05-31 DB-Backed Money Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| MVP fixture identity | Partial | Memory runtime, frontend constants, smoke tests, and DB seed now share UUID fixture ids from `src/server/dev-fixtures.ts`. | Newly registered MVP users still use memory-generated ids until auth is DB-backed. |
| Personal accounting DB persistence | Partial | `FAMILY_OS_MONEY_DATA_SOURCE=database` enables Prisma-backed personal account and transaction operations; `npm run db:smoke:money` is wired into CI after seed. | Local DB smoke was not run in this workspace because no local PostgreSQL instance was verified; broader money-adjacent create/update/delete flows are still being migrated slice by slice. |

## 2026-05-31 Reports/Budgets Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| DB-backed report summary/export | Partial | `FAMILY_OS_REPORTS_DATA_SOURCE=database` enables Prisma-backed account balances, fund balances, and expense-by-category aggregation; report export reuses that summary. | Local DB smoke still depends on a real Postgres instance; report history windows and advanced report filters remain MVP-level. |
| DB-backed budget listing/write path | Partial | `FAMILY_OS_BUDGETS_DATA_SOURCE=database` enables Prisma-backed budget list, spent calculation, create, update, and delete; CI DB smoke verifies seeded Food budget spent remains category-scoped and exercises budget CRUD. | Budget edit/delete UI remains MVP-level. |
| Shared funds DB persistence | Partial | `FAMILY_OS_FUNDS_DATA_SOURCE=database` enables Prisma-backed shared fund listing/creation and fund transaction listing/creation; CI DB smoke verifies fund balance updates flow into DB-backed report fund balances. | Fund permissions and budget overage notifications are still not fully DB-backed. |
| Points DB persistence | Partial | `FAMILY_OS_POINTS_DATA_SOURCE=database` enables Prisma-backed point balance reads, ledger listing, and manual adjustments; CI DB smoke verifies balance and ledger updates. | Task award and wish redemption flows still need DB runtime integration with the same point ledger. |
| Task award DB persistence | Partial | `FAMILY_OS_TASKS_DATA_SOURCE=database` enables Prisma-backed task list/create/complete/review; CI DB smoke verifies auto task completion writes a task completion and point ledger award. | Task update/delete and full repeat-task lifecycle remain MVP-level; wish redemption still needs DB point integration. |
| Wish redemption DB persistence | Partial | `FAMILY_OS_WISHES_DATA_SOURCE=database` enables Prisma-backed wish list/create/status/price/redeem/complete flows; CI DB smoke verifies redemption deducts points and links a ledger entry to the redemption. | More detailed wish deletion consent and fulfiller/requester negotiation edge cases remain MVP-level. |
| Notifications DB persistence | Partial | `FAMILY_OS_NOTIFICATIONS_DATA_SOURCE=database` enables Prisma-backed app notification create/list/read/read-all and push subscription create/list/delete; CI DB smoke verifies notification persistence and push subscription storage. | Real Web Push delivery still requires VAPID senders and a background delivery path. |
| Auth/session DB persistence | Partial | `FAMILY_OS_AUTH_DATA_SOURCE=database` enables DB user registration/login, PBKDF2 password hashes, hashed cookie sessions, `/me` lookup, logout revocation, and child login through family membership; CI DB smoke verifies owner and child auth flows. | Production auth still needs account recovery, stricter password policy, session cleanup, and dev fallback removal outside MVP/local mode. |

## 2026-05-31 Admin / Monitoring Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| Admin guard | Partial | Admin APIs require `requireAdmin`; admin can be granted by env user id/email or seeded `users.is_admin`; non-admin route test returns 403. | Production needs a complete admin role lifecycle and removal of local seeded-admin assumptions. |
| Metrics and lists | Partial | `/api/v1/admin/metrics`, `/users`, and `/families` expose MVP aggregate counts and read-only lists for users, families, notifications, tasks, wishes, and transactions. | Needs pagination, search, richer operational filters, and DB smoke coverage against a live Postgres instance. |
| Ban/unban and audit | Partial | `/ban` and `/unban` update user ban state and write audit entries; DB auth rejects banned users. Route tests verify ban, unban, and audit history. | Needs user-facing ban messaging, admin self-protection policy beyond MVP, and operational review workflows. |
| Ads admin | Partial | `/api/v1/admin/ads` and `/admin` can toggle MVP ad placements and write audit entries. | Ad placement persistence is memory-backed MVP config; production needs a table/model and delivery integration. |

## 2026-05-31 Budget Write Path Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| DB-backed budget CRUD | Partial | Budget create/update/delete/list/spent use Prisma behind `FAMILY_OS_BUDGETS_DATA_SOURCE=database` or the global database flag; `npm run db:smoke:money` now verifies create, overage usage, update recalculation, and delete removal. | Frontend budget edit/delete controls remain MVP polish work. |
| DB-backed budget overage notifications | Partial | Personal and shared-fund expense creation trigger budget overage checks; when notifications DB runtime is enabled, overages create persisted `budget_exceeded` app notifications without blocking the transaction. | Real push delivery/background fanout still needs production Web Push work. |
## 2026-05-31 Web Push Delivery Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| Web Push sender path | Partial | VAPID-backed sender abstraction added; notification creation can attempt delivery to saved user subscriptions; focused unit tests verify mocked send, skipped no-VAPID behavior, and `404`/`410` expired subscription cleanup. | Browser permission E2E, delivery retry scheduling, and push provider observability remain future hardening. |

## 2026-05-31 Family/Permissions DB Runtime Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| Family and member DB persistence | Partial | `FAMILY_OS_FAMILIES_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database` enables Prisma-backed family list/create/get/update, member list/update/remove, and child account creation; memory/dev fixtures remain the default path. | Invite persistence is still MVP placeholder behavior, and child credentials need production policy/hardening. |
| Role and resource permission DB persistence | Partial | Added `family_role_permissions` migration/seed plus DB-backed effective permission checks, family-scoped role permission updates, member custom allow/deny permissions, and `resource_permissions` overrides behind `FAMILY_OS_PERMISSIONS_DATA_SOURCE=database` or the global flag. Focused Vitest coverage verifies DB composition and persistence calls. | API-level permission enforcement is not yet applied uniformly to every family/member mutation route. |

## 2026-05-31 Billing, Ads, and Theme Acceptance Update

| Area | Status | Evidence | Remaining Gap |
|---|---|---|---|
| Billing provider/webhook scaffold | Partial | `src/server/billing` defines provider checkout, signature validation, and webhook event contracts; `/api/v1/billing/webhook` applies mock checkout/subscription events. Focused Vitest coverage validates plan update and signature behavior. | Real Stripe/other provider adapter, provider event idempotency, and provider session persistence are not implemented yet. |
| Family plan persistence path | Partial | `FAMILY_OS_PLANS_DATA_SOURCE=database` or `FAMILY_OS_DATA_SOURCE=database` reads and updates `families.plan` through Prisma; memory runtime remains available for MVP/local tests. | Some family-adjacent runtime paths are still mixed memory/DB across slices. |
| Free-plan ads | Partial | Dashboard feed, report-bottom, and route-change interstitial placements render only when plan limits report `hasAds: true`. | Ad inventory is static MVP copy; admin-managed campaigns and frequency caps remain future work. |
| Theme picker gating | Partial | Billing page exposes Classic/Ocean/Sunset picker; paid-only themes are disabled until `canUseMultipleThemes` is true. | Theme preference is client-local MVP state, not yet persisted to user/family preferences. |
