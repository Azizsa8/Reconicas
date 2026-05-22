// Shared placeholder for routes still pending design from later PRDs.
import Link from "next/link";

export function Placeholder({
  title,
  prdId,
  href,
}: {
  title: string;
  prdId: string;
  href?: { back: string; label: string };
}) {
  return (
    <div className="px-6 py-10 max-w-3xl">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-[var(--fg-muted)] mt-2">
        UI design is pending PRD <span className="font-mono">{prdId}</span>. The
        backend wiring is ready; this screen will be implemented once the design
        deliverable arrives.
      </p>
      {href && (
        <Link href={href.back} className="btn btn-secondary mt-6 inline-flex">
          ← {href.label}
        </Link>
      )}
    </div>
  );
}
