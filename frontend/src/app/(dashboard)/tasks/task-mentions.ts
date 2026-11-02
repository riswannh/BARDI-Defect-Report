/**
 * Penyebutan @user di deskripsi task.
 *
 * Deskripsi adalah sumber kebenaran: akun yang disebut dibaca dari teks
 * "@Nama", bukan dari state terpisah. Nama dicocokkan dari yang terpanjang
 * supaya "@Ani" tidak ikut menangkap "@Anita", dan teks yang sudah cocok
 * diblokir agar satu nama tidak dihitung dua kali.
 */
export function mentionedIdsFromText(
  text: string,
  users: Array<{ id: string; name: string }>
): string[] {
  let rest = text;
  const hit = new Set<string>();
  for (const person of [...users].sort((a, b) => b.name.length - a.name.length)) {
    const name = person.name.trim();
    if (!name) continue;
    const token = `@${name}`;
    if (rest.includes(token)) {
      hit.add(person.id);
      rest = rest.split(token).join(" ");
    }
  }
  return [...hit];
}

/** Satu sebutan valid di dalam teks, siap disorot di atas Textarea. */
export interface MentionRun {
  start: number;
  end: number;
  name: string;
}

/**
 * Posisi setiap sebutan "@Nama" yang benar-benar cocok dengan akun, dipakai
 * lapisan sorotan di form Task supaya orang tahu sebutannya berhasil dipasang.
 */
export function mentionRuns(
  text: string,
  users: Array<{ id: string; name: string }>
): MentionRun[] {
  const names = [...users]
    .map((person) => person.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const runs: MentionRun[] = [];
  let index = 0;
  while (index < text.length) {
    const at = text.indexOf("@", index);
    if (at < 0) break;
    const previous = at === 0 ? "" : text[at - 1];
    // "a@b.com" bukan sebutan: tanda @ harus di awal kata.
    if (previous && !/\s/.test(previous)) {
      index = at + 1;
      continue;
    }
    const rest = text.slice(at + 1);
    const name = names.find((candidate) => {
      if (rest.toLowerCase().slice(0, candidate.length) !== candidate.toLowerCase()) return false;
      const next = rest[candidate.length] ?? "";
      return next === "" || !/[\p{L}\p{N}._-]/u.test(next);
    });
    if (!name) {
      index = at + 1;
      continue;
    }
    const end = at + 1 + name.length;
    runs.push({ start: at, end, name });
    index = end;
  }
  return runs;
}
