"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";

type ApiEnvelope<T> = { data: T };
type AppNotification = { id: string; title: string; body: string; type: string; readAt?: string; createdAt: string };
type PushSubscriptionRecord = { id: string; endpoint: string; createdAt: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error("請求失敗。");
  return body.data;
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionRecord[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [notificationData, subscriptionData] = await Promise.all([
        api<AppNotification[]>("/api/v1/notifications"),
        api<PushSubscriptionRecord[]>("/api/v1/push/subscriptions")
      ]);
      setNotifications(notificationData);
      setSubscriptions(subscriptionData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法載入通知。");
    }
  }

  async function markAllRead() {
    setMessage("");
    await api<{ updated: number }>("/api/v1/notifications", { method: "POST" });
    await load();
  }

  async function subscribePush() {
    setMessage("");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("此瀏覽器不支援 Web Push。");
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) {
      setMessage("請先設定 NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY 才能訂閱推播。");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    await api<PushSubscriptionRecord>("/api/v1/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON())
    });
    await load();
  }

  async function unsubscribePush(subscriptionId: string) {
    setMessage("");
    await api(`/api/v1/push/subscriptions/${subscriptionId}`, { method: "DELETE" });
    await load();
  }

  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <>
      <PageHeader
        eyebrow="通知"
        title="通知中心"
        description="查看任務、點數、願望、預算與 Web Push 推播訂閱狀態。"
        action={
          <div className="topbar-action">
            <button type="button" onClick={markAllRead}>全部已讀</button>
            <button type="button" onClick={subscribePush}>啟用推播</button>
          </div>
        }
      />
      {message ? <p className="error-text">{message}</p> : null}
      <div className="summary-grid">
        <article><p>全部</p><strong>{notifications.length}</strong></article>
        <article><p>未讀</p><strong>{unread}</strong></article>
        <article><p>已讀</p><strong>{notifications.length - unread}</strong></article>
        <article><p>推播裝置</p><strong>{subscriptions.length}</strong></article>
      </div>
      <div className="content-grid">
        <section className="panel">
          <h2>App 通知</h2>
          <div className="module-list">
            {notifications.map((notification) => (
              <div className="module-row" key={notification.id}>
                <span>{notification.title}</span>
                <small>{notification.body} / {notification.readAt ? "已讀" : "未讀"}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Web Push 訂閱</h2>
          <div className="module-list">
            {subscriptions.length === 0 ? (
              <div className="module-row">
                <span>尚未訂閱任何瀏覽器</span>
                <small>設定公開 VAPID key 後即可啟用推播。</small>
              </div>
            ) : null}
            {subscriptions.map((subscription) => (
              <div className="module-row" key={subscription.id}>
                <span>{new URL(subscription.endpoint).hostname}</span>
                <button type="button" onClick={() => unsubscribePush(subscription.id)}>移除</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}
