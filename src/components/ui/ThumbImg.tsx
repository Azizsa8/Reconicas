"use client";

// Tiny client island for the actual <img> with an onError handler. Kept
// separate from Thumb so the letter-fallback path stays a Server Component.

export function ThumbImg({
  src,
  size,
}: {
  src: string;
  size: number;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      className="w-full h-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
