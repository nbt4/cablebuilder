document.querySelectorAll('[data-price-form]').forEach((form) => {
  const netInput = form.querySelector('[data-net-price]');
  const grossInput = form.querySelector('[data-gross-price]');
  const basisInput = form.querySelector('[data-price-basis]');
  const factor = 1 + Number.parseFloat(form.dataset.vatRate);

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return roundMoney(value).toFixed(2);
  }

  function syncPrice(source, target, operation, basis) {
    basisInput.value = basis;
    netInput.setCustomValidity('');
    grossInput.setCustomValidity('');

    if (source.value === '') {
      target.value = '';
      return;
    }

    const value = Number.parseFloat(source.value);
    if (Number.isFinite(value) && value >= 0) {
      target.value = formatMoney(operation(value));
    }
  }

  netInput.addEventListener('input', () => {
    syncPrice(netInput, grossInput, (value) => value * factor, 'net');
  });

  grossInput.addEventListener('input', () => {
    syncPrice(grossInput, netInput, (value) => value / factor, 'gross');
  });

  form.addEventListener('submit', (event) => {
    if (netInput.value === '' && grossInput.value === '') {
      event.preventDefault();
      netInput.setCustomValidity('Bitte einen Netto- oder Bruttopreis eingeben.');
      netInput.reportValidity();
    }
  });
});
