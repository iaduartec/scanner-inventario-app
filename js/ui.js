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
          <td>
            <strong>${formatDateTime(registro.fechaUltimoMovimiento)}</strong>
            <span class="serial-meta">Alta: ${formatDateTime(registro.fechaAlta)}</span>
          </td>
          <td>
            <div class="table-actions">
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
}

export function renderRecordDetail() {
  // Eliminado por solicitud de simplificación extrema
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
