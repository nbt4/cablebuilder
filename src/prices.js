const VAT_RATE = 0.19;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parsePrice(value) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim().replace(',', '.');
  if (normalized === '') return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveGrossPrice({ net, gross, basis }) {
  const netPrice = parsePrice(net);
  const grossPrice = parsePrice(gross);

  if (basis === 'net' && netPrice !== null) {
    return roundMoney(netPrice * (1 + VAT_RATE));
  }

  if (basis === 'gross' && grossPrice !== null) {
    return roundMoney(grossPrice);
  }

  if (grossPrice !== null) return roundMoney(grossPrice);
  if (netPrice !== null) return roundMoney(netPrice * (1 + VAT_RATE));

  return null;
}

function grossToNet(gross) {
  return roundMoney(gross / (1 + VAT_RATE));
}

module.exports = { VAT_RATE, grossToNet, resolveGrossPrice };
