import { ESTADOS } from './constants.js';
import { formatDateTime } from './utils.js';

export function renderFilterChips(container, activeFilter, onChange) {
  container.innerHTML = ESTADOS.map(
    (estado) => `
      <button
        type="button"
        class="filter-chip ${activeFilter === estado ? 'active' : ''}"
        data-filter="${estado}"
        role="tab"
        aria-selected="${activeFilter === estado}"
      >
        ${estado}
      </button>
    `,
  ).join('');

  container.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => onChange(button.dataset.filter));
  });
}

export function renderRecords({ records, tableBody, onEdit, onDelete, onSelect, selectedId }) {
  if (!records.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No hay registros para este filtro. Escanea un equipo o crea uno manualmente.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = records
    .map(
      (record) => `
        <tr class="${selectedId === record.id ? 'is-selected' : ''}">
          <td class="serial-cell">
            <strong>${record.serial}</strong>
            <span class="serial-meta">${record.fuenteCaptura} · ${record.observaciones || 'Sin observaciones'}</span>
          </td>
          <td><span class="status-pill status-${record.estado}">${record.estado}</span></td>
          <td>${record.modelo || '—'}</td>
          <td>${record.cliente || '—'}</td>
          <td>${record.ubicacion || '—'}</td>
          <td>${record.tecnico || '—'}</td>
          <td>
            <strong>${formatDateTime(record.fechaUltimoMovimiento)}</strong>
            <span class="serial-meta">Alta: ${formatDateTime(record.fechaAlta)}</span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="ghost-button" data-detail="${record.id}">Detalle</button>
              <button type="button" class="ghost-button" data-edit="${record.id}">Editar</button>
              <button type="button" class="ghost-button danger-text" data-delete="${record.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');

  tableBody.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => onEdit(button.dataset.edit));
  });

  tableBody.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => onDelete(button.dataset.delete));
  });

  tableBody.querySelectorAll('[data-detail]').forEach((button) => {
    button.addEventListener('click', () => onSelect(button.dataset.detail));
  });
}

export function renderRecordDetail({ container, record, onEdit }) {
  if (!record) {
    container.innerHTML = `
      <div class="detail-empty">
        <p class="eyebrow">Detalle</p>
        <h3>Selecciona un equipo</h3>
        <p class="subtle">Usa el botón “Detalle” de cualquier fila para revisar el historial del serial.</p>
      </div>
    `;
    return;
  }

  const history = [...(record.historial ?? [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  container.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Detalle de equipo</p>
        <h3>${record.serial}</h3>
        <p class="subtle">${record.modelo || 'Sin modelo'} · ${record.cliente || 'Sin cliente'} · ${record.ubicacion || 'Sin ubicación'}</p>
      </div>
      <button type="button" class="ghost-button" data-detail-edit="${record.id}">Editar este registro</button>
    </div>

    <dl class="detail-grid" aria-label="Resumen del equipo seleccionado">
      <div>
        <dt>Estado actual</dt>
        <dd><span class="status-pill status-${record.estado}">${record.estado}</span></dd>
      </div>
      <div>
        <dt>Técnico</dt>
        <dd>${record.tecnico || '—'}</dd>
      </div>
      <div>
        <dt>Alta</dt>
        <dd>${formatDateTime(record.fechaAlta)}</dd>
      </div>
      <div>
        <dt>Último movimiento</dt>
        <dd>${formatDateTime(record.fechaUltimoMovimiento)}</dd>
      </div>
    </dl>

    <div class="detail-history">
      <div class="section-header compact-header">
        <div>
          <p class="eyebrow">Historial</p>
          <h4>${history.length} movimiento(s)</h4>
        </div>
      </div>
      <ol class="history-list">
        ${history
          .map(
            (movement) => `
              <li class="history-item">
                <div class="history-item-header">
                  <strong>${movement.tipo === 'alta' ? 'Alta inicial' : 'Actualización manual'}</strong>
                  <span>${formatDateTime(movement.fecha)}</span>
                </div>
                <p>
                  <span class="status-pill status-${movement.estado}">${movement.estado}</span>
                  <span class="history-meta">${movement.fuenteCaptura} · ${movement.tecnico || 'Sin técnico'} · ${movement.ubicacion || 'Sin ubicación'}</span>
                </p>
                <p class="subtle">${movement.observaciones || 'Sin observaciones registradas.'}</p>
              </li>
            `,
          )
          .join('')}
      </ol>
    </div>
  `;

  container.querySelector('[data-detail-edit]')?.addEventListener('click', () => onEdit(record.id));
}

export function setFeedback(element, message, variant = 'info') {
  if (!message) {
    element.textContent = '';
    element.className = 'feedback-banner hidden';
    return;
  }

  element.textContent = message;
  element.className = `feedback-banner ${variant}`;
}

export function toggleDuplicateAlert(element, visible) {
  element.classList.toggle('hidden', !visible);
}

export function updateLastCapture({ serialElement, metaElement, record }) {
  serialElement.textContent = record?.serial ?? 'Sin lecturas todavía';
  metaElement.textContent = record
    ? `${record.estado} · ${record.modelo || 'Sin modelo'} · ${formatDateTime(record.fechaUltimoMovimiento)}`
    : 'Esperando el primer escaneo o alta manual.';
}

export function updateCounters({ records, recordCount, installedCount, reserveCount }) {
  recordCount.textContent = `${records.length} registros`;
  installedCount.textContent = `${records.filter((item) => item.estado === 'INSTALADO').length} instalados`;
  reserveCount.textContent = `${records.filter((item) => item.estado === 'RESERVA').length} reserva`;
}
