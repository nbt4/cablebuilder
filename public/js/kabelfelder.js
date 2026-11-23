const categorySelect = document.querySelector('[data-cable-category]');
const customFieldsContainer = document.querySelector('[data-custom-fields]');

if (categorySelect && customFieldsContainer) {
  const categories = window.CABLEBUILDER_CATEGORIES || [];
  const editCable = window.CABLEBUILDER_EDIT_CABLE;
  const initialValues = new Map(
    (editCable?.custom_fields || []).map((field) => [field.field_id, field.value]),
  );

  function renderCustomFields() {
    const categoryId = Number(categorySelect.value);
    const category = categories.find((item) => item.id === categoryId);
    customFieldsContainer.replaceChildren();

    if (!category || category.fields.length === 0) return;

    const heading = document.createElement('h3');
    heading.textContent = `Zusatzfelder: ${category.name}`;
    customFieldsContainer.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'custom-fields-grid';

    category.fields.forEach((field) => {
      const label = document.createElement('label');
      label.textContent = field.name;

      const input = document.createElement('input');
      input.type = 'text';
      input.name = `field_${field.id}`;
      input.placeholder = field.name;
      input.value = initialValues.get(field.id) || '';

      label.appendChild(input);
      grid.appendChild(label);
    });

    customFieldsContainer.appendChild(grid);
  }

  categorySelect.addEventListener('change', renderCustomFields);
  renderCustomFields();
}
