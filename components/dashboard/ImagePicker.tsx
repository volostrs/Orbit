"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link as LinkIcon, Trash2 } from "lucide-react";
import { type ImageRef, safeUrl } from "@/lib/dashboard/config";
import { ACCEPTED_TYPES, storeUploadedImage } from "@/lib/dashboard/images";
import { useToast } from "@/components/ui/toast";
import { DashImage } from "./DashImage";

export const field = "w-full rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-500";
const btn = "inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800";

// Upload / URL / fit / focal point / caption for an ImageRef. Removing the image keeps the widget and its other settings.
export function ImagePicker({ image, onChange, caption = true }: { image: ImageRef; onChange: (next: ImageRef) => void; caption?: boolean }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await storeUploadedImage(file);
      onChange({ ...image, source: { kind: "upload", id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add that image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const useUrl = () => {
    const safe = safeUrl(url);
    if (!safe) return toast("Enter a valid web address (http or https).");
    onChange({ ...image, source: { kind: "url", url: safe } });
    setUrl("");
  };

  return (
    <div className="space-y-2.5">
      {image.source && <DashImage image={image} className="h-28 w-full rounded-md" alt="Preview" />}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(",")} aria-label="Upload image file" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        <button type="button" className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" /> {image.source ? "Replace image" : "Upload image"}
        </button>
        {image.source && (
          <button type="button" className={`${btn} text-red-400`} onClick={() => onChange({ ...image, source: null })}>
            <Trash2 className="h-3.5 w-3.5" /> Remove image
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          className={field}
          aria-label="Image URL"
          placeholder="…or paste an image web address"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), useUrl())}
        />
        <button type="button" className={btn} onClick={useUrl}>
          <LinkIcon className="h-3.5 w-3.5" /> Use
        </button>
      </div>
      <p className="text-[11px] text-neutral-500">PNG, JPEG or WebP, up to 10 MB. Uploads are saved in this browser only.</p>
      {image.source && (
        <>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            Show
            {(["cover", "contain"] as const).map((fit) => (
              <button
                key={fit}
                type="button"
                aria-pressed={image.fit === fit}
                onClick={() => onChange({ ...image, fit })}
                className={`rounded-md border px-2 py-1 ${image.fit === fit ? "border-neutral-400 bg-neutral-800 text-neutral-100" : "border-neutral-700 hover:bg-neutral-800"}`}
              >
                {fit === "cover" ? "Fill (crop)" : "Fit whole image"}
              </button>
            ))}
          </div>
          {image.fit === "cover" && (
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
              <label htmlFor="fx">Left–right</label>
              <input id="fx" type="range" min={0} max={100} value={image.fx} onChange={(e) => onChange({ ...image, fx: Number(e.target.value) })} />
              <label htmlFor="fy">Up–down</label>
              <input id="fy" type="range" min={0} max={100} value={image.fy} onChange={(e) => onChange({ ...image, fy: Number(e.target.value) })} />
            </div>
          )}
        </>
      )}
      {caption && <input className={field} aria-label="Caption" placeholder="Caption (optional)" maxLength={200} value={image.caption} onChange={(e) => onChange({ ...image, caption: e.target.value })} />}
    </div>
  );
}
