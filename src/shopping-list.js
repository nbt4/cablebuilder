function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Bestellmenge für Kabel: exakter Bedarf plus Reserve, aufgerundet auf 10 cm.
 * Erst auf 6 Nachkommastellen glätten, sonst wird aus 98 m × 1,1 = 107,80000000000001
 * durch das Aufrunden fälschlich 107,9 m.
 */
function withReserve(exactMeters, reservePercent) {
  if (!reservePercent) return exactMeters;
  const raw = Math.round(exactMeters * (1 + reservePercent / 100) * 1e6) / 1e6;
  return Math.ceil(raw * 10) / 10;
}

function normalizeReserve(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, 100);
}

function productKey(type, id, name, website, price) {
  return id
    ? `${type}:id:${id}`
    : `${type}:snapshot:${name}:${website || ''}:${price}`;
}

function addItem(items, item, amount) {
  const current = items.get(item.key);
  if (current) {
    current.amount += amount;
    return current;
  }

  const created = { ...item, amount };
  items.set(item.key, created);
  return created;
}

function addCut(cable, lengthM, quantity) {
  cable.cutMap.set(lengthM, (cable.cutMap.get(lengthM) || 0) + quantity);
}

function aggregateConfigurations(configurations, { reservePercent = 0 } = {}) {
  const reserve = normalizeReserve(reservePercent);
  const cables = new Map();
  const connectors = new Map();

  configurations.forEach((configuration) => {
    const cable = addItem(cables, {
      key: productKey(
        'cable',
        configuration.cable_id,
        configuration.cable_name,
        configuration.cable_website,
        configuration.cable_price_per_meter,
      ),
      name: configuration.cable_name,
      website: configuration.cable_website,
      unitPrice: configuration.cable_price_per_meter,
      cutMap: new Map(),
    }, configuration.length_m * configuration.quantity);
    addCut(cable, configuration.length_m, configuration.quantity);

    [
      {
        id: configuration.connector_a_id,
        name: configuration.connector_a_name,
        website: configuration.connector_a_website,
        price: configuration.connector_a_price,
      },
      {
        id: configuration.connector_b_id,
        name: configuration.connector_b_name,
        website: configuration.connector_b_website,
        price: configuration.connector_b_price,
      },
    ].forEach((connector) => {
      addItem(connectors, {
        key: productKey('connector', connector.id, connector.name, connector.website, connector.price),
        name: connector.name,
        website: connector.website,
        unitPrice: connector.price,
      }, configuration.quantity);
    });
  });

  const byName = (a, b) => a.name.localeCompare(b.name, 'de');

  const cableItems = [...cables.values()].map(({ cutMap, ...cable }) => {
    const exactAmount = Math.round(cable.amount * 1e6) / 1e6;
    const amount = withReserve(exactAmount, reserve);
    const cuts = [...cutMap.entries()]
      .map(([lengthM, count]) => ({ lengthM, count }))
      .sort((a, b) => b.lengthM - a.lengthM);
    return {
      ...cable,
      exactAmount,
      amount,
      cuts,
      cutCount: cuts.reduce((sum, cut) => sum + cut.count, 0),
      totalPrice: roundMoney(amount * cable.unitPrice),
    };
  }).sort(byName);

  const connectorItems = [...connectors.values()].map((connector) => ({
    ...connector,
    totalPrice: roundMoney(connector.amount * connector.unitPrice),
  })).sort(byName);

  return {
    cables: cableItems,
    connectors: connectorItems,
    reservePercent: reserve,
    totalMeters: cableItems.reduce((sum, item) => sum + item.amount, 0),
    totalExactMeters: cableItems.reduce((sum, item) => sum + item.exactAmount, 0),
    totalConnectors: connectorItems.reduce((sum, item) => sum + item.amount, 0),
    totalPrice: roundMoney(
      [...cableItems, ...connectorItems].reduce((sum, item) => sum + item.totalPrice, 0),
    ),
  };
}

module.exports = { aggregateConfigurations, normalizeReserve, withReserve };
