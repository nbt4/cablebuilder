function buildAutomaticName(configuration) {
  return `${configuration.cable_name}, ${configuration.length_m} m (${configuration.connector_a_name} auf ${configuration.connector_b_name})`;
}

function looksLikeAutomaticName(configuration) {
  if (configuration.name === buildAutomaticName(configuration)) return true;
  const length = String(configuration.length_m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^.+, ${length} m \\(.+ auf .+\\)$`).test(configuration.name);
}

function refreshAutomaticNames(db) {
  const configurations = db.prepare(`
    SELECT id, cable_name, length_m, connector_a_name, connector_b_name
    FROM cable_configurations
    WHERE name_is_custom = 0
  `).all();
  const updateName = db.prepare('UPDATE cable_configurations SET name = ? WHERE id = ?');
  configurations.forEach((configuration) => {
    updateName.run(buildAutomaticName(configuration), configuration.id);
  });
}

function withCalculatedPrices(configurations) {
  return configurations.map((configuration) => {
    const unitPrice = configuration.connector_a_price
      + configuration.connector_b_price
      + configuration.cable_price_per_meter * configuration.length_m;
    return {
      ...configuration,
      unit_price: unitPrice,
      total_price: unitPrice * configuration.quantity,
    };
  });
}

module.exports = {
  buildAutomaticName,
  looksLikeAutomaticName,
  refreshAutomaticNames,
  withCalculatedPrices,
};
