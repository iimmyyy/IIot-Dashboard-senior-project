"use client";
import {
  AlertCircle,
  Check,
  ChevronDown,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function Help({ text }: { text: string }) {
  return (
    <span className="help-wrap" tabIndex={0} role="note" aria-label={text}>
      <HelpCircle size={14} aria-hidden="true" />
      <span className="help-tooltip">{text}</span>
    </span>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger" | "teal";
}) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="empty-state">
      <AlertCircle size={26} />
      <h3>{title}</h3>
      <p>{message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RefreshCw size={15} />
          Try Again
        </Button>
      )}
    </div>
  );
}
export function Details({
  title,
  children,
  open,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="details" open={open}>
      <summary>
        {title}
        <ChevronDown size={16} />
      </summary>
      <div className="details-content">{children}</div>
    </details>
  );
}
export function Good({ children }: { children: React.ReactNode }) {
  return (
    <span className="good-text">
      <Check size={14} />
      {children}
    </span>
  );
}
