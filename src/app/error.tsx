"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="card empty-state">
      <h1>This page could not be loaded</h1>
      <p>Your experiment has not been changed. Try loading the page again.</p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
