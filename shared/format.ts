/** Hundredths → "-12.30" */
export function formatAmount(hundredths: number) {
  return (hundredths / 100).toFixed(2);
}
