const connectorsById = new Map(window.CABLEBUILDER_CONNECTORS.map((c) => [c.id, c]));
const cablesById = new Map(window.CABLEBUILDER_CABLES.map((c) => [c.id, c]));

const fields = {
  connectorA: document.getElementById('connectorA'),
  connectorB: document.getElementById('connectorB'),
  cable: document.getElementById('cableType'),
  length: document.getElementById('length'),
  quantity: document.getElementById('quantity'),
};
const unitPriceOutput = document.getElementById('unitPrice');
const totalPriceOutput = document.getElementById('totalPrice');

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

function update() {
  const connectorA = connectorsById.get(Number(fields.connectorA.value));
  const connectorB = connectorsById.get(Number(fields.connectorB.value));
  const cable = cablesById.get(Number(fields.cable.value));
  const length = Number.parseFloat(fields.length.value) || 0;
  const quantity = Number.parseInt(fields.quantity.value, 10) || 1;

  const result = calculateConfigPrice(
    connectorA?.price || 0,
    connectorB?.price || 0,
    cable?.price_per_meter || 0,
    length,
    quantity,
  );

  unitPriceOutput.textContent = formatEUR(result.unitPrice);
  totalPriceOutput.textContent = formatEUR(result.totalPrice);
}

document.getElementById('swapConnectors').addEventListener('click', () => {
  [fields.connectorA.value, fields.connectorB.value] = [fields.connectorB.value, fields.connectorA.value];
  update();
});

Object.values(fields).forEach((field) => field.addEventListener('input', update));
update();
