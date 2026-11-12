import { openNubariaDB } from "./database.js";
import { mountIncomes } from "./incomes.js";
import { mountFixedExpenses } from "./fixed-expenses.js";
import { mountPayments } from "./payments.js";

const screenNames = {
  inicio: "Inicio",
  ingresos: "Ingresos",
  "gastos-fijos": "Gastos fijos",
  pagos: "Pagos",
  tarjetas: "Tarjetas",
  creditos: "Créditos",
  balance: "Balance mensual",
  configuracion: "Configuración"
};

const descriptions = {
  ingresos: "Acá construiremos el registro de ingresos, su historial y los totales mensuales.",
  "gastos-fijos": "Acá organizaremos facturas, vencimientos, pagos parciales y obligaciones pendientes.",
  pagos: "Acá registraremos los gastos cotidianos que ya fueron realizados.",
  tarjetas: "Acá administraremos tarjetas, compras en cuotas y suscripciones como ayuda memoria.",
  creditos: "Acá llevaremos el seguimiento de préstamos y cuotas.",
  balance: "Acá reuniremos ingresos, gastos efectivos y obligaciones pendientes del mes.",
  configuracion: "Acá estarán las categorías, las copias de seguridad y las preferencias de apariencia."
};

const title = document.querySelector("#screen-title");
const content = document.querySelector("#screen-content");
const nav = document.querySelector("#main-nav");
const themeToggle = document.querySelector("#theme-toggle");

function showScreen(screen) {
  const name = screenNames[screen] ? screen : "inicio";
  title.textContent = screenNames[name];
  document.querySelectorAll("[data-screen]").forEach(button => {
    button.classList.toggle("active", button.dataset.screen === name);
  });

  if (name === "ingresos") {
    mountIncomes(content);
  } else if (name === "gastos-fijos") {
    mountFixedExpenses(content);
  } else if (name === "pagos") {
    mountPayments(content);
  } else if (name === "inicio") {
    content.innerHTML = `
      <div class="welcome-card">
        <div><p class="eyebrow">BIENVENIDO A</p><h2>Nubaria</h2><p>Un lugar para organizar tus finanzas con tranquilidad.</p></div>
        <img src="./icons/nubaria.svg" alt="" width="88" height="88">
      </div>
      <div class="summary-grid">
        <article class="summary-card"><span>Total cobrado</span><strong>—</strong><small>Este mes</small></article>
        <article class="summary-card"><span>Total gastado</span><strong>—</strong><small>Este mes</small></article>
        <article class="summary-card"><span>Pendiente de pago</span><strong>—</strong><small>Obligaciones registradas</small></article>
      </div>
      <article class="panel empty-panel"><div class="empty-icon">✦</div><h3>Tu organización empieza acá</h3><p>Vamos a construir cada herramienta paso a paso, cuidando tus datos y las reglas que definimos.</p></article>`;
  } else {
    content.innerHTML = `<article class="screen-placeholder"><p class="eyebrow">MÓDULO EN PREPARACIÓN</p><h2>${screenNames[name]}</h2><p>${descriptions[name]}</p><p>Esta sección todavía no guarda movimientos. La iremos implementando y probando por etapas.</p></article>`;
  }

  history.replaceState(null, "", `#${name}`);
}

nav.addEventListener("click", event => {
  const button = event.target.closest("[data-screen]");
  if (button) showScreen(button.dataset.screen);
});

document.querySelector(".settings-link").addEventListener("click", () => showScreen("configuracion"));

themeToggle.addEventListener("click", () => {
  const root = document.documentElement;
  const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = nextTheme;
  themeToggle.innerHTML = nextTheme === "light" ? "☾ <span>Modo nocturno</span>" : "☼ <span>Modo claro</span>";
});

const savedTheme = localStorage.getItem("nubaria-theme");
if (savedTheme === "light") document.documentElement.dataset.theme = "light";
themeToggle.addEventListener("click", () => localStorage.setItem("nubaria-theme", document.documentElement.dataset.theme || "dark"));

showScreen(location.hash.slice(1) || "inicio");

openNubariaDB()
  .then(db => {
    console.info("Nubaria: almacenamiento local preparado.");
    db.close();
  })
  .catch(error => {
    console.error("No se pudo preparar el almacenamiento local:", error);
  });

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.error("No se pudo registrar el modo sin conexión:", error);
    });
  });
}
