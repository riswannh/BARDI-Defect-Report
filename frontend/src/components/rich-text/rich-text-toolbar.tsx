"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  IndentDecrease,
  IndentIncrease,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FONT_FAMILIES = [
  { value: "default", label: "Sans Serif" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { value: "'Courier New', monospace", label: "Mono" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "24px"];

const TEXT_COLORS = [
  "#111827",
  "#475569",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
];

const ALIGNMENTS = [
  { value: "left", labelKey: "docs.toolbar.alignLeft", Icon: AlignLeft },
  { value: "center", labelKey: "docs.toolbar.alignCenter", Icon: AlignCenter },
  { value: "right", labelKey: "docs.toolbar.alignRight", Icon: AlignRight },
  { value: "justify", labelKey: "docs.toolbar.alignJustify", Icon: AlignJustify },
] as const;

function ToolbarButton({
  active,
  label,
  disabled,
  onClick,
  children,
  attrs,
}: {
  active?: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  attrs?: Record<string, string>;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-xs"
      aria-label={label}
      title={label}
      aria-pressed={active ? true : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn("shrink-0", active && "text-foreground")}
      {...attrs}
    >
      {children}
    </Button>
  );
}

/** Toolbar editor dokumentasi — urutannya mengikuti compose email. */
export function RichTextToolbar({ editor }: { editor: Editor }) {
  const { t } = useLanguage();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const fontFamily =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "default";
  const fontSize = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "default";
  const currentAlign = ALIGNMENTS.find((item) => editor.isActive({ textAlign: item.value }))?.value ?? "left";

  function applyLink() {
    const raw = linkUrl.trim();
    if (!raw) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const href = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
    setLinkUrl("");
  }

  return (
    <div
      data-slot="rich-text-toolbar"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 px-1.5 py-1.5 backdrop-blur"
    >
      <Select
        value={FONT_FAMILIES.some((item) => item.value === fontFamily) ? fontFamily : "default"}
        onValueChange={(value) => {
          const next = String(value);
          if (next === "default") editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(next).run();
        }}
        items={FONT_FAMILIES}
      >
        <SelectTrigger
          className="h-6 w-[104px] text-xs"
          aria-label={t("docs.toolbar.fontFamily")}
          data-toolbar="font-family"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={FONT_SIZES.includes(fontSize) ? fontSize : "default"}
        onValueChange={(value) => {
          const next = String(value);
          if (next === "default") editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(next).run();
        }}
        items={[{ value: "default", label: "16px" }, ...FONT_SIZES.map((size) => ({ value: size, label: size }))]}
      >
        <SelectTrigger
          className="h-6 w-[74px] text-xs"
          aria-label={t("docs.toolbar.fontSize")}
          data-toolbar="font-size"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">16px</SelectItem>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={size}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <ToolbarButton
        active={editor.isActive("bold")}
        label={t("docs.toolbar.bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        label={t("docs.toolbar.italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        label={t("docs.toolbar.underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        label={t("docs.toolbar.strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("docs.toolbar.color")}
              title={t("docs.toolbar.color")}
              data-toolbar="color"
            />
          }
        >
          <span className="flex size-3.5 flex-col items-center justify-center">
            <span className="text-[11px] leading-none font-semibold">A</span>
            <span
              aria-hidden
              className="mt-0.5 h-0.5 w-3 rounded-full"
              style={{ backgroundColor: editor.getAttributes("textStyle").color ?? "currentColor" }}
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                title={color}
                data-color={color}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="size-6 rounded-md border border-border/60 transition hover:scale-105"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <DropdownMenuItem className="mt-1 justify-center text-xs" onClick={() => editor.chain().focus().unsetColor().run()}>
            {t("docs.toolbar.colorDefault")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("docs.toolbar.align")}
              title={t("docs.toolbar.align")}
              data-toolbar="align"
            />
          }
        >
          {(() => {
            const Icon = ALIGNMENTS.find((item) => item.value === currentAlign)?.Icon ?? AlignLeft;
            return <Icon className="size-3.5" />;
          })()}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ALIGNMENTS.map(({ value, labelKey, Icon }) => (
            <DropdownMenuItem key={value} onClick={() => editor.chain().focus().setTextAlign(value).run()}>
              <Icon className="size-3.5" /> {t(labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarButton
        active={editor.isActive("orderedList")}
        label={t("docs.toolbar.orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("bulletList")}
        label={t("docs.toolbar.bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("docs.toolbar.indent")}
        disabled={!editor.can().sinkListItem("listItem")}
        onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
      >
        <IndentIncrease className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("docs.toolbar.outdent")}
        disabled={!editor.can().liftListItem("listItem")}
        onClick={() => editor.chain().focus().liftListItem("listItem").run()}
      >
        <IndentDecrease className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        label={t("docs.toolbar.quote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <ToolbarButton
        active={editor.isActive("link")}
        label={t("docs.toolbar.link")}
        attrs={{ "data-toolbar": "link" }}
        onClick={() => {
          setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
          setLinkOpen(true);
        }}
      >
        <Link2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label={t("docs.toolbar.clear")}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <Eraser className="size-3.5" />
      </ToolbarButton>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("docs.toolbar.linkTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://contoh.com"
            aria-label={t("docs.toolbar.linkUrl")}
            data-field="link-url"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setLinkOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={applyLink}>
              {t("docs.toolbar.linkApply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
