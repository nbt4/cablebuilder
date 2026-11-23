const connectorsById = new Map(window.CABLEBUILDER_CONNECTORS.map((c) => [c.id, c]));
const cablesById = new Map(window.CABLEBUILDER_CABLES.map((c) => [c.id, c]));

const fields = {
  connectorA: document.getElementById('connectorA'),
  connectorB: document.getElementById('connectorB'),
  cable: document.getElementById('cableType'),
  length: document.getElementById('length'),
  quantity: document.getElementById('quantity'),
};

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

/**
 * Wie weit das gezeichnete Kabel in der Vorschau durchhängt (in SVG-Einheiten, 0–80).
 * Längere Kabel hängen stärker durch. Die Wurzel sorgt dafür, dass sich kurze Längen
 * (0,5 m vs. 2 m) deutlich unterscheiden, lange Längen (25 m vs. 50 m) aber nicht aus dem Bild laufen.
 */
function cableSag(lengthM) {
  const maxSag = 80;
  const referenceLength = 50; // ab hier maximaler Durchhang
  const ratio = Math.min(Math.max(lengthM, 0) / referenceLength, 1);
  return 6 + Math.sqrt(ratio) * (maxSag - 6);
}

const wire = document.getElementById('cableWire');
const labels = {
  connectorA: document.getElementById('labelConnectorA'),
  connectorB: document.getElementById('labelConnectorB'),
  cable: document.getElementById('labelCable'),
  length: document.getElementById('labelLength'),
  quantity: document.getElementById('labelQuantity'),
  unitPrice: document.getElementById('unitPrice'),
  totalPrice: document.getElementById('totalPrice'),
};

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

  labels.unitPrice.textContent = formatEUR(result.unitPrice);
  labels.totalPrice.textContent = formatEUR(result.totalPrice);
  labels.connectorA.textContent = connectorA?.name || '–';
  labels.connectorB.textContent = connectorB?.name || '–';
  labels.cable.textContent = cable?.name || '–';
  labels.length.textContent = `${length.toLocaleString('de-DE')} m`;
  labels.quantity.textContent = quantity > 1 ? `für ${quantity} Stück` : '';

  const y = 95 + cableSag(length);
  wire.setAttribute('d', `M118 95 C 230 ${y}, 370 ${y}, 482 95`);
}

Object.values(fields).forEach((field) => field.addEventListener('input', update));
update();
