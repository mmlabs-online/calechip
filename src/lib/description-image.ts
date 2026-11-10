// EVT-11, ADR-056 decisions 4 and 5. The picture a description carries is shrunk HERE, in the
// browser, before it is embedded: Q2-B keeps it inside the row as a base64 `data:` URL, so every
// byte saved here is a byte every reader of the event no longer downloads. The database's
// `event_description_bounded` is the control on the total; this is what keeps one picture small.
import {
  DESCRIPTION_IMAGE_MAX_EDGE,
  DESCRIPTION_IMAGE_MAX_INPUT_BYTES,
  DESCRIPTION_IMAGE_TYPES,
  type Result,
} from "@/lib/domain/types";

export const DESCRIPTION_IMAGE_REFUSED = "Choose a PNG, JPEG or WebP picture of at most 10 MB.";

const REFUSED: Result<string> = {
  ok: false,
  error: { code: "description_image_refused", message: DESCRIPTION_IMAGE_REFUSED },
};

/** § 1. WebP keeps transparency and is the smallest widely-encodable format; JPEG where the browser
 *  cannot encode WebP — `toBlob` then answers PNG, which is never what is stored. */
const WEBP_QUALITY = 0.8;
const JPEG_QUALITY = 0.85;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Decodes with createImageBitmap, draws onto a canvas scaled so the longest edge is at most
 *  DESCRIPTION_IMAGE_MAX_EDGE (never enlarged), encodes with canvas.toBlob("image/webp", 0.8) —
 *  falling back to ("image/jpeg", 0.85) when the blob's type is not image/webp — and reads the
 *  blob as a data: URL. Refuses with code "description_image_refused" and the message above when
 *  the type is not in DESCRIPTION_IMAGE_TYPES, the size exceeds DESCRIPTION_IMAGE_MAX_INPUT_BYTES,
 *  or decoding fails. */
export async function downscaleToDataUrl(file: File): Promise<Result<string>> {
  if (!(DESCRIPTION_IMAGE_TYPES as readonly string[]).includes(file.type)) return REFUSED;
  if (file.size > DESCRIPTION_IMAGE_MAX_INPUT_BYTES) return REFUSED;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return REFUSED;
  }

  try {
    const scale = Math.min(1, DESCRIPTION_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return REFUSED;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      // JPEG has no alpha: transparent pixels would encode black. White behind them, as on paper.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
    }
    if (!blob) return REFUSED;
    return { ok: true, value: await readAsDataUrl(blob) };
  } catch {
    return REFUSED;
  } finally {
    bitmap.close();
  }
}
