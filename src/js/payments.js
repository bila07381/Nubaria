import { openNubariaDB } from "./database.js";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 2
});

function parseAmount(raw) {
  let value = String(raw ?? "").trim().replace(/\s/g, "");
  if (!value) return NaN;
  if (value.includes(",") && value.includes(".")) {
    if (value.lastIndexOf(",") > value.lastIndexOf(".")) value = value.replace(/\./g, "").replace(",", ".");
    else value = value.replace(/,/g, "");
  } else if (value.includes(",")) value = value.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  return /^\d+(\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
}

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const monthNow = () => today().slice(0, 7);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const id = () => crypto.randomUUID ? crypto.randomUUID() : `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const dateLabel = value => value
  ? new Intl.DateTimeFormat("es-AR").format(new Date(value + "T12:00:00"))
  : "—";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getAll(storeName) {
  const db = await openNubariaDB();
  try {
    return await requestResult(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
  } finally { db.close(); }
}
async function putRecord(storeName, record) {
  const db = await openNubariaDB();
  try {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function deleteRecord(storeName, recordId) {
  const db = await openNubariaDB();
  try {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(recordId);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function mountPayments(container) {
  let selectedMonth = monthNow();
  let editingId = null;
  let payments = [];
  let categories = [];

  const monthLabel = month => {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, number - 1, 1));
  };

  const load = async () => {
    [payments, categories] = await Promise.all([getAll("pagos"), getAll("categorias")]);
    categories = categories.filter(category => !category.module || category.module === "pagos");
    for (const item of payments) {
      if (item.category && item.category !== "Sin categoría" && !categories.some(category => category.name === item.category)) {
        categories.push({ id: `legacy-${item.category}`, name: item.category, module: "pagos" });
      }
    }
  };

  const render = async () => {
    await load();
    const monthItems = payments
      .filter(item => item.date?.slice(0, 7) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const total = monthItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthOptions = [...new Set([monthNow(), ...payments.map(item => item.date?.slice(0, 7)).filter(Boolean)])]
      .sort((a, b) => b.localeCompare(a));

    const categoryOptions = selected => [
      `<option value="Sin categoría" ${selected === "Sin categoría" || !selected ? "selected" : ""}>Sin categoría</option>`,
      ...categories.map(category => `<option value="${escapeHTML(category.name)}" ${category.name === selected ? "selected" : ""}>${escapeHTML(category.name)}</option>`),
      '<option value="__new__">＋ Agregar categoría…</option>'
    ].join("");

    container.innerHTML = `
      <section class="payment-screen">
        <div class="income-toolbar">
          <div><p class="eyebrow">GASTOS COTIDIANOS REALIZADOS</p><h2>${escapeHTML(monthLabel(selectedMonth))}</h2></div>
          <label class="month-picker">Consultar mes
            <select id="payment-month">${monthOptions.map(month => `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${escapeHTML(monthLabel(month))}</option>`).join("")}</select>
          </label>
        </div>
        <article class="income-total payment-total">
          <span>Total gastado</span><strong>${money.format(total)}</strong>
          <small>${monthItems.length} ${monthItems.length === 1 ? "pago registrado" : "pagos registrados"}</small>
        </article>
        <article class="panel income-form-panel">
          <h3>${editingId ? "Editar pago" : "Registrar pago"}</h3>
          <form id="payment-form" class="payment-form">
            <label>Concepto<input id="payment-concept" name="concept" maxlength="100" placeholder="Ej. Supermercado, combustible, farmacia…" required></label>
            <label>Importe<input id="payment-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej. 125000,50" required></label>
            <label>Fecha del pago<input id="payment-date" name="date" type="date" value="${today()}" required></label>
            <label>Medio de pago
              <select id="payment-method" name="method">
                <option value="Débito" selected>Débito</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label>Categoría
              <select id="payment-category" name="category">${categoryOptions("Sin categoría")}</select>
            </label>
            <div class="payment-form-actions"><button class="primary-button" type="submit">${editingId ? "Guardar cambios" : "Guardar pago"}</button>${editingId ? '<button class="secondary-button" id="payment-cancel" type="button">Cancelar</button>' : ""}</div>
          </form>
          <p class="fixed-hint">Registrá acá solamente gastos que ya realizaste. Las compras con tarjeta de crédito se administran en Tarjetas y el resumen se carga en Gastos fijos.</p>
        </article>
        <div class="income-list-heading"><h3>Movimientos</h3><span>${monthItems.length} en el mes</span></div>
        <div class="payment-list">
          ${monthItems.length ? monthItems.map(item => `
            <article class="income-row payment-row">
              <div class="income-row-main">
                <span class="income-row-icon payment-icon">↘</span>
                <div><strong>${escapeHTML(item.concept)}</strong><small>${dateLabel(item.date)} · ${escapeHTML(item.method || "Débito")} · ${escapeHTML(item.category || "Sin categoría")}</small></div>
              </div>
              <div class="income-row-end">
                <strong>${money.format(Number(item.amount))}</strong>
                <div><button type="button" class="text-button" data-edit-payment="${escapeHTML(item.id)}">Editar</button><button type="button" class="text-button danger-text" data-delete-payment="${escapeHTML(item.id)}">Eliminar</button></div>
              </div>
            </article>`).join("") : '<div class="panel income-empty"><div class="empty-icon">↘</div><h3>Todavía no hay pagos</h3><p>Cuando registres un gasto cotidiano, lo vas a encontrar acá.</p></div>'}
        </div>
      </section>`;

    container.querySelector("#payment-month").addEventListener("change", event => {
      selectedMonth = event.target.value;
      editingId = null;
      render();
    });

    const categorySelect = container.querySelector("#payment-category");
    categorySelect.addEventListener("change", async () => {
      if (categorySelect.value !== "__new__") return;
      const name = prompt("Nombre de la nueva categoría:");
      if (!name?.trim()) {
        categorySelect.value = "Sin categoría";
        return;
      }
      const clean = name.trim().slice(0, 40);
      let category = categories.find(item => item.name.toLowerCase() === clean.toLowerCase());
      if (!category) {
        category = { id: id(), name: clean, module: "pagos", createdAt: Date.now() };
        try {
          await putRecord("categorias", category);
          categories.push(category);
        } catch (error) {
          console.error(error);
          alert("No se pudo guardar la categoría. Intentá nuevamente.");
          categorySelect.value = "Sin categoría";
          return;
        }
      }
      let option = [...categorySelect.options].find(item => item.value === category.name);
      if (!option) {
        option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.insertBefore(option, categorySelect.options[categorySelect.options.length - 1]);
      }
      categorySelect.value = category.name;
    });

    container.querySelector("#payment-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const concept = String(form.get("concept") || "").trim();
      const amount = parseAmount(form.get("amount"));
      const date = String(form.get("date") || "");
      const method = String(form.get("method") || "Débito");
      const category = String(form.get("category") || "Sin categoría");
      if (!concept || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Revisá el concepto, el importe y la fecha.");
        return;
      }
      const previous = editingId ? payments.find(item => item.id === editingId) : null;
      const record = {
        id: editingId || id(), concept, amount, date, method, category,
        createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now()
      };
      try {
        await putRecord("pagos", record);
        selectedMonth = date.slice(0, 7);
        editingId = null;
        await render();
      } catch (error) {
        console.error(error);
        alert("No se pudo guardar el pago. Intentá nuevamente.");
      }
    });

    container.querySelectorAll("[data-edit-payment]").forEach(button => button.addEventListener("click", () => {
      const item = payments.find(entry => entry.id === button.dataset.editPayment);
      if (!item) return;
      editingId = item.id;
      render().then(() => {
        container.querySelector("#payment-concept").value = item.concept;
        container.querySelector("#payment-amount").value = String(item.amount).replace(".", ",");
        container.querySelector("#payment-date").value = item.date;
        container.querySelector("#payment-method").value = item.method || "Débito";
        container.querySelector("#payment-category").value = item.category || "Sin categoría";
        container.querySelector("#payment-concept").focus();
      });
    }));

    container.querySelectorAll("[data-delete-payment]").forEach(button => button.addEventListener("click", async () => {
      const item = payments.find(entry => entry.id === button.dataset.deletePayment);
      if (!item || !confirm(`¿Eliminar el pago "${item.concept}"? Esta acción no se puede deshacer.`)) return;
      try {
        await deleteRecord("pagos", item.id);
        if (editingId === item.id) editingId = null;
        await render();
      } catch (error) {
        console.error(error);
        alert("No se pudo eliminar el pago.");
      }
    }));

    const cancel = container.querySelector("#payment-cancel");
    if (cancel) cancel.addEventListener("click", () => {
      editingId = null;
      render();
    });
  };

  try {
    await render();
  } catch (error) {
    console.error(error);
    container.innerHTML = '<article class="panel"><h2>No pudimos abrir Pagos</h2><p>Revisá que el navegador permita el almacenamiento local e intentá recargar Nubaria.</p></article>';
  }
}
