// Small chip showing which e-commerce platform the URL belongs to.
import { cn } from "@/lib/cn";

const STYLES: Record<string, string> = {
  noon:    "bg-yellow-100   text-yellow-800   border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/40",
  salla:   "bg-emerald-100  text-emerald-800  border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40",
  zid:     "bg-orange-100   text-orange-800   border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/40",
  shopify: "bg-lime-100     text-lime-800     border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-900/40",
  amazon_sa: "bg-amber-100  text-amber-900    border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40",
  namshi:  "bg-fuchsia-100  text-fuchsia-800  border-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:border-fuchsia-900/40",
  magento: "bg-orange-100   text-orange-900   border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/40",
  woocommerce: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40",
  bigcommerce: "bg-blue-100  text-blue-800    border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40",
  unknown: "bg-[var(--bg-elevated)] text-[var(--fg-muted)] border-[var(--border)]",
};

export function PlatformBadge({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  const style = STYLES[platform] || STYLES.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border",
        style,
        className
      )}
    >
      {platform === "amazon_sa" ? "amazon.sa" : platform}
    </span>
  );
}
