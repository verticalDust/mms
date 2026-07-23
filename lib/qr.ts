import QRCode from "qrcode";

// Server-side QR as an inline SVG string — no external request, no data-URI, and
// crisp at any print size (viewBox + shape-rendering:crispEdges). The caller
// sizes it via CSS on a wrapping element; the SVG carries no width/height.
// Pure black on white: the QR is a functional element (it must scan off cheap
// label stock in bad light), so contrast wins over brand tint here.
export async function qrSvg(
  text: string,
  { margin = 2 }: { margin?: number } = {},
): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin, // quiet zone, in modules — baked in so scanning never depends on CSS
    color: { dark: "#000000", light: "#ffffff" },
  });
}
