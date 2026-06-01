# Family OS 前端規格

## 1. 前端目標

Family OS 前端採 PWA 優先設計，一套介面支援桌機瀏覽器、手機瀏覽器、iOS 主畫面安裝、Android 主畫面安裝。

前端需優先滿足：

- 多家庭切換
- 角色與權限驅動 UI
- 個人記帳離線新增
- 協作功能線上操作
- App 內通知與 Web Push
- 免費 / 付費方案差異
- 可主題化 UI

## 2. 建議技術

- Framework: Next.js + React
- Language: TypeScript
- Styling: Tailwind CSS 或 CSS variables + component layer
- State: Zustand / TanStack Query
- Form: React Hook Form + Zod
- Chart: Recharts / ECharts
- PWA: next-pwa 或自定義 service worker
- Offline storage: IndexedDB，建議使用 Dexie
- Push: Web Push API

## 3. 路由規格

| Route | 頁面 | 權限 |
|---|---|---|
| `/` | 首頁 / Dashboard | 登入 |
| `/login` | 登入 | 未登入 |
| `/register` | 註冊 | 未登入 |
| `/families` | 家庭列表與切換 | 登入 |
| `/families/new` | 建立家庭 | 登入 |
| `/family/[familyId]/settings` | 家庭設定 | 管理權限 |
| `/family/[familyId]/members` | 成員管理 | 管理權限 |
| `/money/personal` | 個人記帳總覽 | 登入 |
| `/money/personal/accounts/[accountId]` | 個人帳戶交易 | 帳戶擁有者 |
| `/money/shared-funds` | 共用基金列表 | 基金查看權限 |
| `/money/shared-funds/[fundId]` | 共用基金明細 | 基金查看權限 |
| `/tasks` | 任務列表 | 家庭成員 |
| `/tasks/[taskId]` | 任務明細 | 相關成員 / 查看權限 |
| `/points` | 積分紀錄 | 家庭成員 |
| `/wishes` | 願望列表 | 家庭成員 |
| `/wishes/[wishId]` | 願望明細 | 相關成員 / 查看權限 |
| `/reports` | 報表 | 方案與權限 |
| `/notifications` | 通知中心 | 登入 |
| `/billing` | 方案與訂閱 | 家庭擁有者 |
| `/admin` | 管理後台 | 系統管理員 |

## 4. 主要畫面規格

### Dashboard

顯示目前家庭的概覽：

- 個人帳戶總餘額
- 可見共用基金餘額
- 待完成任務
- 待審核任務
- 目前積分
- 願望進度
- 最新通知
- 免費版廣告資訊流

### 家庭與成員管理

需支援：

- 建立家庭
- 切換家庭
- 邀請成員
- 建立兒童簡易帳號
- 設定角色
- 設定角色預設權限
- 覆寫特定資源權限

### 個人記帳

需支援：

- 建立個人帳戶
- 查看帳戶列表與餘額
- 查看單一帳戶交易
- 新增收入 / 支出
- 設定分類
- 設定分享層級
- 離線新增交易
- 顯示待同步交易狀態

離線 UX：

- 離線時仍可新增個人交易。
- 離線交易需標示「待同步」。
- 回網路後自動同步。
- 有待同步交易時，協作功能操作前需先提示同步。

### 共用基金

需支援：

- 建立基金
- 設定基金權限
- 查看基金餘額
- 查看基金交易
- 新增存入
- 新增支出
- 顯示操作者與備註

離線時：

- 不可新增、編輯、刪除共用基金交易。
- UI 顯示需連線操作。

### 任務

需支援：

- 建立任務
- 設定指派對象
- 設定最高積分
- 設定自動發分 / 審核發分
- 設定期限
- 設定重複規則
- 完成任務
- 審核任務並給 0 到最高積分

### 積分

需支援：

- 顯示目前家庭積分
- 顯示積分流水
- 依權限手動調分
- 手動調分時必填原因

### 願望

需支援：

- 提出願望
- 指定實現者
- 實現者接受 / 駁回
- 實現者提出定價
- 提出者同意 / 不同意價格
- 雙方提出改價
- 兌換願望
- 實現者標記完成
- 願望狀態時間軸

### 報表

MVP 報表：

- 月支出分類圓餅圖
- 帳戶餘額
- 共用基金餘額

免費版限制：

- 只能查看近 3 個月。
- 報表頁底部顯示廣告。

付費版：

- 支援進階報表入口。
- 支援 Excel / CSV 匯出。

## 5. 權限驅動 UI

前端必須根據 API 回傳的權限控制：

- 是否顯示入口
- 是否顯示操作按鈕
- 是否可送出表單
- 是否顯示敏感金額

注意：前端隱藏不是安全邊界，API 仍必須做完整權限驗證。

## 6. 主題系統

主題應使用設計 token：

- `color.background`
- `color.surface`
- `color.primary`
- `color.success`
- `color.warning`
- `color.danger`
- `font.family`
- `radius.base`
- `spacing.scale`
- `motion.enabled`

MVP 可提供：

- 預設簡潔溫馨
- 明亮專業
- 可愛親子
- 深色模式

付費版可解鎖更多主題。

## 7. PWA 規格

需包含：

- `manifest.webmanifest`
- App icon
- Service worker
- App shell cache
- IndexedDB 離線交易佇列
- Web Push 訂閱流程

快取策略：

- 靜態資源使用 cache-first。
- API 資料使用 network-first。
- 個人離線交易寫入 IndexedDB，不直接依賴快取。

## 8. 前端驗收條件

- 使用者可以在手機與桌機正常操作核心流程。
- 離線時只能新增個人記帳，協作功能不可操作。
- 權限不足時，不顯示或禁用相應操作。
- 所有表單都有欄位驗證與錯誤訊息。
- 免費版看到廣告與功能限制。
- 付費版不顯示廣告，且可進入匯出功能。
