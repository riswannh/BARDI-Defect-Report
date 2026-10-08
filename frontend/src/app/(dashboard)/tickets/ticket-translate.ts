/**
 * ponytail: kamus contoh untuk pratinjau — Fase 2 menggantinya dengan
 * POST /api/translate (LibreTranslate self-host di VPS BARDI + cache).
 */
import type { Language } from "@/lib/i18n";

const SAMPLE: Record<string, { id: string; en: string; zh: string }> = {
  "收到，我们检查同一批次的扬声器模块。": {
    id: "Diterima, kami periksa modul speaker dari batch yang sama.",
    en: "Received, we are checking the speaker module from the same batch.",
    zh: "收到，我们检查同一批次的扬声器模块。",
  },
  "Pabrik, mohon dicek modul speaker batch ini.": {
    id: "Pabrik, mohon dicek modul speaker batch ini.",
    en: "Factory, please check the speaker module for this batch.",
    zh: "工厂，请检查这一批次的扬声器模块。",
  },
  "Sudah kami cek, kemungkinan modul daya. Kami uji dulu di lab.": {
    id: "Sudah kami cek, kemungkinan modul daya. Kami uji dulu di lab.",
    en: "We have checked it; it is likely the power module. We will test it in the lab first.",
    zh: "我们已检查，可能是电源模块。先在实验室测试。",
  },
  "Kami sudah uji 2 unit, gejalanya sama. Kami eskalasi ke pabrik.": {
    id: "Kami sudah uji 2 unit, gejalanya sama. Kami eskalasi ke pabrik.",
    en: "We tested 2 units, the symptom is the same. We are escalating to the factory.",
    zh: "我们测试了 2 台，症状相同。我们升级到工厂处理。",
  },
  "Baut pengunci longgar, unit goyang saat dipakai.": {
    id: "Baut pengunci longgar, unit goyang saat dipakai.",
    en: "The locking bolt is loose; the unit wobbles in use.",
    zh: "锁紧螺栓松动，使用时机身晃动。",
  },
  "Dilaporkan 20 Sep, diperbaiki 24 Sep.": {
    id: "Dilaporkan 20 Sep, diperbaiki 24 Sep.",
    en: "Reported 20 Sep, repaired 24 Sep.",
    zh: "9 月 20 日报告，9 月 24 日修复。",
  },
  "Kencangkan baut, ganti baut cadangan.": {
    id: "Kencangkan baut, ganti baut cadangan.",
    en: "Tighten the bolt, replace it with the spare.",
    zh: "拧紧螺栓，更换备用螺栓。",
  },
};

/** Terjemahan contoh satu teks; null kalau teksnya tidak ada di kamus. */
export function translationSample(text: string, language: Language): string | null {
  return SAMPLE[text]?.[language] ?? null;
}
