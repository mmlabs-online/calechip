import { useState } from "react";
import { UserRound } from "lucide-react";
import { AVATAR_CHOICES } from "@/lib/domain/types";
import { avatarSources, avatarUrl } from "@/lib/avatars";

// SOLO, 2026-09-13. **EVERY PLACE A MEMBER'S FACE IS DRAWN GOES THROUGH HERE**, because
// `member.avatar` is now an image file name (`12.png`) and printing it as text would put the file
// name on the calendar.
//
// THE FALLBACK, IN ORDER — operator's instruction: a missing or unusable avatar shows a default
// instead of breaking.
//   1. the stored image, when the build found that file in `public/images/`;
//   2. `DEFAULT_AVATAR` (`1.png`), when the stored one is unusable and the default exists;
//   3. a neutral placeholder: a `UserRound` outline on the `field` tone. Chosen because it reads as
//      "a person, no picture" without claiming to be anybody, and it needs no file — so it still
//      renders when the folder is empty or both images fail to load.
// A load error at runtime (a file removed after the build, a failed request) steps to the next one.
//
// UNCROPPED. The images are transparent stickers of any aspect ratio, so the picture is `object-contain`
// and NOT clipped to a circle — `object-cover` inside `rounded-full` cut their edges off. The round
// shape comes from the wrapper that draws the `field` disc, and that wrapper carries the padding.
//
// DECORATIVE. The name is always rendered beside it or carried by the wrapper's `title`, so the
// image has `alt=""` and would only repeat that name to a screen reader.

interface AvatarProps {
  /** The stored `member.avatar` value. */
  value: string;
  /** Size classes. The image fills this box, so the box must have a height and a width. */
  className?: string;
}

export default function Avatar({ value, className = "h-full w-full" }: AvatarProps) {
  const sources = avatarSources(value, AVATAR_CHOICES);
  // Failures are remembered FOR THIS VALUE ONLY, so a member who picks a new avatar gets it tried
  // from the top rather than inheriting the previous one's failure.
  const [failed, setFailed] = useState({ value, count: 0 });
  const failures = failed.value === value ? failed.count : 0;
  const source = sources[failures];

  if (!source) {
    return (
      <span
        data-avatar-fallback="placeholder"
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-field text-ink-3 ${className}`}
      >
        <UserRound aria-hidden="true" className="h-3/5 w-3/5" strokeWidth={2} />
      </span>
    );
  }

  return (
    <img
      src={avatarUrl(source, import.meta.env.BASE_URL)}
      alt=""
      draggable={false}
      data-avatar-src={source}
      onError={() => setFailed({ value, count: failures + 1 })}
      className={`block shrink-0 object-contain ${className}`}
    />
  );
}
