<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=240&text=Duartec%20Inventario%20PWA&fontAlign=50&fontAlignY=38&color=0:0f172a,50:1e3a8a,100:2563eb&fontColor=ffffff&desc=PWA%20de%20inventario%20%7C%20Capacitor%20%7C%20OCR%20%7C%20CSV%20offline&descAlign=50&descAlignY=60" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PWA-Instalable-0A66C2?style=for-the-badge&logo=pwa&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-Android%20%2F%20iOS-3B82F6?style=for-the-badge&logo=capacitor&logoColor=white" />
  <img src="https://img.shields.io/badge/OCR-Tesseract%20%2B%20html5--qrcode-111827?style=for-the-badge&logo=googlelens&logoColor=white" />
  <img src="https://img.shields.io/badge/Offline-LocalStorage%20%2B%20SW-16A34A?style=for-the-badge&logo=cloudflarepages&logoColor=white" />
</p>

---

## Qué es

**Duartec Inventario PWA** es una aplicación web instalable para técnicos de campo que necesitan escanear equipos, registrar estado y exportar inventario sin depender de backend.

Está pensada para trabajar rápido en móvil:

- escaneo de seriales y códigos con cámara
- OCR para `S/N`, `MAC` y `modelo`
- guardado local persistente
- exportación CSV compatible con Excel
- wrapper nativo con Capacitor para Android e iOS

---

## Qué hace

### Captura

- Escanea QR y códigos de barras con `html5-qrcode`.
- Lee seriales impresos cuando el código no ayuda.
- Normaliza serial, MAC y texto para reducir errores de campo.

### Inventario

- Crea y edita registros de forma manual.
- Guarda historial de movimientos por equipo.
- Detecta duplicados por serial normalizado.
- Filtra por estado y busca registros rápido.

### Exportación

- Genera CSV con BOM UTF-8.
- Usa `;` como separador para Excel.
- Mantiene un formato estable para auditoría y compartición.

### Offline

- Persiste datos en `localStorage`.
- Funciona sin backend.
- Usa `service worker` para cache y arranque offline tras la primera carga.

---

## Stack

<p>
  <img src="https://img.shields.io/badge/JavaScript-20232A?style=flat-square&logo=javascript&logoColor=F7DF1E" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-3B82F6?style=flat-square&logo=capacitor&logoColor=white" />
  <img src="https://img.shields.io/badge/Tesseract.js-111827?style=flat-square" />
  <img src="https://img.shields.io/badge/html5--qrcode-111827?style=flat-square" />
</p>

- **Frontend:** HTML, CSS y JavaScript nativo
- **Escaneo:** `html5-qrcode` + OCR con `tesseract.js`
- **Persistencia:** `localStorage`
- **Empaquetado nativo:** Capacitor
- **Salida:** CSV compatible con Excel

---

## Primeros pasos

### Requisitos

- Node.js
- npm

### Instalar y ejecutar

```bash
npm install
npm run build:web
python3 -m http.server 4173
```

Luego abre `http://localhost:4173`.

### Comandos útiles

```bash
npm run check
npm test
npm run build:web
```

---

## Uso móvil

### iPhone / Safari

1. Abre la URL en Safari.
2. Pulsa **Compartir**.
3. Elige **Añadir a pantalla de inicio**.
4. Concede acceso a cámara cuando se solicite.

### Android / Chrome

1. Abre la URL en Chrome.
2. Instala la app desde el menú o el banner del navegador.
3. Acepta permisos de cámara.

---

## Versión nativa

El proyecto incluye wrapper Capacitor para Android e iOS.

```bash
npm run build:web
npx cap sync android
npx cap sync ios
```

```bash
npx cap open android
npx cap open ios
```

Para publicación móvil:

- Android: `bundle exec fastlane android build_release`
- iOS: `bundle exec fastlane ios build_release`

---

## Formato CSV

La exportación usa este orden de columnas:

```text
id;serial;modelo;estado;cliente;ubicacion;tecnico;fechaAlta;fechaUltimoMovimiento;observaciones;fuenteCaptura
```

Ejemplo de salida:

```csv
﻿id;serial;modelo;estado;cliente;ubicacion;tecnico;fechaAlta;fechaUltimoMovimiento;observaciones;fuenteCaptura
"demo-1";"001AE8F7918F";"iPhone 13 128GB";"INSTALADO";"Hotel Costa Norte";"Lobby - Rack principal";"Luis Duarte";"2026-03-20T09:10:00.000Z";"2026-03-20T09:10:00.000Z";"Equipo operativo y entregado a recepción.";"camara"
```

Existe una muestra en [`examples/export-ejemplo.csv`](./examples/export-ejemplo.csv).

---

## Estructura

```text
.
├── css/
├── examples/
├── icons/
├── js/
├── vendor/
├── index.html
├── manifest.webmanifest
└── sw.js
```

---

## Automatización

El repositorio incluye workflows para:

- dependencia y seguridad
- Snyk
- revisión automática de PRs con IA
- publicación nativa con Fastlane

---

## Roadmap

- mejorar accesibilidad y validaciones
- pulir iconos y detalle offline
- sincronización futura con Google Sheets

---

## Nota

La exportación, el almacenamiento y el escaneo están optimizados para uso en campo. La experiencia depende de permisos, luz y enfoque del dispositivo.
