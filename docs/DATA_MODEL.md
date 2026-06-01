# Family OS 核心資料模型

## 1. ER 圖

```mermaid
erDiagram
    USER ||--o{ FAMILY_MEMBER : joins
    FAMILY ||--o{ FAMILY_MEMBER : has
    FAMILY ||--o{ SHARED_FUND : owns
    FAMILY ||--o{ TASK : owns
    FAMILY ||--o{ WISH : owns
    FAMILY ||--o{ POINT_LEDGER : owns

    USER ||--o{ PERSONAL_ACCOUNT : owns
    PERSONAL_ACCOUNT ||--o{ PERSONAL_TRANSACTION : has

    SHARED_FUND ||--o{ FUND_TRANSACTION : has

    TASK ||--o{ TASK_ASSIGNMENT : assigns
    TASK ||--o{ TASK_COMPLETION : completes

    WISH ||--o{ WISH_PRICE_PROPOSAL : has
    WISH ||--o{ WISH_REDEMPTION : redeems

    USER {
        uuid id
        string name
        string email
        boolean is_child_account
    }

    FAMILY {
        uuid id
        string name
        string plan
    }

    FAMILY_MEMBER {
        uuid id
        uuid user_id
        uuid family_id
        string role
        json permissions
    }

    PERSONAL_ACCOUNT {
        uuid id
        uuid user_id
        string name
        string type
        decimal balance
    }

    PERSONAL_TRANSACTION {
        uuid id
        uuid account_id
        string type
        string category
        decimal amount
        string note
        datetime occurred_at
    }

    SHARED_FUND {
        uuid id
        uuid family_id
        string name
        decimal balance
        json permissions
    }

    FUND_TRANSACTION {
        uuid id
        uuid fund_id
        uuid actor_user_id
        string type
        string category
        decimal amount
        string note
        datetime occurred_at
    }

    TASK {
        uuid id
        uuid family_id
        string title
        int max_points
        string approval_mode
        string repeat_rule
        datetime due_at
    }

    WISH {
        uuid id
        uuid family_id
        uuid requester_id
        uuid fulfiller_id
        string title
        string status
        int agreed_points
    }

    POINT_LEDGER {
        uuid id
        uuid family_id
        uuid user_id
        int delta
        string reason
        uuid related_entity_id
        datetime created_at
    }
```

## 2. 主要實體說明

### USER

代表一個使用者。可為一般帳號或家長建立的兒童簡易帳號。

### FAMILY

代表一個家庭空間。所有協作資料都隸屬於某個家庭。

### FAMILY_MEMBER

代表使用者與家庭的關係。包含角色與權限覆寫。

### PERSONAL_ACCOUNT

代表個人記帳本底下的資產帳戶，例如現金、銀行 A、電子支付。

### PERSONAL_TRANSACTION

代表個人帳戶中的收入或支出。每筆交易必須屬於一個帳戶。

### SHARED_FUND

代表家庭共用基金。App 只記錄基金餘額與交易，不綁定真實銀行帳戶。

### FUND_TRANSACTION

代表基金存入或支出。需記錄操作者與備註。

### TASK

代表家庭任務。包含最高積分、發分模式、期限與重複規則。

### TASK_ASSIGNMENT

代表任務指派對象。任務可指派單人、多人，或不指定。

### TASK_COMPLETION

代表任務完成與審核狀態。

### POINT_LEDGER

代表積分流水。任何加分、扣分、手動調整都必須產生紀錄。

### WISH

代表願望。由提出者建立，可指定實現者。

### WISH_PRICE_PROPOSAL

代表願望價格提案。價格修改需雙方同意。

### WISH_REDEMPTION

代表願望兌換紀錄。兌換後扣除積分，等待實現者完成。

## 3. 願望狀態機

```mermaid
stateDiagram-v2
    [*] --> Submitted
    Submitted --> Rejected
    Submitted --> Pricing
    Pricing --> PricePendingRequester
    PricePendingRequester --> Active
    PricePendingRequester --> Cancelled
    Active --> PriceChangePending
    PriceChangePending --> Active
    Active --> RedeemedPendingFulfillment
    RedeemedPendingFulfillment --> Completed
    Active --> Cancelled
    Rejected --> [*]
    Completed --> [*]
    Cancelled --> [*]
```
