"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { AuthForm } from "@/components/auth/auth-form";

export function LoginView() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        eyebrow="帳號"
        title="登入家庭 OS"
        description="登入後即可查看家庭、記帳、任務、點數與願望資料。"
      />

      <section className="panel">
        <h2>登入 / 建立帳號</h2>
        <p className="page-description">測試帳號可使用 dev@family-os.local / pass1234。</p>
        <AuthForm
          onAuthenticated={() => {
            router.push("/");
            router.refresh();
          }}
        />
      </section>
    </>
  );
}
