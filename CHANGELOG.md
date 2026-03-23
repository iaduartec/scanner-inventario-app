# Changelog

## Publicación preparada - 2026-03-23
- Se añade `fastlane` para automatizar build y publicación en Android e iOS.
- Se incorporan metadatos base para Play Store y App Store.
- Se añaden scripts npm para publicar o generar builds de release.

## 1.2.0 - 2026-03-23
- Se añade wrapper nativo con Capacitor para Android e iOS.
- Se generan los proyectos `android/` e `ios/` para construir APK/AAB e IPA desde la misma base web.
- Se incorpora un build web mínimo en `dist/` para sincronizar assets con Capacitor.
- Se añade configuración de permisos y versionado para publicación en tiendas.

## 1.1.0 - 2026-03-23
- Se añade detalle del equipo seleccionado con historial de movimientos por serial.
- Las altas y ediciones ya guardan eventos de historial en cada registro.
- Se migra de forma compatible el inventario existente sin historial al cargar desde `localStorage`.

## 1.0.0 - 2026-03-23
- Se crea la PWA base móvil-first para inventario de Duartec.
- Se añade escaneo con `html5-qrcode`, alta manual, búsqueda, filtros y exportación CSV.
- Se incorpora almacenamiento local persistente, modo offline y datos demo.
