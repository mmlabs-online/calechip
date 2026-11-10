// Flat config, ESLint 10. Verified against the installed packages rather than recalled — ESLint
// resolved to 10.x, not the 9 named when the stack was chosen, and the two do not share a config
// surface. See "Versions the model cannot recall" in .ai/standards/tech-stack.md.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import uiLanguage from "./ui-language.json" with { type: "json" };

/**
 * RULE-02 lives here.
 *
 * `.ai/standards/architecture.md` declares `src/lib/data/` as the data-access seam and says nothing
 * outside it may import the Supabase client. That sentence is unenforceable as prose, so this is the
 * mechanism: an import of `@supabase/*` from anywhere under `src/` other than the seam is an error,
 * and `pnpm lint` is in the Definition of Done.
 *
 * The same boundary is declared again in `.ai/registry/boundaries.json` and checked by D12, which
 * reports a crossing even if this rule is later loosened.
 */
const SEAM = "src/lib/data";

/**
 * § Language lives here.
 *
 * `.ai/standards/ui-design-system.md` § Language says every string the interface renders is English,
 * including the user-facing `message` half of every `{ code, message }` returned across the seam.
 * That sentence is unenforceable as prose. This is the mechanism, and it is wired into machinery that
 * already exists: `pnpm lint` is R3 in the review checklist and Definition of Done item 3 at `/ship`.
 * Nothing new has to be remembered by anyone.
 *
 * THE STATE LIVES IN `ui-language.json`, not here — the same one-declaration/two-consumers shape
 * `.ai/registry/boundaries.json` uses for RULE-02. The other consumer is `tests/ui-language.test.ts`,
 * which asserts the half a lint rule cannot: that the exception files still CONTAIN diacritics. Read
 * that file for why the negative half is the one that matters.
 *
 * THIS IS A RATCHET, NOT A GATE. `copyDebt` holds the twelve files that predate the standard, so the
 * rule would fail on them today. Rather than wait for the sweep and leave every feature built in the
 * meantime unprotected, the rule is in force NOW for everything else. OPS-001 and OPS-002 empty the
 * list. It only ever shrinks; growing it is how a ratchet becomes a suppression list.
 */
const { copyDebt: COPY_DEBT, userContent: USER_CONTENT, diacritic: DIACRITIC } = uiLanguage;

const LANGUAGE_MESSAGE =
  "\u00a7 Language: every string the interface renders is English \u2014 see " +
  ".ai/standards/ui-design-system.md. If this is user content rather than interface copy (a display " +
  "name, a team name, note text), it belongs in src/lib/fixtures.ts or supabase/seed.sql, which are " +
  "the standard's stated exception.";


export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "_figma/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The hooks, the audit and their tests are Node programs, not browser code. They are linted —
    // a guard with a syntax error fails open and silently — but under Node globals.
    files: ["scripts/**/*.mjs", ".claude/hooks/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [`${SEAM}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@supabase/**"],
              message:
                "RULE-02: the Supabase client may only be imported inside src/lib/data/, the " +
                "data-access seam declared in .ai/standards/architecture.md. Reach the datastore " +
                "through the seam.",
            },
          ],
        },
      ],
    },
  },
  {
    // § Language. The seam is NOT exempt here, unlike RULE-02 above: the `message` half of every
    // refusal it returns is rendered to a user, so it is interface copy wherever it lives.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [...USER_CONTENT, ...COPY_DEBT],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${DIACRITIC}/]`, message: LANGUAGE_MESSAGE },
        { selector: `TemplateElement[value.raw=/${DIACRITIC}/]`, message: LANGUAGE_MESSAGE },
        { selector: `JSXText[value=/${DIACRITIC}/]`, message: LANGUAGE_MESSAGE },
      ],
    },
  },
);
