// Product thumbnail with deterministic letter+color fallback.
// We don't use next/image here because product image URLs are external,
// often signed, and not on our allowed image domains. A plain <img> with
// loading=lazy keeps it simple.
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { ThumbImg } from "./ThumbImg";

const PALETTE = [
  ["bg-amber-100 text-amber-700",   "bg-amber-900/30 text-amber-300"],
  ["bg-rose-100  text-rose-700",    "bg-rose-900/30  text-rose-300"],
  ["bg-violet-100 text-violet-700", "bg-violet-900/30 text-violet-300"],
  ["bg-emerald-100 text-emerald-700","bg-emerald-900/30 text-emerald-300"],
  ["bg-blue-100  text-blue-700",    "bg-blue-900/30  text-blue-300"],
  ["bg-fuchsia-100 text-fuchsia-700","bg-fuchsia-900/30 text-fuchsia-300"],
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Thumb({
  name,
  src,
  size = 32,
  rounded = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  rounded?: "md" | "full";
  className?: string;
}) {
  const cls = cn(
    rounded === "full" ? "rounded-full" : "rounded-md",
    "flex-shrink-0 overflow-hidden bg-[var(--bg-elevated)] grid place-items-center text-[12px] font-semibold select-none",
    PALETTE[hashStr(name) % PALETTE.length][0],
    className
  );
  if (src) {
    return (
      <span className={cls} style={{ width: size, height: size }}>
        <ThumbImg src={src} size={size} />
      </span>
    );
  }
  return (
    <span className={cls} style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
