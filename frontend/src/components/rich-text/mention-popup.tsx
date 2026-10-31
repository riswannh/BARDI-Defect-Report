"use client";

import { createRoot, type Root } from "react-dom/client";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { MentionList, type MentionListRef } from "./mention-list";
import type { MentionItem } from "./mention";

interface PopupHandle {
  container: HTMLDivElement;
  root: Root;
  listRef: { current: MentionListRef | null };
  unmount: (() => void) | null;
}

/**
 * Menyambungkan popup React ke plugin mention Tiptap. Tiptap 3 menyediakan
 * `props.mount(element)` yang menempelkan elemen ke body, menguncinya ke posisi
 * kursor, dan mengurus scroll/resize — jadi tidak perlu pustaka positioning
 * sendiri. Selain itu dialog (Base UI) memakai portal + focus trap, sehingga
 * popup HARUS berada di luar dialog; itulah alasan mount, bukan render di
 * dalam komponen editor.
 */
export function renderMentionPopup() {
  let popup: PopupHandle | null = null;

  function mountHandle(props: SuggestionProps<MentionItem, MentionItem>): PopupHandle {
    const container = document.createElement("div");
    container.className = "z-[60]";
    const root = createRoot(container);
    const listRef: { current: MentionListRef | null } = { current: null };
    root.render(
      <MentionList
        ref={listRef}
        items={props.items}
        loading={props.loading}
        command={(item) => props.command(item)}
      />
    );
    const unmount = props.mount(container);
    return { container, root, listRef, unmount };
  }

  function render(props: SuggestionProps<MentionItem, MentionItem>) {
    popup?.root.render(
      <MentionList
        ref={popup.listRef}
        items={props.items}
        loading={props.loading}
        command={(item) => props.command(item)}
      />
    );
  }

  return {
    onStart(props: SuggestionProps<MentionItem, MentionItem>) {
      popup?.unmount?.();
      popup = mountHandle(props);
    },
    onUpdate(props: SuggestionProps<MentionItem, MentionItem>) {
      render(props);
    },
    onKeyDown(props: SuggestionKeyDownProps) {
      if (props.event.key === "Escape") {
        // Plugin mention sendiri yang menutup popup (dispatchExit); jangan
        // biarkan Escape merambat ke dialog Base UI, karena draf catatan
        // akan ikut tertutup dan tulisannya hilang.
        props.event.stopPropagation();
        return false;
      }
      return popup?.listRef.current?.onKeyDown({ event: props.event }) ?? false;
    },
    onExit() {
      popup?.unmount?.();
      popup?.root.unmount();
      popup?.container.remove();
      popup = null;
    },
  };
}
