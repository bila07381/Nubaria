# Nubaria — Plan técnico inicial

**Lema:** Tus finanzas, en calma.

Este documento registra las decisiones iniciales para construir Nubaria de forma gradual. No representa todavía una implementación ni cierra decisiones que deban revisarse juntos.

## 1. Objetivo de la primera versión

Construir una aplicación de finanzas personales y familiares, cómoda en celular y computadora, que permita registrar ingresos, gastos, pagos, obligaciones, tarjetas, créditos y consultar el balance mensual.

## 2. Estrategia de producto

- Empezar como **PWA** (aplicación web instalable).
- Diseñar con enfoque **mobile-first**, adaptable a pantallas grandes.
- Mantener una interfaz coherente con la identidad visual aprobada: modo claro y modo nocturno.
- Desarrollar y probar los módulos por etapas, sin intentar construir todo de una vez.

## 3. Datos en la primera etapa

La primera versión podrá trabajar con almacenamiento local en el dispositivo y ofrecer exportación e importación de copias de seguridad.

Consideraciones importantes:
- Los datos locales no se sincronizan automáticamente entre dispositivos.
- Borrar los datos del navegador o perder el dispositivo puede provocar pérdida de información si no existe una copia de seguridad.
- La experiencia de respaldo y restauración debe probarse cuidadosamente antes de considerar la versión inicial lista.

## 4. Preparación para crecer

La estructura deberá separar la interfaz, las reglas de negocio y el acceso a los datos. Así podremos reemplazar o ampliar el almacenamiento local por un servicio de backend en una etapa posterior, sin rehacer toda la aplicación.

Una etapa comercial futura podría incorporar:
- cuentas de usuario y autenticación;
- sincronización entre dispositivos;
- pruebas gratuitas y planes de suscripción;
- publicación para Android en Google Play.

La publicación en Play Store podrá evaluarse mediante tecnologías como Trusted Web Activity o Capacitor, según las capacidades que necesitemos cuando llegue ese momento.

## 5. Orden de trabajo propuesto

1. Terminar y validar el diseño y los comportamientos de todas las pantallas.
2. Definir la tecnología y la estructura definitiva del proyecto.
3. Implementar la base de la PWA y la persistencia local.
4. Desarrollar los módulos uno por uno y probarlos.
5. Implementar copias de seguridad y restauración.
6. Evaluar backend, sincronización y distribución comercial.

## 6. Criterio de trabajo

No se modifican otros repositorios. Las decisiones funcionales y visuales importantes se revisan con el responsable del producto antes de implementarse.
