"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import type { ImageRef } from "@/lib/dashboard/config";
import { getImage } from "@/lib/dashboard/images";

// Renders an ImageRef: uploads come from this browser's IndexedDB, URLs load directly. A failed or missing
// image shows a quiet placeholder instead of a broken icon.
export function DashImage({ image, className = "", alt = "" }: { image: ImageRef; className?: string; alt?: string }) {
  const src = image.source;
  const uploadId = src?.kind === "upload" ? src.id : null;
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    let revoke: string | null = null;
    let live = true;
    getImage(uploadId)
      .then((blob) => {
        if (!live) return;
        revoke = blob ? URL.createObjectURL(blob) : null;
        setLoaded({ id: uploadId, url: revoke });
      })
      .catch(() => live && setLoaded({ id: uploadId, url: null }));
    return () => {
      live = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [uploadId]);

  const url = src?.kind === "url" ? src.url : loaded?.id === uploadId ? loaded?.url : undefined;
  const pending = src?.kind === "upload" && loaded?.id !== uploadId;
  const box = `relative overflow-hidden ${className}`;

  if (!src) return null;
  if (pending) return <div className={`${box} animate-pulse bg-neutral-800/60`} aria-busy="true" />;
  if (!url || failed === url) {
    return (
      <div className={`${box} flex flex-col items-center justify-center gap-1 bg-neutral-800/50 p-3 text-center text-xs text-neutral-500`} data-image-fallback="true">
        <ImageOff className="h-5 w-5" />
        {src.kind === "upload" ? "Image not available in this browser" : "Image couldn't be loaded"}
      </div>
    );
  }
  return (
    <div className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(url)}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: image.fit, objectPosition: `${image.fx}% ${image.fy}%` }}
      />
    </div>
  );
}
