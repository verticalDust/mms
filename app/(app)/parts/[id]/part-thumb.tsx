"use client";

import { useState } from "react";
import { Package } from "lucide-react";

// Renders the part photo, degrading to a neutral placeholder (not a broken-image
// glyph) if the file is missing — e.g. the DB was restored but the uploads volume
// is empty. Client component so it can catch the <img> onError.
export function PartThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300"
        aria-hidden
      >
        <Package className="h-6 w-6" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
    />
  );
}
