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
