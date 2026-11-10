// SOLO, 2026-09-13. The avatar is an image file in `public/images/`, and `member.avatar` stores its
// file name WITH the extension — `12.png`. Operator's instruction, verbatim: *list ảnh được lấy ra
// từ "public\images" và lưu vào member info tên của ảnh*.
//
// **THIS FILE IMPORTS NOTHING, AND THAT IS LOAD-BEARING.** `vite.config.ts` imports it to filter and
// order the folder listing it serves as `virtual:avatar-images`, and a config file cannot resolve the
// `@/` alias or a virtual module. The browser side reads the same two functions, so the rule for
// "what counts as an avatar file" and "in what order they are offered" is written exactly once.

/**
 * The value every member without a usable avatar falls back to. It is also what
 * `20260913090000_solo_avatar_images.sql` wrote onto every existing row, and what the sign-up
 * trigger writes when sign-up carries no avatar — the three have to agree, so change all three or
 * none.
 */
export const DEFAULT_AVATAR = "1.png";

/**
 * A plain file name with one of the allowed image extensions, and nothing else: no directory, no
 * `..`, no query, no scheme, no spaces. Case-insensitive on the extension.
 */
const AVATAR_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.(png|jpe?g|webp|gif|svg)$/i;

export function isAvatarFileName(name: string): boolean {
  return AVATAR_FILE_NAME.test(name);
}

/**
 * Filters a directory listing down to avatar files and orders it NUMERICALLY, so `2.png` comes
 * before `10.png`. Duplicates are dropped. A plain `sort()` would offer `1, 10, 11, …, 2`.
 */
export function orderAvatarFiles(names: readonly string[]): string[] {
  return [...new Set(names.filter(isAvatarFileName))].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }),
  );
}

/**
 * The image names worth trying for a stored value, in order: the value itself, then the default.
 *
 * **ONLY NAMES THE BUILD FOUND IN THE FOLDER ARE RETURNED.** A stored value that is not a file name
 * (anything a caller with a token wrote, since the column carries no check), or a file that was
 * removed from the folder, is skipped rather than requested — which is also what keeps a stored
 * value from ever becoming an arbitrary URL. An empty result means: draw the neutral placeholder.
 */
export function avatarSources(value: string, offered: readonly string[]): string[] {
  const candidates = value === DEFAULT_AVATAR ? [value] : [value, DEFAULT_AVATAR];
  return candidates.filter((name) => isAvatarFileName(name) && offered.includes(name));
}

/** The URL an avatar file is served from. `public/` is served at the base path, not at `/public`. */
export function avatarUrl(name: string, base: string): string {
  return `${base.endsWith("/") ? base : `${base}/`}images/${name}`;
}
