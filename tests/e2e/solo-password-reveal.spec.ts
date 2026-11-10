import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-28 — the reveal eye on every password box in the product.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md` and the
// operator's instruction: *"thêm cái nút hiển thị password tại các input password"*.
//
// **IT COVERS `/signin` AND `/signup` AND NOT `/profile`.** That screen has had the control since
// 2026-09-10 and `tests/e2e/solo-profile.spec.ts` test 9 already pins it, including the submit trap.
// The change here was an EXTRACTION — `src/components/PasswordInput.tsx` — so the value of a new
// spec is on the two boxes that did not have it, and duplicating Profile's test would be a second
// copy of an assertion that is already true.
//
// **THE SUBMIT TRAP IS THE REASON HALF THIS FILE EXISTS.** Inside a form, a `<button>` with no
// explicit `type` is a SUBMIT button. On `/profile` that would silently save the page; on these two
// it would attempt a sign-in or a sign-up with a half-typed password, which fails in a way that
// looks like a wrong password rather than like a bug in an eye icon.

const PASSWORD = "password123";
const MEMBER_EMAIL = "thanh@example.com";

/** The two boxes, and what each screen does if its form is submitted by accident. */
const BOXES = [
  {
    name: "sign-in",
    address: "/signin",
    testId: "sign-in-password",
    /** The control that proves the form did NOT submit: it is still on screen afterwards. */
    stillHere: "sign-in-submit",
  },
  {
    name: "sign-up",
    address: "/signup",
    testId: "signup-password",
    stillHere: "signup-submit",
  },
] as const;

async function openForm(page: Page, address: string): Promise<void> {
  await page.goto(address);
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
}

test.describe("SOLO — showing a password", () => {
  for (const box of BOXES) {
    test(`1 (${box.name}): the box hides the password until the eye is pressed, and hides it again`, async ({
      page,
    }) => {
      await openForm(page, box.address);

      const input = page.getByTestId(box.testId);
      const reveal = page.getByTestId(`${box.testId}-reveal`);

      // **THE `type` ATTRIBUTE IS THE WHOLE FEATURE AND IS WHAT THIS ASSERTS.** Not a class, not a
      // data attribute of its own: `type="password"` is what actually stops a browser painting the
      // characters, so a test that checked anything else could pass over a box that still showed
      // dots.
      await expect(input).toHaveAttribute("type", "password");
      await expect(reveal).toHaveAttribute("data-revealed", "false");
      // The label states what pressing it DOES, and it is what a screen reader announces.
      await expect(reveal).toHaveAttribute("aria-label", "Show password");

      await input.fill(PASSWORD);
      await reveal.click();

      await expect(input).toHaveAttribute("type", "text");
      await expect(reveal).toHaveAttribute("data-revealed", "true");
      await expect(reveal).toHaveAttribute("aria-label", "Hide password");
      // AND THE VALUE SURVIVED THE TOGGLE. Swapping an input's `type` in React is the kind of change
      // that can remount the node and lose what was typed into it.
      await expect(input).toHaveValue(PASSWORD);

      await reveal.click();
      await expect(input).toHaveAttribute("type", "password");
      await expect(input).toHaveValue(PASSWORD);
    });

    test(`2 (${box.name}): pressing the eye does NOT submit the form`, async ({ page }) => {
      await openForm(page, box.address);

      const input = page.getByTestId(box.testId);
      // Deliberately the ONLY field filled. A form that submitted here would be sending a request
      // with no email address, and the screen would answer with a refusal that blames the person.
      await input.fill(PASSWORD);
      await page.getByTestId(`${box.testId}-reveal`).click();

      // The form is still on screen, unsubmitted: no refusal, no navigation, no notice.
      await expect(page.getByTestId(box.stillHere)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${box.address}$`));
      await expect(input).toHaveValue(PASSWORD);
    });
  }

  test("3: revealing does not change what is sent — the password still signs somebody in", async ({
    page,
  }) => {
    // **THE ASSERTION THAT MATTERS MOST AND IS THE EASIEST TO LEAVE OUT.** A reveal control that
    // worked visually while corrupting the value — trimming it, re-encoding it, dropping the last
    // keystroke — would pass every test above. The only way to know is to sign in with a revealed
    // box and land inside the product.
    await openForm(page, "/signin");

    await page.getByTestId("sign-in-email").fill(MEMBER_EMAIL);
    await page.getByTestId("sign-in-password").fill(PASSWORD);
    await page.getByTestId("sign-in-password-reveal").click();
    await expect(page.getByTestId("sign-in-password")).toHaveAttribute("type", "text");

    await page.getByTestId("sign-in-submit").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
  });

  test("4: the eye is reachable by keyboard, which is half of why it is a button", async ({
    page,
  }) => {
    await openForm(page, "/signin");

    const reveal = page.getByTestId("sign-in-password-reveal");
    // Focused and operated by the keyboard alone. A `<div onClick>` would look identical, do the
    // same thing under a mouse, and be unreachable here.
    await reveal.focus();
    await expect(reveal).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("sign-in-password")).toHaveAttribute("type", "text");
    // AND `Enter` ON IT STILL DID NOT SUBMIT, which is the same trap as test 2 arriving by the other
    // route: `Enter` inside a form is the keystroke most likely to submit it.
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  });
});
