# Family OS API 規格

## 1. API 原則

- Base URL: `/api/v1`
- Format: JSON
- Auth: Bearer token 或 session cookie
- 所有需要家庭上下文的 API 必須帶 `familyId`。
- 所有金額使用 decimal 字串，避免浮點誤差。
- 所有時間使用 ISO 8601。

## 2. 通用回應格式

成功：

```json
{
  "data": {},
  "meta": {}
}
```

失敗：

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action.",
    "details": {}
  }
}
```

## 3. Auth API

| Method | Path | 說明 |
|---|---|---|
| POST | `/auth/register` | 註冊 |
| POST | `/auth/login` | 登入 |
| POST | `/auth/logout` | 登出 |
| GET | `/auth/me` | 取得目前使用者 |
| POST | `/auth/child-login` | 兒童簡易帳號登入 |

## 4. Family API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families` | 取得使用者加入的家庭 |
| POST | `/families` | 建立家庭 |
| GET | `/families/{familyId}` | 取得家庭資訊 |
| PATCH | `/families/{familyId}` | 更新家庭資訊 |
| GET | `/families/{familyId}/members` | 取得成員 |
| POST | `/families/{familyId}/members/invite` | 邀請成員 |
| POST | `/families/{familyId}/members/children` | 建立兒童簡易帳號 |
| PATCH | `/families/{familyId}/members/{memberId}` | 更新角色或權限 |
| DELETE | `/families/{familyId}/members/{memberId}` | 移除成員 |

## 5. Permission API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/permissions/me` | 取得目前使用者有效權限 |
| GET | `/families/{familyId}/permissions/roles` | 取得角色權限 |
| PATCH | `/families/{familyId}/permissions/roles/{role}` | 更新角色權限 |
| GET | `/families/{familyId}/resources/{resourceType}/{resourceId}/permissions` | 取得資源權限 |
| PATCH | `/families/{familyId}/resources/{resourceType}/{resourceId}/permissions` | 更新資源權限 |

## 6. Personal Accounting API

| Method | Path | 說明 |
|---|---|---|
| GET | `/personal/accounts` | 取得個人帳戶 |
| POST | `/personal/accounts` | 建立個人帳戶 |
| PATCH | `/personal/accounts/{accountId}` | 更新個人帳戶 |
| DELETE | `/personal/accounts/{accountId}` | 刪除個人帳戶 |
| GET | `/personal/accounts/{accountId}/transactions` | 取得帳戶交易 |
| POST | `/personal/accounts/{accountId}/transactions` | 新增交易 |
| PATCH | `/personal/transactions/{transactionId}` | 更新交易 |
| DELETE | `/personal/transactions/{transactionId}` | 刪除交易 |
| PATCH | `/personal/sharing/{familyId}` | 更新對家庭的分享層級 |
| POST | `/personal/offline-sync` | 同步離線交易 |

新增交易 request：

```json
{
  "clientMutationId": "uuid-from-client",
  "type": "expense",
  "categoryId": "category-id",
  "amount": "80",
  "note": "早餐",
  "occurredAt": "2026-05-31T08:00:00+08:00"
}
```

## 7. Shared Fund API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/funds` | 取得可見基金 |
| POST | `/families/{familyId}/funds` | 建立基金 |
| GET | `/families/{familyId}/funds/{fundId}` | 取得基金明細 |
| PATCH | `/families/{familyId}/funds/{fundId}` | 更新基金 |
| DELETE | `/families/{familyId}/funds/{fundId}` | 刪除基金 |
| GET | `/families/{familyId}/funds/{fundId}/transactions` | 取得基金交易 |
| POST | `/families/{familyId}/funds/{fundId}/transactions` | 新增基金交易 |

新增基金交易 request：

```json
{
  "type": "deposit",
  "categoryId": "category-id",
  "amount": "1000",
  "note": "爸爸存入",
  "occurredAt": "2026-05-31T12:00:00+08:00"
}
```

## 8. Budget & Report API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/budgets` | 取得預算 |
| POST | `/families/{familyId}/budgets` | 建立預算 |
| PATCH | `/families/{familyId}/budgets/{budgetId}` | 更新預算 |
| DELETE | `/families/{familyId}/budgets/{budgetId}` | 刪除預算 |
| GET | `/families/{familyId}/reports/monthly-expense-by-category` | 月支出分類圓餅圖 |
| GET | `/families/{familyId}/reports/account-balances` | 帳戶餘額 |
| GET | `/families/{familyId}/reports/fund-balances` | 共用基金餘額 |
| GET | `/families/{familyId}/reports/export` | 匯出 Excel / CSV |

## 9. Task API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/tasks` | 取得任務 |
| POST | `/families/{familyId}/tasks` | 建立任務 |
| GET | `/families/{familyId}/tasks/{taskId}` | 取得任務明細 |
| PATCH | `/families/{familyId}/tasks/{taskId}` | 更新任務 |
| DELETE | `/families/{familyId}/tasks/{taskId}` | 刪除任務 |
| POST | `/families/{familyId}/tasks/{taskId}/complete` | 完成任務 |
| POST | `/families/{familyId}/tasks/{taskId}/review` | 審核任務 |

建立任務 request：

```json
{
  "title": "倒垃圾",
  "description": "",
  "assigneeIds": ["user-id"],
  "maxPoints": 10,
  "approvalMode": "auto",
  "dueAt": "2026-06-01T20:00:00+08:00",
  "repeatRule": "FREQ=WEEKLY;BYDAY=MO"
}
```

審核任務 request：

```json
{
  "completionId": "completion-id",
  "approved": true,
  "points": 8,
  "note": "完成度不錯"
}
```

## 10. Point API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/points/balances` | 取得家庭成員積分 |
| GET | `/families/{familyId}/points/me` | 取得自己的積分 |
| GET | `/families/{familyId}/points/ledger` | 取得積分流水 |
| POST | `/families/{familyId}/points/adjust` | 手動調整積分 |

手動調分 request：

```json
{
  "userId": "user-id",
  "delta": 100,
  "reason": "特殊獎勵"
}
```

## 11. Wish API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/wishes` | 取得願望列表 |
| POST | `/families/{familyId}/wishes` | 提出願望 |
| GET | `/families/{familyId}/wishes/{wishId}` | 願望明細 |
| DELETE | `/families/{familyId}/wishes/{wishId}` | 提出者刪除願望 |
| POST | `/families/{familyId}/wishes/{wishId}/accept` | 實現者接受 |
| POST | `/families/{familyId}/wishes/{wishId}/reject` | 實現者駁回 |
| POST | `/families/{familyId}/wishes/{wishId}/price-proposals` | 提出定價或改價 |
| POST | `/families/{familyId}/wishes/{wishId}/price-proposals/{proposalId}/approve` | 同意價格 |
| POST | `/families/{familyId}/wishes/{wishId}/price-proposals/{proposalId}/reject` | 拒絕價格 |
| POST | `/families/{familyId}/wishes/{wishId}/redeem` | 兌換願望 |
| POST | `/families/{familyId}/wishes/{wishId}/complete` | 實現者標記完成 |

提出願望 request：

```json
{
  "title": "RTX 5090",
  "description": "爸爸的願望",
  "fulfillerId": "user-id"
}
```

提出定價 request：

```json
{
  "points": 50000,
  "note": "成交價"
}
```

## 12. Notification API

| Method | Path | 說明 |
|---|---|---|
| GET | `/notifications` | 通知列表 |
| PATCH | `/notifications/{notificationId}/read` | 標記已讀 |
| POST | `/notifications/read-all` | 全部標記已讀 |
| POST | `/push/subscriptions` | 建立 Web Push 訂閱 |
| DELETE | `/push/subscriptions/{subscriptionId}` | 取消 Web Push 訂閱 |

## 13. Billing API

| Method | Path | 說明 |
|---|---|---|
| GET | `/families/{familyId}/plan` | 取得方案 |
| GET | `/families/{familyId}/plan/limits` | 取得限制 |
| POST | `/families/{familyId}/billing/checkout` | 建立付款流程 |
| POST | `/billing/webhook` | 付款 webhook |

## 14. Admin API

| Method | Path | 說明 |
|---|---|---|
| GET | `/admin/metrics` | 營運數據 |
| GET | `/admin/users` | 使用者列表 |
| GET | `/admin/families` | 家庭列表 |
| PATCH | `/admin/users/{userId}/ban` | 封鎖使用者 |
| GET | `/admin/ads` | 廣告設定 |
| PATCH | `/admin/ads/{adId}` | 更新廣告設定 |
## Web Push Delivery Notes

- App notifications may trigger Web Push delivery to the recipient user's saved subscriptions.
- If VAPID env vars are missing in local/test, delivery is skipped and in-app notification creation still succeeds.
- Push endpoints returning `404` or `410` are treated as expired subscriptions and removed.
- Push network errors are recorded in the delivery summary and do not block in-app notification creation.
