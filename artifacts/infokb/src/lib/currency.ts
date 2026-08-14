const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatUSD(value: number) {
  return usdFormatter.format(value);
}

export function formatUSDPrice(value: number) {
  return value === 0 ? "Free" : formatUSD(value);
}
