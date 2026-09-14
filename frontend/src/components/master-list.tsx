"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";

interface MasterItem {
  id: number;
  name: string;
  sku?: string | null;
}

interface MasterListProps {
  items: MasterItem[];
  onAdd: (name: string, sku?: string) => void;
  onRename: (id: number, name: string, sku?: string) => void;
  onDelete: (id: number) => void;
  addPlaceholder?: string;
  readOnly?: boolean;
  /**
   * Produk punya SKU di samping nama; problem/status/pabrik hanya nama.
   * Saat aktif, formulir dan baris menampilkan kolom SKU.
   */
  withSku?: boolean;
}

export function MasterList({
  items,
  onAdd,
  onRename,
  onDelete,
  addPlaceholder,
  readOnly = false,
  withSku = false,
}: MasterListProps) {
  const { t } = useLanguage();
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSku, setEditingSku] = useState("");

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim(), withSku ? newSku.trim() : undefined);
    setNewName("");
    setNewSku("");
  }

  function startEdit(item: MasterItem) {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingSku(item.sku ?? "");
  }

  function submitEdit() {
    if (editingId !== null && editingName.trim()) {
      onRename(
        editingId,
        editingName.trim(),
        withSku ? editingSku.trim() : undefined
      );
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <form onSubmit={submitAdd} className="flex flex-wrap gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={addPlaceholder ?? t("masterList.newName")}
            className={withSku ? "min-w-48 flex-1" : undefined}
          />
          {withSku && (
            <Input
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder={t("masterList.skuPlaceholder")}
              className="w-full sm:w-44"
            />
          )}
          <Button type="submit" size="sm">
            <Plus className="size-4" /> {t("common.add")}
          </Button>
        </form>
      )}

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
          >
            {editingId === item.id ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className={withSku ? "h-7 min-w-40 flex-1" : "h-7"}
                />
                {withSku && (
                  <Input
                    value={editingSku}
                    onChange={(e) => setEditingSku(e.target.value)}
                    placeholder={t("common.sku")}
                    className="h-7 w-full sm:w-40"
                  />
                )}
                <Button size="icon-xs" variant="ghost" onClick={submitEdit}>
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm">{item.name}</span>
                  {withSku && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.sku || t("masterList.skuEmpty")}
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            {t("masterList.empty")}
          </li>
        )}
      </ul>
    </div>
  );
}
