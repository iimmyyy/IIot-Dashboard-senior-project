"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  Radio,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { useMonitor } from "@/hooks/use-monitor";
import { Button } from "@/components/ui/button";
import { cn, dateTime } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/trends", label: "Temperature Trends", icon: ChartNoAxesCombined },
  { href: "/experiments", label: "Experiment History", icon: FlaskConical },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/system", label: "System Status", icon: Server },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode, alerts, now, status } = useMonitor();
  const [guide, setGuide] = useState(false);
  const unacknowledged =
    alerts.data?.filter((a) => !a.acknowledged_at && !a.resolved_at).length ??
    0;
  const page = navigation.find((n) => n.href === pathname);
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
        <div className="workspace-label">WORKSPACE</div>
        <div className="lab-switch">
          <span className="lab-icon">
            <FlaskConical size={17} />
          </span>
          <span>
            <strong>Biodrying Laboratory</strong>
            <small>Research workspace</small>
          </span>
          <ChevronRight size={14} />
        </div>
        <div className="workspace-label navigation-label">MONITORING</div>
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
        <div className="sidebar-bottom">
          <div className="monitor-only">
            <ShieldCheck size={19} />
            <strong>Observe. Understand. Decide.</strong>
            <p>
              Monitoring and decision support.
              <br />
              Physical operation stays with you.
            </p>
          </div>
          <button className="guide-link" onClick={() => setGuide(!guide)}>
            <BookOpen size={18} />
            Quick start guide
            <ArrowUpRight size={15} />
          </button>
          <div className="lab-profile">
            <span className="avatar">BL</span>
            <span>
              <strong>Biodrying Lab</strong>
              <small>Research & development</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <span>{page?.label ?? "Overview"}</span>
          </div>
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
            <span className="avatar small">BL</span>
          </div>
        </header>
        {mode === "demo" ? (
          <div className="demo-banner">
            <span>
              <FlaskConical size={15} />
              <strong>Demo Mode — Simulated Data</strong>
              <span className="demo-explanation">
                Explore the workspace with sample experiments.
              </span>
            </span>
            <Link href="/system">
              About this demo <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="live-banner">
            <Radio size={15} />
            <strong>Live Data</strong>
            <span>{status}</span>
          </div>
        )}
        <main id="main-content">{children}</main>
        <footer className="footer">
          <span>
            <Activity size={13} />
            Biodrying Monitoring & Decision Support
          </span>
          <span>
            {now ? dateTime(now) : "Loading time…"} ICT{" "}
            <span className="footer-separator">·</span> Phase 1
          </span>
        </footer>
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
          <p>Three sensor zones. One connected chamber.</p>
          <ol>
            <li>
              <strong>Read the temperatures.</strong> Top, Middle, and Bottom
              show the same chamber at different heights. A dash means the
              reading is unavailable.
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
