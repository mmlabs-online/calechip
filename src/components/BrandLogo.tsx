import { Link } from "react-router-dom";

// SOLO, 2026-09-13. The product's brand, in the two places it is drawn — the sidebar and the sign-in /
// sign-up card. The operator replaced the old Vietnamese product name with `CaleChip` and a logo that
// links back to `/`, drawn as the logo AND the word, in both places.
//
// **THE MARK IS `public/logo.svg`, A PLACEHOLDER.** Swapping that file for the real logo changes the
// brand everywhere with no code change. The image is decorative (`alt=""`): the word beside it is the
// link's accessible name, so a screen reader hears "CaleChip" once rather than twice.
//
// **`/` AND NOT A FIXED SCREEN.** `/` resolves by session and membership in App.tsx — the week for a
// member, the sign-in screen when signed out — so the same link is correct on both surfaces.

const PRODUCT_NAME = "CaleChip";

const SIZES = {
  md: { mark: "h-8 w-8", word: "text-xl" },
  lg: { mark: "h-10 w-10", word: "text-[28px]" },
} as const;

interface BrandLogoProps {
  size?: keyof typeof SIZES;
  testId?: string;
}

export default function BrandLogo({ size = "md", testId = "brand-logo" }: BrandLogoProps) {
  const { mark, word } = SIZES[size];
  return (
    <Link
      data-testid={testId}
      to="/"
      className="inline-flex items-center gap-2 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className={`${mark} shrink-0`} />
      <span className={`font-display ${word} font-bold leading-none text-ink`}>{PRODUCT_NAME}</span>
    </Link>
  );
}
