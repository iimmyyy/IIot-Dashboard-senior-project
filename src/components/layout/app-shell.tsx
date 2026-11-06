"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  LogOut,
  Radio,
  Server,
  X,
} from "lucide-react";
import { useState } from "react";
import { useMonitor } from "@/hooks/use-monitor";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { useCurrentUser } from "@/features/auth/auth-context";
import { roleLabels } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/trends", label: "Temperature Trends", icon: ChartNoAxesCombined },
  { href: "/daily-records", label: "Daily Records", icon: ClipboardList },
  { href: "/experiments", label: "Experiment History", icon: FlaskConical },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/system", label: "System Status", icon: Server },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const { mode, alerts, status } = useMonitor();
  const [guide, setGuide] = useState(false);
  const unacknowledged =
    alerts.data?.filter((a) => !a.acknowledged_at && !a.resolved_at).length ??
    0;
  const initials = user.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="BioDry home">
          <span className="brand-mark">
            <Leaf size={23} strokeWidth={1.8} />
          </span>
          <span>
            BioDry<span className="brand-sub">RESEARCH MONITOR</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn("nav-link", pathname === item.href && "active")}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.href === "/alerts" && unacknowledged > 0 && (
                <span className="nav-count">{unacknowledged}</span>
              )}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-right">
            <span className="timezone">Bangkok · UTC+7</span>
            <button
              className="notification-button guide-topbar"
              aria-label="Quick start guide"
              onClick={() => setGuide(!guide)}
            >
              <BookOpen size={18} />
            </button>
            <Link
              className="notification-button"
              href="/alerts"
              aria-label={`Alerts, ${unacknowledged} unread`}
            >
              <Bell size={19} />
              {unacknowledged > 0 && <i />}
            </Link>
            <div className="current-user">
              <span className="avatar small" aria-hidden="true">
                {initials}
              </span>
              <span className="current-user-copy">
                <strong>{user.displayName}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="notification-button logout-button"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={17} />
                </button>
              </form>
            </div>
          </div>
        </header>
        {mode === "demo" ? (
          <div className="demo-banner">
            <span>
              <FlaskConical size={15} />
              <strong>Demo data</strong>
            </span>
          </div>
        ) : (
          <div className="live-banner">
            <Radio size={15} />
            <strong>Live Data</strong>
            <span>{status}</span>
          </div>
        )}
        <main id="main-content">{children}</main>
      </div>
      {guide && (
        <section className="guide-panel" aria-label="Quick start guide">
          <div className="card-heading">
            <h2>Your lab, at a glance</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close guide"
              onClick={() => setGuide(false)}
            >
              <X size={18} />
            </Button>
          </div>
          <p>
            L1/L2/L3 are prototype data selections with an unconfirmed hardware
            mapping. The verified physical system is one reactor with Top,
            Middle, and Bottom zones and one shared blower.
          </p>
          <ol>
            <li>
              <strong>Read the temperatures.</strong> Top, Middle, and Bottom
              show vertical zones in the selected prototype dataset. A dash
              means the reading is unavailable.
            </li>
            <li>
              <strong>Explore the history.</strong> Choose a time range or
              select an earlier experiment. Select a chart legend to hide or
              show a sensor.
            </li>
            <li>
              <strong>Review alerts.</strong> Amber asks for attention. Red
              calls for prompt review. Acknowledging records that you have read
              the alert; it does not resolve the issue.
            </li>
            <li>
              <strong>You make the decisions.</strong> This app does not control
              the blower. Criterion T alone does not establish whether aeration
              should stop.
            </li>
          </ol>
          <p className="muted">
            All displayed times use Bangkok time (ICT, UTC+7).
          </p>
        </section>
      )}
    </div>
  );
}
