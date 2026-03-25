import { ESTADOS } from './constants.js';
import { formatDateTime } from './utils.js';

export function renderFilterChips(contenedor, filtroActivo, alCambiar) {
  contenedor.innerHTML = ESTADOS.map(
    (estado) => `
      <button
        type="button"
        class="filter-chip ${filtroActivo === estado ? 'active' : ''}"
        data-filter="${estado}"
        role="tab"
        aria-selected="${filtroActivo === estado}"
      >
        ${estado}
      </button>
    `,
  ).join('');

  contenedor.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => alCambiar(button.dataset.filter));
  });
}

export function renderRecords({ records: registros, tableBody: cuerpoTabla, onEdit: alEditar, onDelete: alEliminar, onSelect: alSeleccionar, selectedId: idSeleccionado }) {
  if (!registros.length) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No hay registros para este filtro. Escanea un equipo o crea uno manualmente.
        </td>
      </tr>
    `;
    return;
  }

  cuerpoTabla.innerHTML = registros
    .map(
      (registro) => `
        <tr class="${idSeleccionado === registro.id ? 'is-selected' : ''}">
          <td class="serial-cell">
            <strong>${registro.serial}</strong>
            <span class="serial-meta">${registro.fuenteCaptura} · ${registro.observaciones || 'Sin obj.'}</span>
          </td>
          <td><strong>${registro.mac || '—'}</strong></td>
          <td><span class="status-pill status-${registro.estado}">${registro.estado}</span></td>
          <td>${registro.marca || '—'}</td>
          <td>${registro.modelo || '—'}</td>
          <td>${registro.actuacion || '—'}</td>
          <td>${registro.cliente || '—'}</td>
          <td>${registro.ubicacion || '—'}</td>
          <td>${registro.tecnico || '—'}</td>
          <td>
            <strong>${formatDateTime(registro.fechaUltimoMovimiento)}</strong>
            <span class="serial-meta">Alta: ${formatDateTime(registro.fechaAlta)}</span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="ghost-button" data-detail="${registro.id}">Detalle</button>
              <button type="button" class="ghost-button" data-edit="${registro.id}">Editar</button>
              <button type="button" class="ghost-button danger-text" data-delete="${registro.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('');

  cuerpoTabla.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => alEditar(button.dataset.edit));
  });

  cuerpoTabla.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => alEliminar(button.dataset.delete));
  });

  cuerpoTabla.querySelectorAll('[data-detail]').forEach((button) => {
    button.addEventListener('click', () => alSeleccionar(button.dataset.detail));
  });
}

export function renderRecordDetail({ container: contenedor, record: registro, onEdit: alEditar }) {
  if (!registro) {
    contenedor.innerHTML = `
      <div class="detail-empty">
        <p class="eyebrow">Detalle</p>
        <h3>Selecciona un equipo</h3>
        <p class="subtle">Usa el botón “Detalle” de cualquier fila para revisar el historial del serial.</p>
      </div>
    `;
    return;
  }

  const history = [...(registro.historial ?? [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  contenedor.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Detalle de equipo</p>
        <h3>${registro.serial}</h3>
        <p class="subtle">${registro.mac ? `MAC ${registro.mac} · ` : ''}${registro.marca || 'Sin marca'} · ${registro.modelo || 'Sin modelo'} · ${registro.cliente || 'Sin cliente'} · ${registro.ubicacion || 'Sin ubicación'}</p>
      </div>
      <button type="button" class="ghost-button" data-detail-edit="${registro.id}">Editar este registro</button>
    </div>

    <div class="detail-grid" aria-label="Resumen del equipo seleccionado">
      <div>
        <dt>Estado actual</dt>
        <dd><span class="status-pill status-${registro.estado}">${registro.estado}</span></dd>
      </div>
      <div>
        <dt>Técnico</dt>
        <dd>${registro.tecnico || '—'}</dd>
      </div>
      <div>
        <dt>MAC</dt>
        <dd>${registro.mac || '—'}</dd>
      </div>
      <div>
        <dt>Actuación</dt>
        <dd>${registro.actuacion || '—'}</dd>
      </div>
      <div>
        <dt>Marca</dt>
        <dd>${registro.marca || '—'}</dd>
      </div>
      <div>
        <dt>Alta</dt>
        <dd>${formatDateTime(registro.fechaAlta)}</dd>
      </div>
      <div>
        <dt>Último movimiento</dt>
        <dd>${formatDateTime(registro.fechaUltimoMovimiento)}</dd>
      </div>
    </div>
  `;

  contenedor.querySelector('[data-detail-edit]')?.addEventListener('click', () => alEditar(registro.id));
}

export function setFeedback(elemento, mensaje, variant = 'info') {
  if (!mensaje) {
    elemento.textContent = '';
    elemento.className = 'feedback-banner hidden';
    return;
  }

  elemento.textContent = mensaje;
  elemento.className = `feedback-banner ${variant}`;
}

export function toggleDuplicateAlert(elemento, visible) {
  elemento.classList.toggle('hidden', !visible);
}

export function updateLastCapture({ serialElement: serialElemento, metaElement: metaElemento, record: registro }) {
  if (serialElemento) {
    serialElemento.textContent = registro?.serial ?? 'Sin lecturas todavía';
  }
  if (metaElemento) {
    metaElemento.textContent = registro
      ? `${registro.estado}${registro.mac ? ` · MAC ${registro.mac}` : ''}${registro.marca ? ` · ${registro.marca}` : ''} · ${registro.modelo || 'Sin modelo'} · ${formatDateTime(registro.fechaUltimoMovimiento)}`
      : 'Esperando el primer escaneo o alta manual.';
  }
}

export function updateCounters({
  records: registros,
  recordCount: contadorRegistros,
  equipoInstaladoCount: contadorEquiposInstalados,
  equipoDesinstaladoCount: contadorEquiposDesinstalados,
}) {
  contadorRegistros.textContent = `${registros.length} registros`;
  contadorEquiposInstalados.textContent = `${registros.filter((item) => item.estado === 'INSTALADO').length} instalados`;
  contadorEquiposDesinstalados.textContent = `${registros.filter((item) => item.estado === 'DESINSTALADO').length} desinstalados`;
}
