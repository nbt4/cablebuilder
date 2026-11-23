function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    current.totalPrice = roundMoney(current.totalPrice + amount * item.unitPrice);
    return;
  }

  items.set(item.key, {
    ...item,
    amount,
    totalPrice: roundMoney(amount * item.unitPrice),
  });
}

function aggregateConfigurations(configurations) {
  const cables = new Map();
  const connectors = new Map();

  configurations.forEach((configuration) => {
    const cableLength = configuration.length_m * configuration.quantity;
    addItem(cables, {
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
    }, cableLength);

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

  const cableItems = [...cables.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const connectorItems = [...connectors.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return {
    cables: cableItems,
    connectors: connectorItems,
    totalPrice: roundMoney(
      [...cableItems, ...connectorItems].reduce((sum, item) => sum + item.totalPrice, 0),
    ),
  };
}

module.exports = { aggregateConfigurations };
