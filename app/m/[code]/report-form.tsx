"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Send, Trash2, Languages } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  messages,
  LANG_LABEL,
  OTHER_LANG,
  type Lang,
} from "./messages";
import { REPORT_DESC_MAX, REPORT_NAME_MAX } from "@/lib/reports";
import { LANG_COOKIE } from "@/lib/i18n/config";
import { submitReport } from "./actions";

export function ReportForm({
  code,
  machineCode,
  machineName,
  defaultLang,
  photosEnabled,
}: {
  code: string;
  machineCode: string;
  machineName: string;
  defaultLang: Lang;
  photosEnabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = messages[lang];

  // Instant toggle — no reload, so a half-typed description survives. Also writes
  // the cookie so the confirmation / re-scan inherit the choice.
  function toggleLang() {
    const next = OTHER_LANG[lang];
    setLang(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  async function pickPhoto(file: File) {
    setPhotoBusy(true);
    setError(null);
    try {
      const blob = await downscale(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError(null); // a bad image just isn't attached; the report still sends
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    fd.set("lang", lang);
    // Send the client-downscaled, EXIF-stripped blob — never the raw camera file.
    fd.delete("photo");
    if (photo) fd.set("photo", photo.blob, "photo.jpg");

    // Cheap client guard so an empty description doesn't cost a round trip; the
    // server is still the authority.
    if (!String(fd.get("description") ?? "").trim()) {
      setError(t.descRequired);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const res = await submitReport({}, fd);
      // Success redirects (handled by the framework); only an error returns here.
      if (res?.error) {
        setError(res.error);
        setPending(false);
      }
    } catch {
      // A thrown redirect is caught and navigated by Next; anything else is a
      // real failure — let the operator retry.
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-5"
    >
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="lang" value={lang} />

      {/* Machine identity (from the scanned QR) + language toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-slate-500">{t.reportingFor}</div>
          <div className="font-mono text-[13px] font-medium tabular-nums text-slate-500">
            {machineCode}
          </div>
          <h1 className="font-condensed text-2xl font-semibold leading-tight text-slate-900">
            {machineName}
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleLang}
          aria-label="Switch language"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 font-condensed text-[13px] font-medium tracking-wide text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <Languages className="h-4 w-4" />
          {LANG_LABEL[OTHER_LANG[lang]]}
        </button>
      </div>

      {/* Honeypot — hidden from humans and assistive tech; bots fill it. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="font-condensed text-[13px] font-medium tracking-wide text-slate-600"
        >
          {t.descLabel}
        </label>
        <textarea
          id="description"
          name="description"
          required
          autoFocus
          rows={5}
          maxLength={REPORT_DESC_MAX}
          placeholder={t.descPlaceholder}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[16px] leading-relaxed text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reporterName"
          className="font-condensed text-[13px] font-medium tracking-wide text-slate-600"
        >
          {t.nameLabel}
        </label>
        <input
          id="reporterName"
          name="reporterName"
          maxLength={REPORT_NAME_MAX}
          placeholder={t.namePlaceholder}
          className="h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-[16px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {photosEnabled && (
        <div className="flex flex-col gap-2">
          <span className="font-condensed text-[13px] font-medium tracking-wide text-slate-600">
            {t.photoLabel}
          </span>
          <input
            ref={fileRef}
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickPhoto(f);
            }}
          />
          {photo ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-16 w-16 rounded-md border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className={cn(buttonClass("secondary"), "gap-1.5")}
              >
                <Trash2 className="h-4 w-4" />
                {t.photoRemove}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => fileRef.current?.click()}
              className={cn(buttonClass("secondary"), "w-full")}
            >
              {photoBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {t.photoAdd}
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[14px] text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(buttonClass("primary", true, "lg"), "text-[16px]")}
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
        {pending ? t.submitting : t.submit}
      </button>
    </form>
  );
}

// Downscale to ≤1280px on the long edge and re-encode as JPEG (q0.8) in the
// browser. The canvas re-encode also strips all EXIF/GPS metadata — the primary
// scrub for a stranger's photo (the server strip is the backstop). Mirrors the
// parts photo-upload compressor.
function downscale(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
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
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("no blob"))),
        "image/jpeg",
        0.8,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
