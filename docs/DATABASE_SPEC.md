# Family OS 資料庫規格

## 1. 資料庫原則

- Database: PostgreSQL
- Primary key: UUID
- 金額欄位使用 `numeric(14,2)`
- 積分欄位使用 integer
- 時間欄位使用 `timestamptz`
- 軟刪除使用 `deleted_at`
- 所有協作資料需帶 `family_id`
- 所有重要操作需可稽核

## 2. Enum 建議

```sql
create type family_role as enum ('owner', 'admin', 'member', 'child', 'viewer');
create type money_transaction_type as enum ('income', 'expense');
create type fund_transaction_type as enum ('deposit', 'expense');
create type task_approval_mode as enum ('auto', 'review');
create type task_completion_status as enum ('pending_review', 'approved', 'rejected');
create type wish_status as enum (
  'submitted',
  'rejected',
  'pricing',
  'price_pending_requester',
  'active',
  'price_change_pending',
  'redeemed_pending_fulfillment',
  'completed',
  'cancelled'
);
create type plan_type as enum ('free', 'paid');
create type sharing_level as enum ('none', 'balance_only', 'category_summary', 'partial_transactions', 'full');
```

## 3. 核心資料表

### users

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 使用者 ID |
| name | text | 名稱 |
| email | text nullable unique | Email，兒童帳號可為 null |
| password_hash | text nullable | 密碼 hash |
| is_child_account | boolean | 是否兒童簡易帳號 |
| parent_user_id | uuid nullable | 建立此兒童帳號的家長 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

### families

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 家庭 ID |
| name | text | 家庭名稱 |
| plan | plan_type | 方案 |
| owner_user_id | uuid fk users.id | 擁有者 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

### family_members

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 成員 ID |
| family_id | uuid fk families.id | 家庭 |
| user_id | uuid fk users.id | 使用者 |
| role | family_role | 角色 |
| permissions | jsonb | 成員權限覆寫 |
| joined_at | timestamptz | 加入時間 |
| deleted_at | timestamptz nullable | 移除時間 |

唯一索引：

- `(family_id, user_id)` where `deleted_at is null`

### resource_permissions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | ID |
| family_id | uuid fk families.id | 家庭 |
| resource_type | text | 資源類型 |
| resource_id | uuid | 資源 ID |
| subject_type | text | user / role |
| subject_id | text | user id 或 role |
| permissions | jsonb | 權限內容 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |

### personal_accounts

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 帳戶 ID |
| user_id | uuid fk users.id | 擁有者 |
| name | text | 帳戶名稱 |
| type | text | cash / bank / e_wallet / other |
| balance | numeric(14,2) | 餘額 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

### personal_transactions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 交易 ID |
| account_id | uuid fk personal_accounts.id | 帳戶 |
| user_id | uuid fk users.id | 擁有者 |
| client_mutation_id | uuid nullable | 離線同步去重 |
| type | money_transaction_type | 收入 / 支出 |
| category_id | uuid nullable | 分類 |
| amount | numeric(14,2) | 金額 |
| note | text | 備註 |
| occurred_at | timestamptz | 發生時間 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

唯一索引：

- `(user_id, client_mutation_id)` where `client_mutation_id is not null`

### personal_sharing_settings

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | ID |
| user_id | uuid fk users.id | 分享者 |
| family_id | uuid fk families.id | 分享目標家庭 |
| sharing_level | sharing_level | 分享層級 |
| config | jsonb | 部分交易等設定 |
| updated_at | timestamptz | 更新時間 |

### shared_funds

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 基金 ID |
| family_id | uuid fk families.id | 家庭 |
| name | text | 基金名稱 |
| balance | numeric(14,2) | 餘額 |
| permissions | jsonb | 基金權限快取 |
| created_by | uuid fk users.id | 建立者 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

### fund_transactions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 交易 ID |
| family_id | uuid fk families.id | 家庭 |
| fund_id | uuid fk shared_funds.id | 基金 |
| actor_user_id | uuid fk users.id | 操作者 |
| type | fund_transaction_type | 存入 / 支出 |
| category_id | uuid nullable | 分類 |
| amount | numeric(14,2) | 金額 |
| note | text | 備註 |
| occurred_at | timestamptz | 發生時間 |
| created_at | timestamptz | 建立時間 |

### categories

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 分類 ID |
| family_id | uuid nullable | 家庭分類，null 表系統預設 |
| user_id | uuid nullable | 個人分類 |
| scope | text | personal / fund / both |
| type | text | income / expense |
| name | text | 分類名稱 |
| icon | text nullable | icon |
| created_at | timestamptz | 建立時間 |

### budgets

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 預算 ID |
| family_id | uuid nullable | 家庭預算 |
| user_id | uuid nullable | 個人預算 |
| target_type | text | personal_account / shared_fund / category |
| target_id | uuid nullable | 目標 ID |
| amount | numeric(14,2) | 預算金額 |
| period_type | text | monthly / custom |
| start_at | timestamptz | 起始 |
| end_at | timestamptz nullable | 結束 |
| created_at | timestamptz | 建立時間 |

### tasks

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 任務 ID |
| family_id | uuid fk families.id | 家庭 |
| title | text | 標題 |
| description | text | 說明 |
| max_points | integer | 最高積分 |
| approval_mode | task_approval_mode | 發分模式 |
| reviewer_user_id | uuid nullable | 審核者 |
| due_at | timestamptz nullable | 期限 |
| repeat_rule | text nullable | 重複規則 |
| created_by | uuid fk users.id | 建立者 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

### task_assignments

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | ID |
| task_id | uuid fk tasks.id | 任務 |
| user_id | uuid fk users.id | 指派對象 |

### task_completions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 完成紀錄 ID |
| task_id | uuid fk tasks.id | 任務 |
| completed_by | uuid fk users.id | 完成者 |
| status | task_completion_status nullable | 審核狀態 |
| awarded_points | integer nullable | 實發積分 |
| reviewed_by | uuid nullable | 審核者 |
| completed_at | timestamptz | 完成時間 |
| reviewed_at | timestamptz nullable | 審核時間 |

### point_ledger

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 流水 ID |
| family_id | uuid fk families.id | 家庭 |
| user_id | uuid fk users.id | 積分擁有者 |
| delta | integer | 變動量 |
| reason | text | 原因 |
| related_entity_type | text nullable | 關聯類型 |
| related_entity_id | uuid nullable | 關聯 ID |
| created_by | uuid fk users.id | 操作者 |
| created_at | timestamptz | 建立時間 |

### point_balances

| 欄位 | 型別 | 說明 |
|---|---|---|
| family_id | uuid fk families.id | 家庭 |
| user_id | uuid fk users.id | 使用者 |
| balance | integer | 目前積分 |
| updated_at | timestamptz | 更新時間 |

主鍵：

- `(family_id, user_id)`

### wishes

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 願望 ID |
| family_id | uuid fk families.id | 家庭 |
| requester_id | uuid fk users.id | 提出者 |
| fulfiller_id | uuid fk users.id | 實現者 |
| title | text | 標題 |
| description | text | 說明 |
| status | wish_status | 狀態 |
| agreed_points | integer nullable | 已同意價格 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 更新時間 |
| deleted_at | timestamptz nullable | 軟刪除 |

### wish_price_proposals

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 提案 ID |
| wish_id | uuid fk wishes.id | 願望 |
| proposed_by | uuid fk users.id | 提案者 |
| points | integer | 價格 |
| status | text | pending / approved / rejected |
| note | text | 備註 |
| created_at | timestamptz | 建立時間 |
| resolved_at | timestamptz nullable | 決議時間 |

### wish_redemptions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 兌換 ID |
| wish_id | uuid fk wishes.id | 願望 |
| family_id | uuid fk families.id | 家庭 |
| requester_id | uuid fk users.id | 兌換者 |
| points_spent | integer | 扣除積分 |
| redeemed_at | timestamptz | 兌換時間 |
| fulfilled_at | timestamptz nullable | 實現時間 |

### notifications

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | 通知 ID |
| user_id | uuid fk users.id | 接收者 |
| family_id | uuid nullable | 家庭 |
| type | text | 通知類型 |
| title | text | 標題 |
| body | text | 內容 |
| data | jsonb | 附加資料 |
| read_at | timestamptz nullable | 已讀時間 |
| created_at | timestamptz | 建立時間 |

### push_subscriptions

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | ID |
| user_id | uuid fk users.id | 使用者 |
| endpoint | text | push endpoint |
| keys | jsonb | p256dh / auth |
| created_at | timestamptz | 建立時間 |

### audit_logs

| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | ID |
| family_id | uuid nullable | 家庭 |
| actor_user_id | uuid nullable | 操作者 |
| action | text | 操作 |
| resource_type | text | 資源類型 |
| resource_id | uuid nullable | 資源 ID |
| before | jsonb nullable | 變更前 |
| after | jsonb nullable | 變更後 |
| created_at | timestamptz | 建立時間 |

## 4. 交易一致性要求

以下操作必須使用 database transaction：

- 新增 / 修改 / 刪除個人交易並更新個人帳戶餘額
- 新增基金交易並更新基金餘額
- 任務完成自動發分
- 任務審核發分
- 手動調整積分
- 願望兌換扣分並建立兌換紀錄
- 願望價格同意並更新願望狀態

## 5. 索引建議

- `family_members(family_id, user_id)`
- `personal_accounts(user_id)`
- `personal_transactions(account_id, occurred_at desc)`
- `personal_transactions(user_id, client_mutation_id)`
- `shared_funds(family_id)`
- `fund_transactions(fund_id, occurred_at desc)`
- `tasks(family_id, due_at)`
- `task_assignments(user_id)`
- `point_ledger(family_id, user_id, created_at desc)`
- `wishes(family_id, requester_id)`
- `wishes(family_id, fulfiller_id)`
- `notifications(user_id, read_at, created_at desc)`
