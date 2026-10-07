"use client";

import { useRef, useState } from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { addTicket, type PreviewTicket } from "./ticket-preview-data";
import type { Factory, Product } from "@/lib/types";

interface PickedFile {
  fileName: string;
  mime: string;
  size: number;
  objectUrl: string;
}

const EMPTY = {
  title: "",
  productId: "",
  factoryId: "",
  virtualId: "",
  problemDetail: "",
  chronology: "",
  triedSolutions: "",
};

export function TicketFormDialog({
  open,
  onOpenChange,
  products,
  factories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  factories: Factory[];
  onCreated: (ticket: PreviewTicket) => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productOptions = products.map((product) => ({ value: String(product.id), label: product.name }));
  const factoryOptions = factories.map((item) => ({ value: String(item.id), label: item.name }));
  const product = products.find((item) => item.id === Number(form.productId));
  // ponytail: produk tidak menyimpan relasi pabrik di basis data (tabel product_factories kosong),
  // jadi pabrik dipilih manual. Kalau relasinya nanti terisi, jatuhkan nilai awal dari situ.
  const factory = factories.find((item) => item.id === Number(form.factoryId));

  const reset = () => {
    files.forEach((file) => URL.revokeObjectURL(file.objectUrl));
    setFiles([]);
    setForm(EMPTY);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).map((file) => ({
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      objectUrl: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!product || !factory || !form.virtualId.trim() || !form.problemDetail.trim()) {
      toast.error(t("ticket.form.required"));
      return;
    }
    const ticket = addTicket({
      title: form.title.trim() || t("ticket.form.defaultTitle", { name: product.name }),
      productId: product.id,
      productName: product.name,
      factoryId: factory.id,
      factoryName: factory.name,
      virtualId: form.virtualId.trim(),
      problemDetail: form.problemDetail.trim(),
      chronology: form.chronology.trim(),
      triedSolutions: form.triedSolutions.trim(),
      attachments: files.map(({ fileName, mime, size, objectUrl }) => ({ fileName, mime, size, objectUrl })),
    });
    toast.success(t("ticket.created"));
    onCreated(ticket);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("ticket.form.title")}</DialogTitle>
          <DialogDescription>{t("ticket.form.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("common.product")}</Label>
            <Select
              value={form.productId}
              items={productOptions}
              onValueChange={(value) => {
                if (value === null) return;
                setForm((prev) => ({ ...prev, productId: String(value) }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("common.factory")}</Label>
            <Select
              value={form.factoryId}
              items={factoryOptions}
              onValueChange={(value) => setForm((prev) => ({ ...prev, factoryId: value as string }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("common.factory")} />
              </SelectTrigger>
              <SelectContent>
                {factoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("ticket.form.factoryHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-virtual-id">Virtual ID</Label>
            <Input
              id="ticket-virtual-id"
              value={form.virtualId}
              onChange={(event) => setForm((prev) => ({ ...prev, virtualId: event.target.value }))}
              placeholder="VID-00000"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket-title">{t("ticket.form.titleLabel")}</Label>
            <Input
              id="ticket-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder={t("ticket.form.titlePlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ticket-problem">{t("ticket.form.problemDetail")}</Label>
            <Textarea
              id="ticket-problem"
              rows={3}
              value={form.problemDetail}
              onChange={(event) => setForm((prev) => ({ ...prev, problemDetail: event.target.value }))}
              placeholder={t("ticket.form.problemPlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ticket-chronology">{t("ticket.form.chronology")}</Label>
            <Textarea
              id="ticket-chronology"
              rows={3}
              value={form.chronology}
              onChange={(event) => setForm((prev) => ({ ...prev, chronology: event.target.value }))}
              placeholder={t("ticket.form.chronologyPlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ticket-solutions">{t("ticket.form.triedSolutions")}</Label>
            <Textarea
              id="ticket-solutions"
              rows={3}
              value={form.triedSolutions}
              onChange={(event) => setForm((prev) => ({ ...prev, triedSolutions: event.target.value }))}
              placeholder={t("ticket.form.solutionsPlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>{t("ticket.form.attachments")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" />
                {t("ticket.form.attach")}
              </Button>
              <span className="text-xs text-muted-foreground">{t("ticket.form.attachHint")}</span>
            </div>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <li key={file.objectUrl} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1 text-xs">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    <span className="max-w-[12rem] truncate">{file.fileName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        URL.revokeObjectURL(file.objectUrl);
                        setFiles((prev) => prev.filter((item) => item.objectUrl !== file.objectUrl));
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{t("ticket.form.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
