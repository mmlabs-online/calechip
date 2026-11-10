// EVT-10, ADR-056 decision 1. **THE ONE EDITOR OF AN EVENT'S DESCRIPTION**, on the create and the
// edit form. It writes HTML; what it writes is only ever an affordance — the render sanitises
// whatever is stored (`DescriptionHtml`), and the form sanitises again before saving.
//
// **THE ONLY FILE UNDER `src/` THAT IMPORTS `@tiptap/*`** (AC-12) — `tests/description-html.test.ts`
// scans the tree for it.
import { useRef, useState, type ChangeEvent, type JSX, type KeyboardEvent, type ReactNode } from "react";
import { EditorContent, Node, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { DESCRIPTION_HREF, DESCRIPTION_RENDER_CLASS } from "@/components/DescriptionHtml";
import { downscaleToDataUrl } from "@/lib/description-image";
import { DESCRIPTION_IMAGE_TYPES, DESCRIPTION_MAX_BYTES, descriptionBytes } from "@/lib/domain/types";

// EVT-11 § 4.4. In-house rather than `@tiptap/extension-image` (01-plan.md § 8 alternative 1): a
// block picture whose source is an embedded `data:image/…` URL and nothing else. `parseHTML` reads
// only those back, so a remote picture pasted in never becomes a node; the render's sanitiser is
// still the control (`DESCRIPTION_IMAGE_SRC`).
const DescriptionImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: false,
  addAttributes() {
    return { src: { default: null }, alt: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'img[src^="data:image/"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", HTMLAttributes];
  },
});

export const DESCRIPTION_PICTURE_TOO_LARGE =
  "This picture would make the description larger than 1 MB. Remove a picture or choose a smaller one.";

// § 2b. Six inks already in the theme, so coloured text stays legible on `--color-card`. Hex, as
// `DESCRIPTION_STYLES.span.color` accepts and as Tiptap writes it back unchanged (AC-4).
const SWATCHES: readonly { key: string; label: string; hex: string }[] = [
  { key: "ink", label: "Ink", hex: "#241f45" },
  { key: "ink-2", label: "Muted ink", hex: "#5a5480" },
  { key: "pto-ink", label: "Peach ink", hex: "#a0491a" },
  { key: "wfh-ink", label: "Mint ink", hex: "#17694e" },
  { key: "event-ink", label: "Event ink", hex: "#6b230a" },
  { key: "danger", label: "Red", hex: "#be123c" },
];

// AC-7. An address with no scheme is taken as https; one with any other scheme is not a link.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function linkHref(typed: string): string | null {
  const trimmed = typed.trim();
  if (trimmed === "") return null;
  const href = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  return DESCRIPTION_HREF.test(href) ? href : null;
}

type Panel = "none" | "link" | "color";

function hasPicture(editor: Editor): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") found = true;
    return !found;
  });
  return found;
}

const BUTTON =
  "inline-flex size-7 items-center justify-center rounded-lg text-ink-2 hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";
const PRESSED = "bg-card text-ink shadow-sm";

function ToolButton({
  testId,
  label,
  shortcut,
  pressed,
  onPress,
  children,
}: {
  testId: string;
  label: string;
  shortcut?: string;
  /** Present for a toggle (AC-1, `aria-pressed`); absent for a button that opens a row. */
  pressed?: boolean;
  onPress: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      data-testid={testId}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={pressed}
      // The editor keeps focus, and so its selection, while a format is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={`${BUTTON} ${pressed ? PRESSED : ""}`}
    >
      {children}
    </button>
  );
}

function Divider(): JSX.Element {
  return <span aria-hidden className="mx-0.5 h-5 w-px self-center bg-line" />;
}

/** ADR-056 decision 1. `value` is read at mount only; the edit form mounts this after the event has
 *  loaded. `onChange` receives `""` when the editor holds no text (AC-6), else its HTML. */
export default function DescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}): JSX.Element {
  const [panel, setPanel] = useState<Panel>("none");
  const [linkText, setLinkText] = useState("");
  const [pictureError, setPictureError] = useState<string | null>(null);
  const pictureInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => DESCRIPTION_HREF.test(url),
        },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      DescriptionImage,
    ],
    content: value,
    editorProps: {
      attributes: {
        "data-testid": "event-description-input",
        "aria-label": "Description",
        class: `${DESCRIPTION_RENDER_CLASS} min-h-32 px-3.5 py-2.5 outline-none`,
      },
    },
    // EVT-11. A picture is content though it has no text.
    onUpdate: ({ editor: e }) =>
      onChange(e.getText().trim() === "" && !hasPicture(e) ? "" : e.getHTML()),
  });

  // AC-1. Re-read on every transaction so each toggle's `aria-pressed` follows the caret.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }: { editor: Editor }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      empty: e.isEmpty,
    }),
  });

  function toggle(panelName: Panel): void {
    if (panelName === "link") setLinkText(active.href);
    setPanel(panel === panelName ? "none" : panelName);
  }

  function applyLink(): void {
    const href = linkHref(linkText);
    if (href !== null) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setPanel("none");
  }

  function removeLink(): void {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setPanel("none");
  }

  function onLinkKey(e: KeyboardEvent<HTMLInputElement>): void {
    // Enter would otherwise submit the event form around this field.
    if (e.key === "Enter") {
      e.preventDefault();
      applyLink();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPanel("none");
      editor.commands.focus();
    }
  }

  // EVT-11 § 4.4. Shrink, measure against the cap, then insert — or say why not and change nothing.
  async function onPicture(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Step 4: the same file can be chosen again after a refusal.
    input.value = "";
    if (!file) return;
    const picture = await downscaleToDataUrl(file);
    if (!picture.ok) {
      setPictureError(picture.error.message);
      return;
    }
    const imgHtml = `<img src="${picture.value}" alt="">`;
    if (descriptionBytes(editor.getHTML()) + descriptionBytes(imgHtml) > DESCRIPTION_MAX_BYTES) {
      setPictureError(DESCRIPTION_PICTURE_TOO_LARGE);
      return;
    }
    editor.chain().focus().insertContent({ type: "image", attrs: { src: picture.value, alt: "" } }).run();
    setPictureError(null);
  }

  // A fresh chain per press: a chain built at render holds that render's state and runs once.
  const run = () => editor.chain().focus();
  const icon = { size: 16, strokeWidth: 2.25 } as const;

  return (
    <div className="rounded-[14px] bg-field focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
      <div
        data-testid="event-description-toolbar"
        role="toolbar"
        aria-label="Description formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1"
      >
        <ToolButton testId="event-description-bold" label="Bold" shortcut="Ctrl+B" pressed={active.bold} onPress={() => run().toggleBold().run()}>
          <Bold {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-italic" label="Italic" shortcut="Ctrl+I" pressed={active.italic} onPress={() => run().toggleItalic().run()}>
          <Italic {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-underline" label="Underline" shortcut="Ctrl+U" pressed={active.underline} onPress={() => run().toggleUnderline().run()}>
          <Underline {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-strike" label="Strikethrough" shortcut="Ctrl+Shift+S" pressed={active.strike} onPress={() => run().toggleStrike().run()}>
          <Strikethrough {...icon} />
        </ToolButton>
        <Divider />
        <ToolButton testId="event-description-h2" label="Heading 2" pressed={active.h2} onPress={() => run().toggleHeading({ level: 2 }).run()}>
          <Heading2 {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-h3" label="Heading 3" pressed={active.h3} onPress={() => run().toggleHeading({ level: 3 }).run()}>
          <Heading3 {...icon} />
        </ToolButton>
        <Divider />
        <ToolButton testId="event-description-bullet-list" label="Bulleted list" pressed={active.bulletList} onPress={() => run().toggleBulletList().run()}>
          <List {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-ordered-list" label="Numbered list" pressed={active.orderedList} onPress={() => run().toggleOrderedList().run()}>
          <ListOrdered {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-blockquote" label="Quote" pressed={active.blockquote} onPress={() => run().toggleBlockquote().run()}>
          <Quote {...icon} />
        </ToolButton>
        <Divider />
        <ToolButton testId="event-description-link" label="Link" onPress={() => toggle("link")}>
          <LinkIcon {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-color" label="Text colour" onPress={() => toggle("color")}>
          <Palette {...icon} />
        </ToolButton>
        <Divider />
        <ToolButton testId="event-description-align-left" label="Align left" pressed={active.left} onPress={() => run().setTextAlign("left").run()}>
          <AlignLeft {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-align-center" label="Align centre" pressed={active.center} onPress={() => run().setTextAlign("center").run()}>
          <AlignCenter {...icon} />
        </ToolButton>
        <ToolButton testId="event-description-align-right" label="Align right" pressed={active.right} onPress={() => run().setTextAlign("right").run()}>
          <AlignRight {...icon} />
        </ToolButton>
        <Divider />
        <ToolButton testId="event-description-picture" label="Insert picture" onPress={() => pictureInput.current?.click()}>
          <ImagePlus {...icon} />
        </ToolButton>
        <input
          ref={pictureInput}
          data-testid="event-description-picture-input"
          type="file"
          accept={DESCRIPTION_IMAGE_TYPES.join(",")}
          hidden
          onChange={(e) => void onPicture(e)}
        />
      </div>

      {pictureError !== null ? (
        <p data-testid="event-description-picture-error" role="alert" className="px-3.5 pt-1.5 text-sm text-danger">
          {pictureError}
        </p>
      ) : null}

      {panel === "link" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5">
          <input
            data-testid="event-description-link-input"
            type="url"
            aria-label="Link address"
            placeholder="https://…"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            onKeyDown={onLinkKey}
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-card px-2.5 py-1 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-ink"
          />
          <button
            data-testid="event-description-link-apply"
            type="button"
            onClick={applyLink}
            className="rounded-lg bg-ink px-2.5 py-1 text-xs font-bold text-card"
          >
            Apply
          </button>
          {active.link ? (
            <button
              data-testid="event-description-link-remove"
              type="button"
              onClick={removeLink}
              className="rounded-lg px-2.5 py-1 text-xs font-bold text-ink-2 hover:text-ink"
            >
              Remove link
            </button>
          ) : null}
        </div>
      ) : null}

      {panel === "color" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5">
          <button
            data-testid="event-description-color-default"
            type="button"
            aria-label="Default colour"
            title="Default colour"
            onClick={() => {
              run().unsetColor().run();
              setPanel("none");
            }}
            className="size-5 rounded-full border-2 border-ink-3 bg-card"
          />
          {SWATCHES.map((s) => (
            <button
              key={s.key}
              data-testid={`event-description-color-${s.key}`}
              type="button"
              aria-label={s.label}
              title={s.label}
              onClick={() => {
                run().setColor(s.hex).run();
                setPanel("none");
              }}
              className="size-5 rounded-full"
              style={{ backgroundColor: s.hex }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative">
        {active.empty ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-2.5 text-sm text-ink-3"
          >
            Tell people what to expect
          </span>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
