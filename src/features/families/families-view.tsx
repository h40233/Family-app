"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AuthForm } from "@/components/auth/auth-form";
import { ApiClientError, apiRequest, errorMessage } from "@/lib/api-client";

type Family = {
  id: string;
  name: string;
  plan: "free" | "paid";
  createdAt: string;
  updatedAt: string;
};

type FamilyMember = {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  role: "owner" | "admin" | "member" | "child" | "viewer";
  isChildAccount: boolean;
  family: Family;
};

type FamiliesResponse = {
  families: Family[];
};

type CreateFamilyResponse = {
  family: Family;
};

type JoinFamilyResponse = {
  member: FamilyMember;
};

type ViewState =
  | { status: "loading" }
  | { status: "auth"; message: string }
  | { status: "ready"; families: Family[] }
  | { status: "error"; message: string; families: Family[] };

export function FamiliesView() {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [createName, setCreateName] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedFamilyId, setCopiedFamilyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFamilies = useCallback(async () => {
    try {
      const response = await apiRequest<FamiliesResponse>("/api/v1/families");
      setState({ status: "ready", families: response.families });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setState({ status: "auth", message: "登入後才可以管理家庭。" });
        return;
      }

      setState((current) => ({
        status: "error",
        message: errorMessage(error),
        families: current.status === "ready" || current.status === "error" ? current.families : []
      }));
    }
  }, []);

  useEffect(() => {
    void loadFamilies();
  }, [loadFamilies]);

  async function handleCreateFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = createName.trim();
    if (!name) {
      setNotice("請輸入家庭名稱。");
      return;
    }

    setIsSubmitting(true);
    setNotice("");

    try {
      const response = await apiRequest<CreateFamilyResponse>("/api/v1/families", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      setCreateName("");
      setNotice(`已建立「${response.family.name}」。`);
      await loadFamilies();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoinFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = familyCode.trim();
    if (!code) {
      setNotice("請輸入家庭代碼。");
      return;
    }

    setIsSubmitting(true);
    setNotice("");

    try {
      const response = await apiRequest<JoinFamilyResponse>("/api/v1/families/join", {
        method: "POST",
        body: JSON.stringify({ familyCode: code })
      });
      setFamilyCode("");
      setNotice(`已加入「${response.member.family.name}」。`);
      await loadFamilies();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyFamilyCode(family: Family) {
    try {
      await navigator.clipboard.writeText(family.id);
      setCopiedFamilyId(family.id);
      setNotice(`已複製「${family.name}」的家庭代碼。`);
    } catch {
      setNotice("複製失敗，請手動選取家庭代碼。");
    }
  }

  if (state.status === "loading") {
    return (
      <>
        <PageHeader eyebrow="家庭" title="家庭管理" description="正在載入家庭資料。" />
        <section className="panel">
          <p className="page-description">載入中。</p>
        </section>
      </>
    );
  }

  if (state.status === "auth") {
    return (
      <>
        <PageHeader eyebrow="家庭" title="家庭管理" description={state.message} />
        <section className="panel">
          <h2>登入 / 建立帳號</h2>
          <AuthForm
            onAuthenticated={() => {
              void loadFamilies();
            }}
          />
        </section>
      </>
    );
  }

  const families = state.families;

  return (
    <>
      <PageHeader
        eyebrow="家庭"
        title="家庭管理"
        description="管理你加入的家庭與邀請代碼。"
        action={
          <button type="button" className="secondary-button" onClick={() => void loadFamilies()}>
            重新整理
          </button>
        }
      />

      {state.status === "error" ? <p className="error-text">{state.message}</p> : null}
      {notice ? <p className="success-text">{notice}</p> : null}

      <div className="content-grid">
        <section className="panel">
          <h2>我的家庭</h2>
          <div className="module-list">
            {families.length === 0 ? (
              <p className="muted">目前沒有家庭。</p>
            ) : (
              families.map((family) => (
                <div className="module-row family-row" key={family.id}>
                  <div>
                    <span>{family.name}</span>
                    <small>{family.plan === "paid" ? "付費方案" : "免費方案"}</small>
                    <code className="family-code">{family.id}</code>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void copyFamilyCode(family)}
                  >
                    {copiedFamilyId === family.id ? "已複製" : "複製代碼"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <h2>建立家庭</h2>
          <form className="stack-form" onSubmit={handleCreateFamily}>
            <label>
              家庭名稱
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="例如：林家"
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              建立
            </button>
          </form>

          <hr className="panel-divider" />

          <h2>加入家庭</h2>
          <form className="stack-form" onSubmit={handleJoinFamily}>
            <label>
              家庭代碼
              <input
                value={familyCode}
                onChange={(event) => setFamilyCode(event.target.value)}
                placeholder="貼上家庭代碼"
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              加入
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
