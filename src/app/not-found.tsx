import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card empty-state">
      <h1>Page not found</h1>
      <p>Choose a page from the navigation or return to your overview.</p>
      <Link className="button button-primary" href="/dashboard">
        Return to Overview
      </Link>
    </div>
  );
}
