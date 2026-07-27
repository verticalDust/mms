"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2, X, ImageOff } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export type JobPhoto = {
  id: number;
  uploader: string;
  when: string;
  canRemove: boolean;
};

// Job photo gallery (E3-S7): thumbnails that open full-screen, multi-upload from
// camera or gallery (client-compressed), and per-photo remove for the uploader.
export function JobPhotos({
  workOrderId,
  photos,
  canEdit,
  max,
}: {
  workOrderId: number;
  photos: JobPhoto[];
  canEdit: boolean;
  max: number;
}) {
  const router = useRouter();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<JobPhoto | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [broken, setBroken] = useState<Set<number>>(new Set());
  const closeRef = useRef<HTMLButtonElement>(null);

  // Lightbox keyboard + focus a11y: Escape closes it, focus moves to the Close
  // button on open and returns to whatever opened it on close.
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [active]);

  const uploadUrl = `/work-orders/${workOrderId}/photos`;
  const photoUrl = (id: number) => `${uploadUrl}/${id}`;
  const full = photos.length >= max;

  async function onFiles(files: FileList) {
    setError(null);
    setBusy(true);
    let uploaded = 0;
    try {
      const room = max - photos.length;
      const picked = Array.from(files).slice(0, Math.max(room, 0));
      if (picked.length === 0) {
        setError(t.workOrders.photosMaxPerJob(max));
        return;
      }
      for (const file of picked) {
        const blob = await compress(file, {
          processFail: t.workOrders.imageProcessFailed,
          readFail: t.workOrders.imageReadFailed,
        });
        const fd = new FormData();
        fd.append("photo", blob, "photo.jpg");
        const res = await fetch(uploadUrl, { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || t.workOrders.uploadFailed);
        }
        uploaded++;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.workOrders.uploadFailed);
    } finally {
      // Reflect any photos that DID save, even if a later one in the batch
      // failed — otherwise the tech re-uploads and duplicates them.
      if (uploaded > 0) router.refresh();
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(photoUrl(id), { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || t.workOrders.removePhotoFailed);
      }
      setActive(null);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t.workOrders.removePhotoFailed,
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) =>
            broken.has(p.id) ? (
              <div
                key={p.id}
                className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
                aria-hidden
              >
                <ImageOff className="h-6 w-6" />
              </div>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p)}
                className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(p.id)}
                  alt={t.workOrders.photoAlt(p.uploader, p.when)}
                  loading="lazy"
                  onError={() =>
                    setBroken((s) => new Set(s).add(p.id))
                  }
                  className="h-full w-full object-cover"
                />
              </button>
            ),
          )}
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy || full}
            onClick={() => inputRef.current?.click()}
            className={buttonClass("secondary")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {full ? t.workOrders.maxPhotos(max) : t.workOrders.addPhotos}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.workOrders.photoDialogLabel}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="flex items-center justify-between gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[13px] text-white/80">
              {active.uploader} · {active.when}
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label={t.common.close}
              onClick={() => setActive(null)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(active.id)}
              alt={t.workOrders.photoAlt(active.uploader, active.when)}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {canEdit && active.canRemove && (
            <div
              className="flex justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={removingId === active.id}
                onClick={() => remove(active.id)}
                className={buttonClass("secondary")}
              >
                {removingId === active.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t.workOrders.removePhoto}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Downscale to ≤1600px on the long edge, re-encode JPEG q0.85 in the browser so
// job photos (which document findings) upload small without a server image lib.
// Failure messages are passed in (this runs outside the component, no hooks).
function compress(
  file: File,
  msgs: { processFail: string; readFail: string },
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const scale = MAX / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error(msgs.processFail));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(msgs.processFail))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(msgs.readFail));
    };
    img.src = url;
  });
}
