# Duartec Inventario PWA

Aplicación web instalable (PWA) para técnicos de Duartec que necesitan escanear seriales de teléfonos/equipos en campo, registrar su estado y exportar inventario sin depender de backend.

También incluye wrapper nativo con Capacitor para Android e iOS, pensado para generar APK/AAB e IPA desde el mismo código base web.

## Resumen

- Mobile-first, pensada para iPhone y Android.
- Escaneo con cámara usando `html5-qrcode` para QR y códigos de barras, más OCR para leer `S/N`, `MAC` y `modelo` impresos.
- Guardado local persistente en `localStorage`.
- Funciona offline tras la primera carga gracias a `service worker`.
- Exportación CSV compatible con Excel (BOM UTF-8 + separador `;`).
- Textos y UX orientados a uso rápido por técnicos no desarrolladores.

## Estado de esta iteración

### FASE 3 iniciada
- Se añade panel de detalle del serial seleccionado.
- Cada alta/edición guarda historial de movimientos por equipo.
- Los registros antiguos se migran en memoria para no perder compatibilidad con `localStorage`.
- Se añade lectura OCR para `S/N`, `MAC` y `modelo` cuando el barcode de la caja devuelve `Ref` en vez del serial útil.


### FASE 1 completada
- Refactor completo desde un repositorio casi vacío hacia una estructura modular estática.
- UI base profesional en dark mode, con acciones grandes y layout mobile-first.
- PWA instalable con `manifest.webmanifest` y `service worker`.
- Documentación ampliada.

### FASE 2 completada
- Escaneo con dos acciones rápidas: `INSTALADO` y `DESINSTALADO`.
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
├── vendor/
│   ├── html5-qrcode/
│   └── tesseract/
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
4. Si el dispositivo ofrece varios navegadores, Chrome o Samsung Internet suelen dar mejor soporte de instalación PWA.

## Versión nativa

El repositorio incluye proyectos Capacitor en `android/` e `ios/`.

### Comandos útiles

```bash
npm run build:web
npx cap sync android
npx cap sync ios
```

### Abrir proyectos

```bash
npx cap open android
npx cap open ios
```

### Publicación

- Android: genera un `AAB` desde Android Studio para Play Store.
- iOS: genera un `IPA` desde Xcode en macOS para App Store.
- Necesitas cuentas de publicación de Google Play y Apple Developer, además de firma y assets de tienda.
- También puedes usar `fastlane` con los lanes `android deploy` e `ios deploy` una vez configures credenciales.

### Firma Android

1. Copia `android/keystore.properties.example` a `android/keystore.properties`.
2. Rellena `storeFile`, `storePassword`, `keyAlias` y `keyPassword`.
3. Mantén el `.jks` fuera del repositorio.
4. Ejecuta `npx cap sync android` y luego compila el `AAB` firmado desde Android Studio.

### Fastlane

```bash
bundle install
bundle exec fastlane android build_release
bundle exec fastlane ios build_release
```

Para publicar:

```bash
bundle exec fastlane android deploy
bundle exec fastlane ios deploy
```

### GitHub Actions

El workflow `.github/workflows/publish.yml` puede compilar o publicar por Fastlane en `ubuntu-latest` para Android y `macos-latest` para iOS.

Secrets esperados:

- `PLAY_JSON_KEY_PATH`: ruta absoluta o relativa al JSON de service account de Google Play.
- `PLAY_JSON_KEY_DATA`: contenido completo del JSON de service account, si prefieres guardarlo inline.
- `FASTLANE_APPLE_ID`: email de tu Apple ID.
- `FASTLANE_TEAM_ID`: Team ID de Apple Developer.
- `APPLE_ID`: identificador de la app en App Store Connect.
- `ITC_PROVIDER`: proveedor de App Store Connect si tu cuenta lo requiere.
- `APP_STORE_CONNECT_API_KEY_JSON`: JSON con `key_id`, `issuer_id`, `key_content` y opcionalmente `is_key_content_base64`.

Ejemplo de `APP_STORE_CONNECT_API_KEY_JSON`:

```json
{
  "key_id": "ABC123DEFG",
  "issuer_id": "00000000-0000-0000-0000-000000000000",
  "key_content": "BASE64_O_PLAINTEXT_DE_TU_CLAVE_P8",
  "is_key_content_base64": true
}
```

## Cómo usar

1. Pulsa **Escanear equipo instalado** o **Escanear equipo desinstalado**.
2. Elige el modo de lectura:
   - `QR`
   - `Código de barras`
   - `S/N` para leer el serial, el `MAC` y el `modelo` impresos cuando la etiqueta también trae un `Ref`
3. Apunta la cámara al código o a la línea `S/N`.
4. Revisa el feedback visual/sonoro.
5. Completa o corrige datos en el formulario si hace falta.
6. Usa búsqueda y filtros para localizar equipos.
7. Exporta CSV cuando termines la jornada.

## Estados de equipo

- `INSTALADO`
- `DESINSTALADO`
- `RETIRADO`
- `AVERIADO`

## Modelo de datos actual

Cada registro contiene:

- `id`
- `serial`
- `mac`
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
- **`html5-qrcode` y `tesseract.js` vendorizados localmente** para evitar dependencias de red en el arranque del scanner.
- **CSV con `;` y BOM UTF-8** para mejor compatibilidad con Excel en entornos hispanohablantes.

## Despliegue en GitHub Pages

1. Sube el contenido del repositorio a GitHub.
2. Ve a **Settings > Pages**.
3. Elige desplegar desde la rama principal y la carpeta raíz (`/`).
4. Espera a que GitHub publique el sitio.
5. Accede a la URL publicada desde móvil para instalar la PWA.

> Si GitHub Pages sirve el sitio en subruta, comprueba que `start_url` y recursos relativos sigan cargando correctamente. Esta versión usa rutas relativas (`./`) para facilitarlo.

## Página de descarga

La ruta [`/download/`](./download/) muestra una landing directa para bajar el APK firmado desde la release de GitHub, con SHA-256 e instrucciones de instalación para Android.

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
- Android puede necesitar que el navegador tenga permisos de cámara activos para la pestaña o la app instalada.
- Sin backend, los datos permanecen en el navegador/dispositivo actual.
- El escáner arranca con librerías locales vendorizadas, así que no depende de CDN para abrir offline.
- El modo `S/N` depende de OCR y necesita mejor luz y encuadre que un barcode convencional.
- El wrapper nativo usa las mismas rutas locales que la PWA, así que no hereda dependencias de CDN en iOS/Android.
# Duartec Inventario PWA (v1.0)

Herramienta profesional de alta precisión para técnicos de campo. Permite el escaneo masivo de equipos IT/Telco, normalización automática de datos y gestión de inventario persistente 100% local.

## Características Principales

- **Scanner-First UI**: Interfaz minimalista diseñada para la velocidad en campo.
- **Motor OCR Adaptativo**: Reconocimiento dinámico de Seriales (hasta 20 caracteres), MACs y Modelos, optimizado para etiquetas densas (Huawei, Cisco, Nokia, ZTE).
- **Rendimiento Inteligente**: Ajuste automático de FPS y ciclos de escaneo según la potencia del dispositivo y las condiciones de luz.
- **Detección de Quietud**: Captura profunda automática cuando el técnico mantiene el pulso estable.
- **Privacidad Total**: Procesamiento y almacenamiento 100% local (IndexedDB). Los datos nunca salen del dispositivo.
- **Offline Nativo**: Funciona sin conexión tras la primera carga.
- **Exportación Profesional**: Generación de reportes CSV optimizados para auditoría y Excel (BOM UTF-8).

## Cómo instalar en móvil

### iOS (Safari)
1. Abre la URL en Safari.
2. Toca **Compartir** y selecciona **Añadir a pantalla de inicio**.
3. Abre la app instalada y concede permisos de cámara.

### Android (Chrome)
1. Abre la URL en Chrome.
2. Usa el banner **Instalar** o el menú del navegador.
3. Se recomienda Chrome o Samsung Internet para la mejor experiencia PWA.

## Flujo de Trabajo

1. **Configuración**: Selecciona el "Estado por defecto" (ej. INSTALADO) en la consola superior.
2. **Escaneo**: Pulsa **INICIAR ESCANEO**. El sistema activará el OCR inteligente.
3. **Capture**: Apunta a la etiqueta. Si el pulso es firme, el sistema capturará los datos automáticamente.
4. **Validación**: Revisa los contadores en tiempo real en la sección de inventario.
5. **Cierre**: Pulsa **EXPORTAR CSV** al final de la jornada para generar el reporte técnico.

## Soporte OCR Avanzado

El motor está pre-entrenado para omitir ruidos visuales comunes y priorizar identificadores útiles:
- Soporta seriales de 14 a 20 caracteres.
- Autocorrección de caracteres ambiguos (S/5, 0/O, B/8).
- Validación de formato MAC estándar.
- Detección de modelos integrados en la cadena de texto.

---
© 2026 Duartec Instalaciones Informáticas. Todos los derechos reservados.
