// Renders a server-generated QR as inline SVG. The markup comes from our own
// qrcode lib (lib/qr.ts) — never user input — so dangerouslySetInnerHTML is
// safe here. The wrapper sizes the SVG; callers set width/height via className.
export function QrImage({
  svg,
  className,
  label,
}: {
  svg: string;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
