// Today's date as YYYY-MM-DD in the user's LOCAL timezone.
// (new Date().toISOString() uses UTC — off by a day for +7 before 07:00.)
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
