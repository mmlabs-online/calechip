// SOLO, 2026-09-10 — the personal profile screen. No ticket, no plan, no § 2b; `.claude/agents/
// solo.md` and ADR-033 are the whole authority.
//
// **THE LAYOUT IS TRANSCRIBED FROM AN IMAGE THAT IS NOT ON DISK, so no later reader can check a
// sentence of this file against it.** `.ai/standards/ui-design-system.md` § *Visual specification*
// is explicit that a transcription is evidence of intent and not a reference. What the picture
// showed, in its order: an identity card (large avatar tile, a role pill and a team pill, the name,
// an identifier beneath it), then `Icon đại diện` — a grid of circular emoji buttons, ten to a row —
// then `Tên hiển thị`, one filled borderless input, then `Đổi mật khẩu` with a full-width current-
// password box above a two-column new/confirm pair, every box carrying a reveal eye.
//
// **THREE THINGS THE PICTURE DID NOT SHOW, DECIDED HERE AND MARKED AS THIS AGENT'S OWN:**
//
//  1. *Where the save control is.* A fifth card was cut off at the bottom edge. **ONE FORM, ONE SAVE
//     BUTTON, at the bottom** — and the picture's own sentence is what decides it: *"Bỏ trống cả ba ô
//     nếu bạn không muốn thay đổi mật khẩu"* (leave all three boxes empty if you do not want to
//     change your password) only means anything if pressing save is what submits the rest of the page
//     too. Per-card save buttons would make that sentence unnecessary.
//  2. *Whether picking an emoji saves immediately.* It does not. It is a form control like the name
//     box, and it is saved by the same button — which is the only reading consistent with (1).
//  3. *The failure and success states.* Errors sit beside the field that produced them, never all
//     together under the button; the outcome line is beside the save control.
//
// **THE COPY IS ENGLISH, and the picture's is not.** `ui-language.json` § copyDebt is empty and the
// lint rule in `eslint.config.js` fails a Vietnamese diacritic anywhere in `src/**` bar
// `fixtures.ts`. The language split is by audience and is not this screen's to revisit.
//
// **THE IDENTIFIER UNDER THE NAME IS THE EMAIL ADDRESS.** The picture shows `@min`, a handle. There
// is no handle in this product — `member` holds `display_name` and `avatar`, and nothing else that
// names a person (`.ai/standards/data-model.md`) — so rendering one would mean inventing a field and
// deriving it from the display name, which is neither unique nor stable. The address is the real
// identifier the account already has, and it comes from the auth user rather than from the member row.
//
// **EVERY WRITE GOES THROUGH THE SEAM (RULE-02) AND NEITHER TAKES A MEMBER ID.** `updateOwnProfile`
// and `changePassword` resolve the caller from the session inside the implementation, so there is no
// argument on this screen that could aim either write at somebody else.
//
// **EVT-05 — THE EMAIL CARD.** Its layout is `.ai/board/tickets/EVT-05/01-plan.md` § 2b, the Tech
// Lead's own, and its contract § 4.6: one switch, `profile-event-email`, saved by the one save button
// for reason 1 above — a toggle that saved on press would be the only control on the page that does.
// `setEventEmailEnabled` takes no member id either; the screen never sends or names an email.
import { useCallback, useEffect, useState, type FormEvent } from "react";
// SOLO, 2026-09-12. **RESTORED, for the `Calendar` control below.** It was deleted on 2026-09-10
// as an orphan after another session removed this screen's way back; the operator asked for one
// again on 2026-09-12, against an image of an outline pill reading `Calendar`.
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { seam } from "@/lib/data";
import { ROLE_BADGE_COLORS, ROLE_LABELS } from "@/lib/roles";
import { useShellContext } from "@/components/AppShell";
// SOLO, 2026-09-28. The box and the eye, moved out of this file so `/signin` and `/signup` use the
// same control rather than a copy of it.
import PasswordInput from "@/components/PasswordInput";
import { PILL_OUTLINE } from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import { AVATAR_CHOICES, type Member, type Team } from "@/lib/domain/types";

/**
 * **THE MEMBER ROW IS NOT IN HERE, AND ITS ABSENCE IS THE POINT.**
 *
 * This started as `{ loading } | { unavailable } | { ready, me, email, team }`, filled by a
 * `getCurrentMember()` of its own. In the real seam that call is TWO network round trips —
 * `auth.getUser()` and then the `member` select — and the shell had already made both before this
 * screen rendered. The duplicate was visible in the network panel and is what prompted this change.
 *
 * The row now arrives through `useShellContext()`, so what is left to fetch is what the shell does
 * NOT hold: the account's email address, which lives on the auth user, and the team's name.
 *
 * **THERE IS NO LOADING PHASE AND NO UNAVAILABLE PHASE ANY MORE.** Everything the form needs is
 * present on the first render, so a spinner would cover a screen that is ready; and both remaining
 * reads already fail to `null` rather than throwing, so there is no failure that could take the
 * screen away. The email line and the team pill are absent until they arrive, which is what they
 * already did when a read failed.
 */
interface Extras {
  email: string | null;
  team: Team | null;
}

/** Which box a refusal belongs beside. `null` means the outcome line under the button — used only
 *  for a failure that belongs to no single field, such as a transport error. */
type FieldErrors = {
  displayName: string | null;
  avatar: string | null;
  currentPassword: string | null;
  newPassword: string | null;
  confirmPassword: string | null;
};

const NO_ERRORS: FieldErrors = {
  displayName: null,
  avatar: null,
  currentPassword: null,
  newPassword: null,
  confirmPassword: null,
};

/** GoTrue's own default minimum, and the number the transcription prints in the new-password
 *  placeholder. `signUp` in both seam implementations refuses below it with `weak_password`; this is
 *  the same threshold said once more, in the place that must not send a request it knows is refused. */
const PASSWORD_MIN = 6;

/** The shape `AllowList.tsx:20` already uses, so two screens do not date the same fact differently. */
const day = (iso: string): string => format(new Date(iso), "dd/MM/yyyy");

// SOLO 2026-09-12, ADR-035 — see `src/lib/roles.ts`. This copy labelled a manager `Member`.
const roleLabel = (role: Member["role"]): string => ROLE_LABELS[role];

const CARD = "rounded-card bg-card p-6 shadow-soft";
const FIELD_LABEL =
  "block text-[10px] font-bold uppercase tracking-wider text-ink-3";
const FIELD =
  "w-full rounded-pill bg-field px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** A password box and its reveal control. Written once because the screen has three of them, and
 *  three hand-written copies of an input with a button positioned inside it is three chances to get
 *  the padding that keeps the text clear of the icon wrong.
 *
 *  **SOLO, 2026-09-28 — THE BOX AND THE EYE MOVED TO `src/components/PasswordInput.tsx`, AND THE
 *  SENTENCE ABOVE IS THE REASON THEY DID.** The operator asked for the same control on `/signin` and
 *  `/signup`; the argument for writing it once across three boxes on one screen is the same argument
 *  across five boxes on three screens, one size larger. `EyeIcon` and the `type="button"` note went
 *  with it, unchanged.
 *
 *  **WHAT STAYED HERE IS THE LABEL AND THE ERROR**, which are this screen's and not the control's:
 *  Profile draws a `<label htmlFor>` above and a `role="alert"` paragraph below, and the two auth
 *  screens do neither. A shared component that owned them would have to be told which screen it was
 *  on. */
function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  autoComplete: string;
}) {
  return (
    <div className="min-w-0">
      <label className={FIELD_LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="mt-1.5">
        {/* `pr-11` is NOT passed here any more: `PasswordInput` adds it, because the space the
            reveal button occupies belongs to the button. */}
        <PasswordInput
          testId={id}
          value={value}
          onChange={onChange}
          className={FIELD}
          autoComplete={autoComplete}
          placeholder={placeholder}
          invalid={error !== null}
          describedBy={error ? `${id}-error` : undefined}
        />
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          data-testid={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function Profile() {
  // The member row the shell already resolved. NOT read again here — see `Extras` above.
  const { member: me, refreshMembership } = useShellContext();
  const [extras, setExtras] = useState<Extras>({ email: null, team: null });

  // The form, seeded ONCE from the row that was present on the first render. A lazy initialiser and
  // not an effect: there is nothing to wait for, so there is no moment at which these are empty.
  //
  // **IT IS NOT RE-SEEDED WHEN THE CONTEXT CHANGES, DELIBERATELY.** `refreshMembership` replaces the
  // row after a save, and a re-seed on that would be harmless — the values are equal — but the same
  // effect would fire for any other refresh and discard whatever the member was in the middle of
  // typing. The save path sets these explicitly from the seam's answer instead, which is narrower
  // and says when it happens.
  const [avatar, setAvatar] = useState(me.avatar);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [outcome, setOutcome] = useState<
    { kind: "ok" | "error"; message: string } | null
  >(null);
  const [saving, setSaving] = useState(false);

  // EVT-05. The switch as LOADED (null until the read answers, or when it answers null — the toggle
  // is disabled then) and as the form holds it. A difference between the two is a change (AC-14).
  const [savedEventEmail, setSavedEventEmail] = useState<boolean | null>(null);
  const [eventEmail, setEventEmail] = useState(true);

  // The two facts the shell does not hold. IN PARALLEL, because neither depends on the other and
  // running them in sequence made the team pill wait on an address it has nothing to do with.
  // `catch` per call, so one failing still yields the other.
  const load = useCallback(async (): Promise<void> => {
    const [session, team, emailEnabled] = await Promise.all([
      seam.getSession().catch(() => null),
      seam.getTeam().catch(() => null),
      // EVT-05. Its own `catch`: a failed read disables the toggle and takes nothing else away.
      seam.getEventEmailEnabled().catch(() => null),
    ]);
    setExtras({ email: session ? session.user.email : null, team });
    setSavedEventEmail(emailEnabled);
    if (emailEnabled !== null) setEventEmail(emailEnabled);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;

    const trimmed = displayName.trim();
    // **ANY of the three password boxes touched means the caller is changing their password**, and
    // the other two are then required. Reading it as "all three filled" would let a half-filled form
    // save the name and silently ignore the password — the failure mode the picture's own sentence
    // is written against.
    const wantsPassword =
      currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

    const next: FieldErrors = { ...NO_ERRORS };
    if (trimmed === "") next.displayName = "Enter a display name.";
    if (wantsPassword) {
      if (currentPassword === "") {
        next.currentPassword = "Enter your current password.";
      }
      if (newPassword === "") {
        next.newPassword = "Enter a new password.";
      } else if (newPassword.length < PASSWORD_MIN) {
        next.newPassword = `Use at least ${PASSWORD_MIN} characters.`;
      }
      // Checked HERE and nowhere below the seam: two boxes that must match is a typing-mistake check
      // with no meaning to the datastore, and sending the confirmation would create a second copy of
      // this comparison that is free to disagree with this one.
      if (confirmPassword !== newPassword) {
        next.confirmPassword = "The two passwords do not match.";
      }
    }

    if (Object.values(next).some((message) => message !== null)) {
      setErrors(next);
      setOutcome(null);
      return;
    }

    const profileChanged = trimmed !== me.displayName || avatar !== me.avatar;
    // EVT-05 AC-14. Changing only the switch is a change, so it is never answered *Nothing to save*.
    const emailChanged = savedEventEmail !== null && eventEmail !== savedEventEmail;
    if (!profileChanged && !emailChanged && !wantsPassword) {
      setErrors(NO_ERRORS);
      setOutcome({ kind: "ok", message: "Nothing to save." });
      return;
    }

    setErrors(NO_ERRORS);
    setOutcome(null);
    setSaving(true);

    try {
      // **THE PROFILE FIRST, AND THE PASSWORD ONLY IF IT SUCCEEDED.** Two writes, two failures
      // possible, and the order decides what a half-failure means. This way round the partial state
      // is "name saved, password not", which the outcome line says in words. The other way round
      // leaves somebody holding a new password and an unsaved name, which is worse: they have to
      // notice the name themselves, and their next sign-in uses a password nothing on screen
      // confirmed.
      if (profileChanged) {
        const saved = await seam.updateOwnProfile({
          displayName: trimmed,
          avatar,
        });
        if (!saved.ok) {
          const code = saved.error.code;
          if (code === "invalid_display_name") {
            setErrors({ ...NO_ERRORS, displayName: saved.error.message });
          } else if (code === "invalid_avatar") {
            setErrors({ ...NO_ERRORS, avatar: saved.error.message });
          } else {
            setOutcome({ kind: "error", message: saved.error.message });
          }
          return;
        }

        // The seam's answer and not the local values: it returns the row as it was WRITTEN, trimmed
        // by the datastore's own rule, so the boxes show what was stored rather than what was typed.
        setAvatar(saved.value.avatar);
        setDisplayName(saved.value.displayName);
        // **AND THE IDENTITY CARD ABOVE THE FORM UPDATES THROUGH THIS AND NOTHING ELSE.** It reads
        // `me`, which is the shell's row, so this one call moves the card, the sidebar's account
        // footer and the roster together — there is no second copy here to keep in step. Nothing
        // about a `member` table write reaches `useSession` on its own, which is why it is told.
        refreshMembership();
      }

      // EVT-05. After the profile, before the password — the same reasoning about what a
      // half-failure leaves behind: a password change is the write that must not outrun the rest.
      if (emailChanged) {
        const savedEmail = await seam.setEventEmailEnabled(eventEmail);
        if (!savedEmail.ok) {
          setOutcome({
            kind: "error",
            message: profileChanged
              ? "Your profile was saved, but your email setting was not."
              : savedEmail.error.message,
          });
          return;
        }
        setSavedEventEmail(savedEmail.value);
        setEventEmail(savedEmail.value);
      }

      if (wantsPassword) {
        const changed = await seam.changePassword({
          currentPassword,
          newPassword,
        });
        if (!changed.ok) {
          const code = changed.error.code;
          if (code === "wrong_password") {
            setErrors({ ...NO_ERRORS, currentPassword: changed.error.message });
          } else if (code === "weak_password") {
            setErrors({ ...NO_ERRORS, newPassword: changed.error.message });
          } else {
            setOutcome({ kind: "error", message: changed.error.message });
          }
          // Said plainly rather than left for the member to work out from the fields. A screen that
          // reported only the failure would leave them believing the name was not saved either.
          if (profileChanged || emailChanged) {
            setOutcome({
              kind: "error",
              message:
                "Your profile was saved, but your password was not changed.",
            });
          }
          return;
        }

        // Emptied on success, and only on success. They are not re-fillable from anywhere, so a
        // failed attempt that cleared them would make the member retype all three.
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      setOutcome({
        kind: "ok",
        message: wantsPassword
          ? profileChanged || emailChanged
            ? "Profile and password saved."
            : "Password changed."
          : "Profile saved.",
      });
    } catch {
      setOutcome({
        kind: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const { email, team } = extras;

  // **THE OFFERED SET, PLUS THE CALLER'S OWN VALUE WHEN IT IS NOT IN IT.** SOLO, 2026-09-13: the
  // offered set is the files in `public/images/`, so the case is a saved file name that is no longer
  // in the folder (or `DEFAULT_AVATAR` when the folder holds no `1.png`). Rendering
  // `AVATAR_CHOICES` alone would show such a member a radiogroup with NOTHING checked — and the seam
  // accepts that value (it is the *keep what you have* clause), so the control must be able to
  // represent the state the screen is in. That option draws the default avatar, as every screen does
  // for a value it has no file for.
  //
  // It is FIRST, so the checked option is where the eye starts, and it STAYS in the row after they
  // pick an offered one — unchecked, and still clickable, which is how they undo. It is derived from
  // the SAVED row and not from the form, so it stops being offered once a different avatar is saved,
  // at which point the seam would refuse it anyway.
  //
  // The empty-string guard is for a value no code path in this product writes — `avatar` is
  // `text not null` and the trigger's `nullif(btrim(…), '')` cannot produce it — but a blank circle
  // rendered as a choice is a worse answer than one fewer choice.
  const choices =
    me.avatar === "" || AVATAR_CHOICES.includes(me.avatar)
      ? AVATAR_CHOICES
      : [me.avatar, ...AVATAR_CHOICES];

  return (
    <form
      data-testid="profile"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="mx-auto flex max-w-2xl flex-col gap-6"
    >
      {/* SOLO, 2026-09-12 — **THE WAY BACK TO THE CALENDAR**, on the operator's instruction and
          against an image of an outline pill reading `Calendar`.

          **IT EXISTS BECAUSE THE SHELL'S DOES NOT RIGHT NOW.** `src/components/Sidebar.tsx:438`
          has the three-link calendar nav — `This week`, `The year`, `Public holidays` — COMMENTED
          OUT, so a caller who opens their profile has no control anywhere on the screen that returns
          them to a calendar. That comment is another session's uncommitted work and is not touched
          here; if it comes back, this pill is a second way home rather than the only one, which is
          the same relationship `admin-hub-back` has to the tab strip.

          **`/` AND NOT `/week`.** The landing route resolves to the current week IN PLACE and holds
          the product's one clock for it (`src/lib/period.ts`, `periodNavFor`); `/week` redirects to
          `/week/<today>` a frame later, which is the same destination by a longer road. `/` is also
          where `Back to the start` pointed on every screen that had one, so the two say the same
          thing.

          **AN ANCHOR INSIDE A `<form>`, which is safe and is why it is a `<Link>`.** A `<button>`
          here with no explicit `type` would be a SUBMIT button — the trap `PasswordField` below
          records — so going back to the calendar would save the page on the way out. */}
      <p>
        <Link data-testid="profile-calendar" to="/" className={PILL_OUTLINE}>
          Back to Calendar
        </Link>
      </p>

      {/* 1. The identity card. A LIVE PREVIEW of the form's working values (operator, 2026-09-13):
          the avatar tile and the name follow the picker and the name box before anything is saved.
          It replaced a card that showed only the saved row. Only this card previews — the sidebar and
          every other screen still change on save. A blank name box previews the saved name, because
          an empty heading is a state no saved row can be in. */}
      <div className={`${CARD} flex flex-col items-center gap-3 text-center`}>
        <span
          data-testid="profile-avatar"
          data-avatar={avatar}
          aria-hidden
          className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-card bg-field p-[5px] text-4xl"
        >
          <Avatar value={avatar} />
        </span>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* `data-role` beside the rendered word, the shape `shell-roster-role` uses: an assertion
              reads the fact without depending on the copy. */}
          <span
            data-testid="profile-role"
            data-role={me.role}
            className={`rounded-pill px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE_COLORS[me.role]}`}
          >
            {roleLabel(me.role)}
          </span>
          {team ? (
            <span
              data-testid="profile-team"
              className="rounded-pill bg-field px-2.5 py-1 text-[10px] font-semibold text-ink-2"
            >
              {team.name}
            </span>
          ) : null}
        </div>

        <div>
          <h1
            data-testid="profile-name"
            className="font-display text-2xl font-bold leading-tight text-ink"
          >
            {displayName.trim() === "" ? me.displayName : displayName}
          </h1>
          {/* ABSENT when the session read failed, not rendered empty. An address missing from the
              screen is a read that did not happen; a blank line under the name says the account has
              a blank address. */}
          {email ? (
            <p data-testid="profile-email" className="mt-1 text-sm text-ink-3">
              {email}
            </p>
          ) : null}
        </div>

        <p data-testid="profile-since" className="text-xs text-ink-3">
          On the team since {day(me.createdAt)}
        </p>
      </div>

      {/* 2. The avatar picker. A `radiogroup` and not a list of buttons: exactly one is chosen, which
          is what the role announces, and `aria-checked` is what a screen reader gets instead of the
          fill that carries it visually. `signup-avatar-picker` uses the same shape. */}
      <fieldset className={CARD}>
        <legend className="text-base font-semibold text-ink">Avatar</legend>
        <p className="mt-1 text-sm text-ink-2">
          Pick a picture. It is how the team finds you on the calendar.
        </p>
        <div
          data-testid="profile-avatar-picker"
          role="radiogroup"
          aria-label="Avatar"
          // TEN TO A ROW, which is what the transcription draws, and `flex-wrap` rather than a fixed
          // ten-column grid so the strip reflows on a narrow pane instead of scrolling sideways —
          // UIE-02 AC-21 puts horizontal scrolling inside a grid, not across a settings form.
          className="mt-4 flex flex-wrap gap-2"
        >
          {choices.map((choice) => {
            const chosen = choice === avatar;
            return (
              <button
                key={choice}
                type="button"
                data-testid="profile-avatar-option"
                data-avatar={choice}
                aria-label={choice}
                role="radio"
                aria-checked={chosen}
                onClick={() => setAvatar(choice)}
                className={
                  // The chosen one is distinguished by FILL and by `aria-checked`, never by colour
                  // alone — the transcription draws it as a dark circle among light ones.
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-pill p-[5px] text-lg transition-colors " +
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                  (chosen ? "bg-primary" : "bg-field hover:bg-track")
                }
              >
                <Avatar value={choice} />
              </button>
            );
          })}
        </div>
        {errors.avatar ? (
          <p
            data-testid="profile-avatar-error"
            role="alert"
            className="mt-3 text-xs text-danger"
          >
            {errors.avatar}
          </p>
        ) : null}
      </fieldset>

      {/* 3. The display name. */}
      <div className={CARD}>
        <label
          className="text-base font-semibold text-ink"
          htmlFor="profile-display-name"
        >
          Display name
        </label>
        <p className="mt-1 text-sm text-ink-2">
          This is the name the rest of the team sees.
        </p>
        <input
          id="profile-display-name"
          data-testid="profile-display-name"
          type="text"
          value={displayName}
          autoComplete="nickname"
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={
            errors.displayName ? "profile-display-name-error" : undefined
          }
          className={`${FIELD} mt-4`}
        />
        {errors.displayName ? (
          <p
            id="profile-display-name-error"
            data-testid="profile-display-name-error"
            role="alert"
            className="mt-1.5 text-xs text-danger"
          >
            {errors.displayName}
          </p>
        ) : null}
      </div>

      {/* EVT-05. The email card — 01-plan.md § 2b. One row: the words on the left, the toggle on the
          right. `type="button"`: inside this `<form>` a bare button would submit the page. */}
      <div className={CARD}>
        <h2 className="text-base font-semibold text-ink">Email</h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Event email</p>
            <p className="mt-0.5 text-sm text-ink-2">
              Emails when an event is announced for your team, when you are invited, and when your
              request is decided.
            </p>
          </div>
          <button
            type="button"
            data-testid="profile-event-email"
            data-enabled={eventEmail ? "true" : "false"}
            role="switch"
            aria-checked={eventEmail}
            aria-label="Event email"
            disabled={savedEventEmail === null}
            onClick={() => setEventEmail((on) => !on)}
            className={
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
              "disabled:opacity-40 " +
              (eventEmail ? "bg-primary" : "bg-track")
            }
          >
            <span
              aria-hidden
              className={
                "inline-block h-5 w-5 rounded-pill bg-white shadow-soft transition-transform " +
                (eventEmail ? "translate-x-[22px]" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      </div>

      {/* 4. The password. */}
      <div className={CARD}>
        <h2 className="text-base font-semibold text-ink">Change password</h2>
        <p className="mt-1 text-sm text-ink-2">
          Leave all three boxes empty if you are not changing your password.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <PasswordField
            id="profile-current-password"
            label="Current password"
            placeholder="Your current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={errors.currentPassword}
            autoComplete="current-password"
          />
          {/* Two columns on a wide pane, stacked on a narrow one — the transcription's pairing, and
              `min-w-0` on each child so a long validation sentence wraps instead of widening them. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="profile-new-password"
              label="New password"
              placeholder={`At least ${PASSWORD_MIN} characters`}
              value={newPassword}
              onChange={setNewPassword}
              error={errors.newPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="profile-confirm-password"
              label="Confirm password"
              placeholder="Type the new password again"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      {/* 5. The save bar — the card the transcription cut off, and this agent's own decision about
          what belongs in it. ONE submit for the whole page. */}
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0">
          {outcome ? (
            <p
              data-testid="profile-outcome"
              data-kind={outcome.kind}
              // A success is announced politely and a failure assertively — `role="alert"` on a
              // "Profile saved." would interrupt a screen reader mid-sentence to report good news.
              role={outcome.kind === "error" ? "alert" : "status"}
              className={
                "text-sm " +
                (outcome.kind === "error" ? "text-danger" : "text-ink-2")
              }
            >
              {outcome.message}
            </p>
          ) : (
            <p className="text-sm text-ink-3">
              Changes are saved only when you press save.
            </p>
          )}
        </div>

        <button
          type="submit"
          data-testid="profile-save"
          disabled={saving}
          className="rounded-pill bg-primary px-5 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

    </form>
  );
}
