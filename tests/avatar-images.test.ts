// SOLO, 2026-09-13 — the avatar is an image file in `public/images/`, stored by file name.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so nothing here is numbered `AC-n`.
// `.claude/agents/solo.md` and ADR-033 are the authority.
//
// What is asserted: the offered list IS the folder (read through the same Vite config the build
// uses), it is ordered numerically, a stored value can never become an arbitrary URL, the fallback
// order reaches the neutral placeholder, and a sign-up with no avatar gets the default — the mock
// reproducing the trigger's `coalesce(…, '1.png')`.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR,
  avatarSources,
  avatarUrl,
  isAvatarFileName,
  orderAvatarFiles,
} from "@/lib/avatars";
import { AVATAR_CHOICES } from "@/lib/domain/types";
import { seam as mock } from "@/lib/data/mock";
import { FIXTURE_PASSWORD } from "@/lib/fixtures";

const IMAGES_DIR = fileURLToPath(new URL("../public/images", import.meta.url));

describe("SOLO — the offered avatars are the files in public/images", () => {
  it("is exactly the folder's image files, in numeric order", () => {
    const onDisk = readdirSync(IMAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    expect(AVATAR_CHOICES).toEqual(orderAvatarFiles(onDisk));
    expect(AVATAR_CHOICES.length, "public/images/ holds no image").toBeGreaterThan(0);
  });

  it("stores the file name with its extension, and the default is one of them", () => {
    for (const name of AVATAR_CHOICES) expect(isAvatarFileName(name), name).toBe(true);
    expect(DEFAULT_AVATAR).toBe("1.png");
  });
});

describe("SOLO — orderAvatarFiles", () => {
  it("orders by number, not by character", () => {
    expect(orderAvatarFiles(["10.png", "2.png", "1.png", "16.png", "4.png"])).toEqual([
      "1.png",
      "2.png",
      "4.png",
      "10.png",
      "16.png",
    ]);
  });

  it("keeps the allowed image extensions, in any case, and drops everything else", () => {
    expect(
      orderAvatarFiles([
        "a.png",
        "b.JPG",
        "c.jpeg",
        "d.webp",
        "e.gif",
        "f.svg",
        "notes.txt",
        ".DS_Store",
        "Thumbs.db",
        "no-extension",
        "a.png",
      ]),
    ).toEqual(["a.png", "b.JPG", "c.jpeg", "d.webp", "e.gif", "f.svg"]);
  });
});

describe("SOLO — a stored value never becomes an arbitrary URL", () => {
  it("rejects paths, schemes, queries, spaces and emoji", () => {
    for (const value of [
      "../secret.png",
      "images/1.png",
      "https://example.com/x.png",
      "1.png?x=1",
      "my face.png",
      "🐱",
      "",
      "javascript:alert(1)",
    ]) {
      expect(isAvatarFileName(value), value).toBe(false);
    }
  });

  it("builds the URL under the base path, with or without a trailing slash", () => {
    expect(avatarUrl("12.png", "/")).toBe("/images/12.png");
    expect(avatarUrl("12.png", "/app")).toBe("/app/images/12.png");
    expect(avatarUrl("12.png", "/app/")).toBe("/app/images/12.png");
  });
});

describe("SOLO — the fallback order", () => {
  const offered = ["1.png", "2.png", "4.png"];

  it("tries the stored image, then the default", () => {
    expect(avatarSources("4.png", offered)).toEqual(["4.png", "1.png"]);
    expect(avatarSources("1.png", offered)).toEqual(["1.png"]);
  });

  it("skips a stored value the folder does not hold, or that is not a file name", () => {
    expect(avatarSources("3.png", offered)).toEqual(["1.png"]);
    expect(avatarSources("🐱", offered)).toEqual(["1.png"]);
    expect(avatarSources("", offered)).toEqual(["1.png"]);
  });

  it("returns nothing — the placeholder — when neither image exists", () => {
    expect(avatarSources("3.png", ["2.png"])).toEqual([]);
    expect(avatarSources("2.png", [])).toEqual([]);
  });
});

describe("SOLO — a sign-up that carries no avatar gets the default", () => {
  it("stores DEFAULT_AVATAR, as the trigger does", async () => {
    const email = "khong-anh@example.com";
    const signedUp = await mock.signUp({
      email,
      password: FIXTURE_PASSWORD,
      displayName: "Khong Anh",
      avatar: "   ",
    });
    expect(signedUp.ok, "sign-up failed").toBe(true);
    await mock.signOut();

    const signedIn = await mock.signIn({ email, password: FIXTURE_PASSWORD });
    expect(signedIn.ok, "the signed-up account could not sign in").toBe(true);
    const me = await mock.getCurrentMember();
    expect(me?.avatar).toBe(DEFAULT_AVATAR);
    await mock.signOut();
  });
});
