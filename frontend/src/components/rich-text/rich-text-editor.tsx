"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { mentionExtension } from "./mention";
import { RichTextToolbar } from "./rich-text-toolbar";

/**
 * `extensions` harus stabil (bukan dibuat ulang tiap render) supaya Tiptap
 * tidak membangun ulang state editor saat induknya re-render.
 */
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    },
  }),
  // textStyle + color + fontFamily + fontSize dalam satu paket.
  TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  mentionExtension,
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  onOpenTask,
}: {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  onOpenTask?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [isEmpty, setIsEmpty] = useState(!value);
  const [textLength, setTextLength] = useState(0);

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text min-h-[42vh] px-3 py-2 text-sm outline-none",
        "data-slot": "rich-text-input",
      },
    },
    onCreate: ({ editor: instance }) => {
      setIsEmpty(instance.isEmpty);
      setTextLength(instance.getText().length);
    },
    onUpdate: ({ editor: instance }) => {
      setIsEmpty(instance.isEmpty);
      setTextLength(instance.getText().length);
      onChange(instance.getHTML(), instance.getText());
    },
  });

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const chip = target.closest('[data-mention-kind="task"]');
    const id = chip?.getAttribute("data-id");
    if (!id || !onOpenTask) return;
    event.preventDefault();
    onOpenTask(id);
  }

  return (
    <div
      data-slot="rich-text-editor"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background"
    >
      {editor && <RichTextToolbar editor={editor} />}
      <div className="relative min-h-0 flex-1 overflow-y-auto" onClick={handleClick}>
        {placeholder && isEmpty && (
          <p className="pointer-events-none absolute inset-x-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 border-t px-3 py-1 text-[11px] text-muted-foreground",
          textLength > 18_000 && "text-destructive"
        )}
      >
        {textLength > 18_000 && <span>{t("docs.nearLimit")}</span>}
        <span>
          {textLength.toLocaleString("id-ID")} / 20.000
        </span>
      </div>
    </div>
  );
}
