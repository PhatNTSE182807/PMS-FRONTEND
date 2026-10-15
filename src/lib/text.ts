/** "Nguyễn Văn Đức" → "Nguyen Van Duc" — for accent-insensitive search and generated e-mails. */
export function removeDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/** Lower-case, accent-free form used to compare search terms. */
export const toSearchable = (value: string) => removeDiacritics(value).toLowerCase().trim()
