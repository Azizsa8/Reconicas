import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combine clsx + tailwind-merge — Tailwind class names that conflict are deduped
// by twMerge keeping the latest, so `cn("p-2", isLarge && "p-4")` Just Works.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
