// Amount each other person owes on a split / proxy-purchase transaction.
// - หารบิล (includeMe !== false): divide by people + me  → amount / (N + 1)
// - ฝากซื้อ (includeMe === false): collect full from others, we take no share → amount / N
export function perHead(tx) {
  const n = (tx.splitWith?.length || 0) + (tx.includeMe === false ? 0 : 1)
  return n > 0 ? tx.amount / n : tx.amount
}
