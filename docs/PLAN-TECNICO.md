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

## 3. Datos y funcionamiento sin conexión en la primera etapa

La primera versión podrá trabajar con almacenamiento local en el dispositivo y ofrecer exportación e importación de copias de seguridad.

**Decisión acordada:** Nubaria deberá permitir consultar y registrar movimientos aunque el dispositivo no tenga conexión a internet.

Para lograrlo, la PWA deberá:
- guardar los datos en el propio dispositivo;
- almacenar en caché los recursos necesarios de la aplicación para que pueda abrirse sin conexión;
- permitir las operaciones locales previstas (consultar, cargar y modificar registros) sin depender de un servidor.

Consideraciones importantes:
- El funcionamiento sin conexión no implica sincronización automática entre dispositivos.
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
3. Implementar la base de la PWA, el funcionamiento sin conexión y la persistencia local.
4. Desarrollar los módulos uno por uno y probarlos.
5. Implementar copias de seguridad y restauración.
6. Evaluar backend, sincronización y distribución comercial.

## 6. Criterio de trabajo

No se modifican otros repositorios. Las decisiones funcionales y visuales importantes se revisan con el responsable del producto antes de implementarse.

## 7. Almacenamiento local elegido

**Decisión acordada:** utilizar **IndexedDB** como almacenamiento local principal de Nubaria en la primera versión.

Motivos:
- Está integrado en los navegadores modernos, por lo que el usuario no tendrá que instalar ni configurar una base de datos.
- Está pensado para guardar datos estructurados y permite manejar más información y consultas más complejas que alternativas simples como LocalStorage.
- Funciona de manera asíncrona y es adecuado para una aplicación que debe trabajar sin conexión.

IndexedDB no reemplaza las copias de seguridad ni proporciona sincronización entre dispositivos. Esas funciones se resolverán por separado.

## 8. Tecnologías elegidas para la primera versión

**Decisión acordada:** desarrollar Nubaria con una base de tecnologías web conocida y sencilla:

- **HTML** para la estructura de las pantallas.
- **CSS** para el diseño adaptable, los temas claro y nocturno y la presentación visual.
- **JavaScript** para la navegación, las interacciones y las reglas de negocio.
- **IndexedDB** para la persistencia local de los datos.
- **PWA y Service Worker** para permitir la instalación opcional y el funcionamiento sin conexión mediante caché de recursos.
- **GitHub** para versionar y conservar el código fuente.

La arquitectura deberá separar interfaz, lógica de negocio y acceso a datos, con módulos claros y pruebas progresivas. Se prioriza esta opción porque permite aprovechar la experiencia previa del proyecto y mantener bajos los costos iniciales.

La eventual publicación en Google Play se evaluará más adelante (por ejemplo, con Trusted Web Activity o Capacitor), según las necesidades reales de la aplicación.
