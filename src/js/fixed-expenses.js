import { showNubariaMessage, showNubariaConfirm } from "./dialogs.js";
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
const dateLabel = value => value
  ? new Intl.DateTimeFormat("es-AR").format(new Date(value + "T12:00:00"))
  : "—";
const id = () => crypto.randomUUID ? crypto.randomUUID() : `gf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const sumPaid = item => (item.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
const remaining = item => Math.max(0, Number(item.amount || 0) - sumPaid(item));
const isPaid = item => remaining(item) < 0.005;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, action) {
  const db = await openNubariaDB();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = action(store);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
}
async function getAll(storeName) {
  const db = await openNubariaDB();
  try { return await requestResult(db.transaction(storeName, "readonly").objectStore(storeName).getAll()); }
  finally { db.close(); }
}
async function putRecord(storeName, record) {
  return withStore(storeName, "readwrite", store => store.put(record));
}
async function deleteRecord(storeName, recordId) {
  return withStore(storeName, "readwrite", store => store.delete(recordId));
}

export async function mountFixedExpenses(container) {
  let selectedMonth = monthNow();
  let editingId = null;
  let payingId = null;
  let expenses = [];
  let categories = [];

  const monthLabel = month => {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, number - 1, 1));
  };
  const categoryOptions = selected => [
    '<option value="">Sin categoría</option>',
    ...categories.map(category => `<option value="${escapeHTML(category.name)}" ${category.name === selected ? "selected" : ""}>${escapeHTML(category.name)}</option>`),
    '<option value="__new__">＋ Agregar categoría…</option>'
  ].join("");

  const load = async () => {
    [expenses, categories] = await Promise.all([getAll("gastosFijos"), getAll("categorias")]);
    categories = categories.filter(category => !category.module || category.module === "gastosFijos");
    for (const item of expenses) {
      if (item.category && !categories.some(category => category.name === item.category)) categories.push({ id: `legacy-${item.category}`, name: item.category, module: "gastosFijos" });
    }
  };

  const render = async () => {
    await load();
    const monthItems = expenses.filter(item => {
      const dueMonth = (item.dueDate || item.registeredAt || "").slice(0, 7);
      return dueMonth === selectedMonth || (!isPaid(item) && dueMonth < selectedMonth) || (item.payments || []).some(payment => payment.date?.slice(0, 7) === selectedMonth);
    }).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (a.createdAt || 0) - (b.createdAt || 0));
    const paidThisMonth = expenses.reduce((sum, item) => sum + (item.payments || [])
      .filter(payment => payment.date?.slice(0, 7) === selectedMonth)
      .reduce((part, payment) => part + Number(payment.amount || 0), 0), 0);
    const pendingTotal = monthItems.reduce((sum, item) => sum + remaining(item), 0);
    const paymentMonths = expenses.flatMap(item => (item.payments || []).map(payment => payment.date?.slice(0, 7))).filter(Boolean);
    const monthOptions = [...new Set([monthNow(), ...expenses.map(item => item.dueDate?.slice(0, 7)).filter(Boolean), ...paymentMonths])]
      .sort((a, b) => b.localeCompare(a));

    container.innerHTML = `
      <section class="fixed-screen">
        <div class="fixed-toolbar">
          <div><p class="eyebrow">OBLIGACIONES Y VENCIMIENTOS</p><h2>${escapeHTML(monthLabel(selectedMonth))}</h2></div>
          <label class="month-picker">Consultar mes
            <select id="fixed-month">${monthOptions.map(month => `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${escapeHTML(monthLabel(month))}</option>`).join("")}</select>
          </label>
        </div>
        <div class="fixed-summary">
          <article class="fixed-stat paid"><span>Pagado este mes</span><strong>${money.format(paidThisMonth)}</strong><small>Según la fecha de cada pago</small></article>
          <article class="fixed-stat pending"><span>Saldo pendiente</span><strong>${money.format(pendingTotal)}</strong><small>Incluye obligaciones anteriores sin cancelar</small></article>
        </div>
        <article class="panel fixed-form-panel">
          <h3>${editingId ? "Editar obligación" : "Registrar gasto fijo"}</h3>
          <form id="fixed-form" class="fixed-form">
            <label>Concepto<input id="fixed-concept" name="concept" maxlength="100" list="fixed-concepts" placeholder="Ej. Ecogas, EPEC, internet…" required></label>
            <datalist id="fixed-concepts">${[...new Set(expenses.map(item => item.concept))].map(value => `<option value="${escapeHTML(value)}"></option>`).join("")}</datalist>
            <label>Importe total<input id="fixed-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej. 125000,50" required></label>
            <label>Vencimiento<input id="fixed-due" name="dueDate" type="date" value="${today()}" required></label>
            <label>Categoría (opcional)<select id="fixed-category" name="category">${categoryOptions("")}</select></label>
            <div class="fixed-form-actions"><button class="primary-button" type="submit">${editingId ? "Guardar cambios" : "Guardar obligación"}</button>${editingId ? '<button class="secondary-button" id="fixed-cancel" type="button">Cancelar</button>' : ""}</div>
          </form>
          <p class="fixed-hint">La obligación queda pendiente hasta que registres un pago. No se descuenta del balance por su vencimiento.</p>
        </article>
        <div class="income-list-heading"><h3>Obligaciones</h3><span>${monthItems.length} registradas</span></div>
        <div class="fixed-list">
          ${monthItems.length ? monthItems.map(item => {
            const paid = sumPaid(item);
            const balance = remaining(item);
            const status = isPaid(item) ? "Pagada" : (item.dueDate < today() ? "Vencida" : "Pendiente");
            return `
              <article class="fixed-row">
                <div class="fixed-row-top">
                  <div class="fixed-row-title"><strong>${escapeHTML(item.concept)}</strong><span class="fixed-status ${status === "Pagada" ? "is-paid" : status === "Vencida" ? "is-overdue" : "is-pending"}">${status}</span></div>
                  <div class="fixed-row-amount">${money.format(Number(item.amount))}</div>
                </div>
                <div class="fixed-row-meta"><span>Vence: ${dateLabel(item.dueDate)}</span><span>${escapeHTML(item.category || "Sin categoría")}</span></div>
                <div class="fixed-progress"><span>Abonado: ${money.format(paid)}</span><span>Saldo: <strong>${money.format(balance)}</strong></span></div>
                ${(item.payments || []).length ? `<details class="fixed-history"><summary>Ver ${item.payments.length} ${item.payments.length === 1 ? "pago registrado" : "pagos registrados"}</summary>${item.payments.slice().sort((a,b) => b.date.localeCompare(a.date)).map(payment => `<div class="fixed-payment-line"><span>${dateLabel(payment.date)}</span><strong>${money.format(payment.amount)}</strong></div>`).join("")}</details>` : ""}
                ${payingId === item.id ? `
                  <form class="fixed-pay-form" data-pay-form="${escapeHTML(item.id)}">
                    <label>Importe a pagar<input name="paymentAmount" type="text" inputmode="decimal" autocomplete="off" value="${balance.toFixed(2).replace(".", ",")}" required></label>
                    <label>Fecha del pago<input name="paymentDate" type="date" value="${today()}" required></label>
                    <div><button class="primary-button" type="submit">Confirmar pago</button><button class="secondary-button" type="button" data-cancel-pay>Cancelar</button></div>
                  </form>` : ""}
                <div class="fixed-row-actions">
                  ${!isPaid(item) ? `<button type="button" class="primary-button small-button" data-pay="${escapeHTML(item.id)}">Registrar pago</button>` : ""}
                  <button type="button" class="text-button" data-edit-fixed="${escapeHTML(item.id)}">Editar</button>
                  <button type="button" class="text-button danger-text" data-delete-fixed="${escapeHTML(item.id)}">Eliminar</button>
                </div>
              </article>`;
          }).join("") : '<div class="panel income-empty"><div class="empty-icon">▤</div><h3>No hay obligaciones registradas</h3><p>Cuando cargues una factura o cuota, va a aparecer acá.</p></div>'}
        </div>
      </section>
      <dialog id="fixed-category-dialog" class="nubaria-dialog">
        <form id="fixed-category-form" class="nubaria-dialog-card">
          <span class="eyebrow">PERSONALIZÁ NUBARIA</span>
          <h3>Nueva categoría</h3>
          <p>Elegí un nombre para organizar esta obligación.</p>
          <label for="fixed-new-category">Nombre de la categoría</label>
          <input id="fixed-new-category" name="categoryName" maxlength="40" placeholder="Ej. Servicios" required>
          <div class="nubaria-dialog-actions">
            <button type="button" class="secondary-button" id="fixed-category-cancel">Cancelar</button>
            <button type="submit" class="primary-button">Guardar categoría</button>
          </div>
        </form>
      </dialog>`;

    container.querySelector("#fixed-month").addEventListener("change", event => {
      selectedMonth = event.target.value; editingId = null; payingId = null; render();
    });

    const categorySelect = container.querySelector("#fixed-category");
    categorySelect.addEventListener("change", async () => {
      if (categorySelect.value !== "__new__") return;

      // Crear una categoría sin volver a dibujar el formulario:
      // así se conservan todos los campos que el usuario ya completó.
      const formElement = container.querySelector("#fixed-form");
      const draft = {
        concept: formElement.elements.concept.value,
        amount: formElement.elements.amount.value,
        dueDate: formElement.elements.dueDate.value
      };
      const categoryDialog = container.querySelector("#fixed-category-dialog");
      const categoryInput = container.querySelector("#fixed-new-category");
      const categoryForm = container.querySelector("#fixed-category-form");
      categoryInput.value = "";
      const clean = await new Promise(resolve => {
        const finish = value => {
          categoryDialog.close();
          categoryForm.removeEventListener("submit", onSubmit);
          container.querySelector("#fixed-category-cancel").removeEventListener("click", onCancel);
          resolve(value);
        };
        const onSubmit = event => { event.preventDefault(); finish(categoryInput.value.trim().slice(0, 40)); };
        const onCancel = () => finish("");
        categoryForm.addEventListener("submit", onSubmit);
        container.querySelector("#fixed-category-cancel").addEventListener("click", onCancel);
        categoryDialog.addEventListener("cancel", onCancel, { once: true });
        categoryDialog.showModal();
        categoryInput.focus();
      });
      if (!clean) { categorySelect.value = ""; return; }
      let category = categories.find(item => item.name.toLowerCase() === clean.toLowerCase());
      if (!category) {
        category = { id: id(), name: clean, module: "gastosFijos", createdAt: Date.now() };
        try {
          await putRecord("categorias", category);
          categories.push(category);
        } catch (error) {
          console.error(error);
          await showNubariaMessage("No se pudo guardar la categoría. Intentá nuevamente.");
          categorySelect.value = "";
          return;
        }
      }

      const option = [...categorySelect.options].find(item => item.value === category.name);
      if (!option) {
        const newOption = document.createElement("option");
        newOption.value = category.name;
        newOption.textContent = category.name;
        categorySelect.insertBefore(newOption, categorySelect.options[categorySelect.options.length - 1]);
      }

      formElement.elements.concept.value = draft.concept;
      formElement.elements.amount.value = draft.amount;
      formElement.elements.dueDate.value = draft.dueDate;
      categorySelect.value = category.name;
    });

    const conceptInput = container.querySelector("#fixed-concept");
    conceptInput.addEventListener("change", () => {
      const match = expenses.find(item => item.concept.toLowerCase() === conceptInput.value.trim().toLowerCase());
      if (match && !editingId) container.querySelector("#fixed-category").value = match.category || "";
    });

    container.querySelector("#fixed-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const concept = String(form.get("concept") || "").trim();
      const amount = parseAmount(form.get("amount"));
      const dueDate = String(form.get("dueDate") || "");
      const category = String(form.get("category") || "");
      const previous = editingId ? expenses.find(item => item.id === editingId) : null;
      const alreadyPaid = previous ? sumPaid(previous) : 0;
      if (!concept || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        await showNubariaMessage("Revisá el concepto, el importe y el vencimiento."); return;
      }
      if (amount + 0.004 < alreadyPaid) {
        await showNubariaMessage("El importe total no puede ser menor a lo que ya se abonó."); return;
      }
      const record = {
        id: editingId || id(), concept, amount, dueDate, category,
        payments: previous?.payments || [],
        registeredAt: previous?.registeredAt || today(),
        createdAt: previous?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      try {
        await putRecord("gastosFijos", record);
        selectedMonth = dueDate.slice(0, 7); editingId = null; payingId = null;
        await render();
      } catch (error) {
        console.error(error); await showNubariaMessage("No se pudo guardar la obligación. Intentá nuevamente.");
      }
    });

    container.querySelectorAll("[data-pay]").forEach(button => button.addEventListener("click", () => {
      payingId = button.dataset.pay; render();
    }));
    container.querySelectorAll("[data-cancel-pay]").forEach(button => button.addEventListener("click", () => {
      payingId = null; render();
    }));
    container.querySelectorAll("[data-pay-form]").forEach(formElement => formElement.addEventListener("submit", async event => {
      event.preventDefault();
      const item = expenses.find(entry => entry.id === formElement.dataset.payForm);
      if (!item) return;
      const form = new FormData(formElement);
      const amount = parseAmount(form.get("paymentAmount"));
      const date = String(form.get("paymentDate") || "");
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining(item) + 0.004 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        await showNubariaMessage("Revisá el importe y la fecha. El pago no puede superar el saldo pendiente."); return;
      }
      const record = { ...item, payments: [...(item.payments || []), { id: id(), amount, date, createdAt: Date.now() }], updatedAt: Date.now() };
      try {
        await putRecord("gastosFijos", record);
        payingId = null;
        selectedMonth = date.slice(0, 7);
        await render();
      } catch (error) {
        console.error(error); await showNubariaMessage("No se pudo registrar el pago.");
      }
    }));

    container.querySelectorAll("[data-edit-fixed]").forEach(button => button.addEventListener("click", () => {
      const item = expenses.find(entry => entry.id === button.dataset.editFixed);
      if (!item) return;
      editingId = item.id; payingId = null;
      render().then(() => {
        container.querySelector("#fixed-concept").value = item.concept;
        container.querySelector("#fixed-amount").value = String(item.amount).replace(".", ",");
        container.querySelector("#fixed-due").value = item.dueDate;
        container.querySelector("#fixed-category").value = item.category || "";
        container.querySelector("#fixed-concept").focus();
      });
    }));

    container.querySelectorAll("[data-delete-fixed]").forEach(button => button.addEventListener("click", async () => {
      const item = expenses.find(entry => entry.id === button.dataset.deleteFixed);
      if (!item) return;
      const warning = (item.payments || []).length
        ? `¿Eliminar "${item.concept}" y sus ${item.payments.length} pagos registrados? Esta acción no se puede deshacer.`
        : `¿Eliminar la obligación "${item.concept}"? Esta acción no se puede deshacer.`;
      if (!await showNubariaConfirm(warning)) return;
      try {
        await deleteRecord("gastosFijos", item.id);
        if (editingId === item.id) editingId = null;
        await render();
      } catch (error) {
        console.error(error); await showNubariaMessage("No se pudo eliminar la obligación.");
      }
    }));

    const cancel = container.querySelector("#fixed-cancel");
    if (cancel) cancel.addEventListener("click", () => { editingId = null; render(); });
  };

  try { await render(); }
  catch (error) {
    console.error(error);
    container.innerHTML = '<article class="panel"><h2>No pudimos abrir Gastos fijos</h2><p>Revisá el almacenamiento local e intentá recargar Nubaria.</p></article>';
  }
}
