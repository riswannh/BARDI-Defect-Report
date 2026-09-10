"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";

interface MasterItem {
  id: number;
  name: string;
}

interface MasterListProps {
  items: MasterItem[];
  onAdd: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  addPlaceholder?: string;
  readOnly?: boolean;
}

export function MasterList({
  items,
  onAdd,
  onRename,
  onDelete,
  addPlaceholder,
  readOnly = false,
}: MasterListProps) {
  const { t } = useLanguage();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
  }

  function startEdit(item: MasterItem) {
    setEditingId(item.id);
    setEditingName(item.name);
  }

  function submitEdit() {
    if (editingId !== null && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <form onSubmit={submitAdd} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={addPlaceholder ?? t("masterList.newName")}
          />
          <Button type="submit" size="sm">
            <Plus className="size-4" /> {t("common.add")}
          </Button>
        </form>
      )}

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            {editingId === item.id ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-7"
                />
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
                <span className="text-sm">{item.name}</span>
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
