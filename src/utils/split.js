// Amount each other person owes on a split / proxy-purchase transaction.
// - หารบิล (includeMe !== false): divide by people + me  → amount / (N + 1)
// - ฝากซื้อ (includeMe === false): collect full from others, we take no share → amount / N
// Which kind of "collect from others" a record is. Records created before
// ให้ยืมเงิน existed only carry includeMe.
export function billModeOf(tx) {
  return tx.billMode || (tx.includeMe === false ? 'proxy' : 'split')
}

export const BILL_LABEL = { split: 'หาร', proxy: 'ฝากซื้อ', lend: 'ให้ยืมเงิน' }

export function perHead(tx) {
  const n = (tx.splitWith?.length || 0) + (tx.includeMe === false ? 0 : 1)
  return n > 0 ? tx.amount / n : tx.amount
}
