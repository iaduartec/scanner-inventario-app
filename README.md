# Duartec Inventario PWA

Aplicación web instalable (PWA) para técnicos de Duartec que necesitan escanear seriales de teléfonos/equipos en campo, registrar su estado y exportar inventario sin depender de backend.

## Resumen

- Mobile-first, pensada para iPhone y Android.
- Escaneo con cámara usando `html5-qrcode` desde CDN estable.
- Guardado local persistente en `localStorage`.
- Funciona offline tras la primera carga gracias a `service worker`.
- Exportación CSV compatible con Excel (BOM UTF-8 + separador `;`).
- Textos y UX orientados a uso rápido por técnicos no desarrolladores.

## Estado de esta iteración

### FASE 3 iniciada
- Se añade panel de detalle del serial seleccionado.
- Cada alta/edición guarda historial de movimientos por equipo.
- Los registros antiguos se migran en memoria para no perder compatibilidad con `localStorage`.


### FASE 1 completada
- Refactor completo desde un repositorio casi vacío hacia una estructura modular estática.
- UI base profesional en dark mode, con acciones grandes y layout mobile-first.
- PWA instalable con `manifest.webmanifest` y `service worker`.
- Documentación ampliada.

### FASE 2 completada
- Escaneo con dos acciones rápidas: `INSTALADO` y `RESERVA`.
- Alta manual y edición manual de registros.
- Detección robusta de duplicados por serial normalizado.
- Búsqueda, filtros por estado, exportación CSV y eliminación de registros.

### Fases pendientes
- **FASE 3:** historial por serial y vista de detalle con movimientos.
- **FASE 4:** capa de sincronización futura con Google Sheets.
- **FASE 5:** pulido avanzado de accesibilidad, validaciones, iconos PWA dedicados y offline más fino.

## Estructura del proyecto

```text
.
├── CHANGELOG.md
├── README.md
├── css/
│   └── styles.css
├── examples/
│   └── export-ejemplo.csv
├── icons/
│   └── icon.svg
├── index.html
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── demo-data.js
│   ├── scanner.js
│   ├── storage.js
│   ├── ui.js
│   └── utils.js
├── manifest.webmanifest
└── sw.js
```

## Cómo ejecutar en local

### Opción 1: servidor Python

```bash
python3 -m http.server 4173
```

Luego abre `http://localhost:4173`.

### Opción 2: VS Code Live Server

Sirve la carpeta raíz del repositorio como sitio estático.

> Nota: para probar cámara y PWA en móvil real conviene usar HTTPS o localhost. En iPhone/Safari el permiso de cámara puede fallar si se abre como archivo local (`file://`).

## Cómo instalar en móvil

### iPhone / Safari
1. Abre la URL en Safari.
2. Toca **Compartir**.
3. Selecciona **Añadir a pantalla de inicio**.
4. Abre la app instalada y concede permisos de cámara cuando se soliciten.

### Android / Chrome
1. Abre la URL en Chrome.
2. Usa el botón **Instalar app** o el menú del navegador.
3. Acepta permisos de cámara.

## Cómo usar

1. Pulsa **Escanear INSTALADO** o **Escanear RESERVA**.
2. Apunta la cámara al código del equipo.
3. Revisa el feedback visual/sonoro.
4. Completa o corrige datos en el formulario si hace falta.
5. Usa búsqueda y filtros para localizar equipos.
6. Exporta CSV cuando termines la jornada.

## Estados de equipo

- `INSTALADO`
- `RESERVA`
- `RETIRADO`
- `AVERIADO`

## Modelo de datos actual

Cada registro contiene:

- `id`
- `serial`
- `modelo`
- `estado`
- `cliente`
- `ubicacion`
- `tecnico`
- `fechaAlta`
- `fechaUltimoMovimiento`
- `observaciones`
- `fuenteCaptura`

## Decisiones técnicas

- **Sin framework**. [Inferencia] El repositorio estaba prácticamente vacío y el objetivo prioriza despliegue simple en GitHub Pages o hosting estático.
- **Módulos ES nativos** para separar almacenamiento, UI, utilidades y escáner.
- **`localStorage`** como persistencia base sin backend.
- **`html5-qrcode` vía CDN** para evitar build step innecesario.
- **CSV con `;` y BOM UTF-8** para mejor compatibilidad con Excel en entornos hispanohablantes.

## Despliegue en GitHub Pages

1. Sube el contenido del repositorio a GitHub.
2. Ve a **Settings > Pages**.
3. Elige desplegar desde la rama principal y la carpeta raíz (`/`).
4. Espera a que GitHub publique el sitio.
5. Accede a la URL publicada desde móvil para instalar la PWA.

> Si GitHub Pages sirve el sitio en subruta, comprueba que `start_url` y recursos relativos sigan cargando correctamente. Esta versión usa rutas relativas (`./`) para facilitarlo.

## Datos demo

Puedes usar el botón **Cargar demo** para poblar el inventario con seriales de ejemplo.

Seriales demo incluidos:
- `001AE8F7918F`
- `001AE8F79C13`
- `001AE8FBDDED`

También se incluye un CSV de muestra en `examples/export-ejemplo.csv`.

## Limitaciones conocidas

- La calidad del escaneo depende de permisos, luz y enfoque del dispositivo.
- iOS/Safari puede requerir reintentar permisos tras instalar la PWA.
- Sin backend, los datos permanecen en el navegador/dispositivo actual.
- La librería de escaneo depende de CDN en la primera carga online. Una vez cacheada, la app propia sí puede abrir offline, pero el CDN puede requerir mejora futura si se desea independencia total.

## Preparación para Google Sheets (siguiente iteración)

Aún no se implementa la sincronización, pero la siguiente fase debería añadir:

- `js/services/sync-service.js` para encapsular sincronización.
- `config/sync.example.json` con mapeo de columnas y endpoint.
- Cola local de cambios pendientes.
- Documentación de credenciales y flujo de publicación.

## Roadmap resumido

### FASE 3
- Historial de movimientos por serial.
- Vista detalle del equipo.
- Registrar cambios de estado sin sobrescribir ciegamente.

### FASE 4
- Capa de servicio para Google Sheets.
- Configuración desacoplada y documentación.

### FASE 5
- Accesibilidad fina.
- Validaciones extra.
- Iconos PWA finales en múltiples tamaños.
- Mejoras de rendimiento y offline.

## Validaciones recomendadas

- Probar cámara en iPhone Safari y Android Chrome.
- Validar exportación en Excel.
- Confirmar persistencia cerrando y reabriendo la app.
- Verificar instalación como PWA en móvil real.
