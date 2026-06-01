# Family OS 後端規格

## 1. 後端目標

後端負責身份驗證、家庭隔離、權限判斷、資料一致性、積分流水、願望狀態機、通知、方案限制與管理後台能力。

所有敏感操作必須在後端重新驗證權限，不可依賴前端狀態。

## 2. 建議技術

- Runtime: Node.js
- Framework: NestJS 或 Next.js API Route
- Language: TypeScript
- Database: PostgreSQL
- ORM: Prisma / Drizzle
- Auth: JWT session 或 server session
- Queue: BullMQ / Cloud task queue，MVP 可先同步處理
- Notification: App 內通知表 + Web Push
- File storage: S3 / Supabase Storage，MVP 預留

## 3. 模組規格

### Auth Module

負責：

- 註冊
- 登入
- 登出
- session 驗證
- 兒童簡易帳號登入
- 目前使用者資訊

### Family Module

負責：

- 建立家庭
- 加入家庭
- 家庭切換
- 成員管理
- 兒童帳號建立
- 角色設定

### Permission Module

負責：

- 角色預設權限
- 資源權限覆寫
- 權限查詢
- API 操作授權

權限檢查輸入：

- `userId`
- `familyId`
- `resourceType`
- `resourceId`
- `action`

回傳：

- `allowed`
- `reason`
- `effectivePermissions`

### Personal Accounting Module

負責：

- 個人帳戶 CRUD
- 個人交易 CRUD
- 帳戶餘額重算
- 交易分類
- 分享層級設定
- 離線交易同步

資料一致性：

- 新增收入時增加帳戶餘額。
- 新增支出時減少帳戶餘額。
- 修改或刪除交易時需反向調整餘額。

### Shared Fund Module

負責：

- 共用基金 CRUD
- 基金權限設定
- 基金交易新增
- 基金餘額重算

資料一致性：

- 存入增加基金餘額。
- 支出減少基金餘額。
- 每次操作需記錄操作者。

### Budget & Report Module

負責：

- 預算 CRUD
- 月支出分類統計
- 帳戶餘額統計
- 共用基金餘額統計
- 免費版近 3 個月限制
- 付費版匯出

### Task Module

負責：

- 任務 CRUD
- 任務指派
- 任務完成
- 任務審核
- 重複任務生成
- 觸發積分發放

規則：

- 自動發分任務完成後立即建立積分流水。
- 審核發分任務完成後進入待審核。
- 審核者給分不得超過任務最高積分。

### Point Module

負責：

- 查詢家庭內成員積分
- 建立積分流水
- 手動調分
- 願望兌換扣分

規則：

- 積分以家庭為單位隔離。
- 所有加分、扣分、調整都必須寫入 `point_ledger`。
- 不允許直接改餘額而不留流水。

### Wish Module

負責：

- 願望提出
- 指定實現者
- 接受 / 駁回
- 定價提案
- 價格同意
- 價格修改
- 願望兌換
- 標記完成
- 願望取消

願望狀態轉移必須由後端集中管理。

### Notification Module

負責：

- 建立 App 內通知
- 標記已讀
- Web Push 訂閱
- Web Push 發送

通知事件：

- 任務被指派
- 任務待審核
- 積分被發放或調整
- 願望被接受 / 駁回
- 願望價格待同意
- 願望可兌換 / 已兌換
- 預算超支

### Billing & Plan Module

負責：

- 家庭方案
- 免費版限制
- 付費版功能解鎖
- 廣告顯示判斷
- 匯出權限判斷

### Admin Module

負責：

- 查看使用者數
- 查看家庭數
- 查看方案狀態
- 管理廣告設定
- 封鎖違規帳號
- 基本營運數據

## 4. 後端非功能需求

### 安全

- 所有 API 必須驗證 session。
- 所有家庭資料查詢必須帶 `familyId` 並驗證成員資格。
- 所有協作資源操作需驗證權限。
- 兒童帳號不可自行離開家庭或修改高權限設定。

### 一致性

- 金額與積分操作必須使用資料庫交易。
- 積分餘額可由流水彙總，也可保存快取欄位，但流水為準。
- 餘額欄位與交易紀錄需可重算。

### 稽核

以下操作需保留紀錄：

- 權限變更
- 基金交易
- 積分調整
- 願望價格變更
- 願望兌換
- 管理後台操作

## 5. 後端驗收條件

- 無權限者直接打 API 仍會被拒絕。
- 不同家庭資料無法互相讀取。
- 個人離線交易同步後不重複入帳。
- 任務自動發分與審核發分都正確產生積分流水。
- 願望狀態只能沿合法狀態轉移。
- 免費版限制在 API 層生效。
