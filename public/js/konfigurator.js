function getConnectorPrice(id) {
  const c = window.CABLEBUILDER_CONNECTORS.find((c) => c.id === Number(id));
  return c ? c.price : 0;
}

function getCablePricePerMeter(id) {
  const c = window.CABLEBUILDER_CABLES.find((c) => c.id === Number(id));
  return c ? c.price_per_meter : 0;
}

/**
 * TODO (dein Beitrag): Preis einer einzelnen Kabel-Konfiguration und den
 * Gesamtpreis für die gewünschte Menge berechnen.
 *
 * connectorAPrice, connectorBPrice – Preis der beiden Stecker in €
 * pricePerMeter                    – Preis des Kabeltyps in €/m
 * lengthM                          – gewählte Länge in Metern (kann Kommastellen haben)
 * quantity                         – gewünschte Stückzahl (ganzzahlig, >= 1)
 *
 * Rückgabe: { unitPrice: number, totalPrice: number }
 */
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateConfigPrice(connectorAPrice, connectorBPrice, pricePerMeter, lengthM, quantity) {
  const unitPrice = round2(connectorAPrice + connectorBPrice + lengthM * pricePerMeter);
  const totalPrice = round2(unitPrice * quantity);
  return { unitPrice, totalPrice };
}

function formatEUR(value) {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function updatePrice() {
  const aPrice = getConnectorPrice(document.getElementById('connectorA').value);
  const bPrice = getConnectorPrice(document.getElementById('connectorB').value);
  const pricePerMeter = getCablePricePerMeter(document.getElementById('cableType').value);
  const length = parseFloat(document.getElementById('length').value) || 0;
  const quantity = parseInt(document.getElementById('quantity').value, 10) || 1;

  const result = calculateConfigPrice(aPrice, bPrice, pricePerMeter, length, quantity);

  document.getElementById('unitPrice').textContent = result ? formatEUR(result.unitPrice) : '–';
  document.getElementById('totalPrice').textContent = result ? formatEUR(result.totalPrice) : '–';
}

['connectorA', 'connectorB', 'cableType', 'length', 'quantity'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updatePrice);
});

updatePrice();
