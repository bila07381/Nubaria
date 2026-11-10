import { openNubariaDB } from "./database.js";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2
});

function parseAmount(raw) {
  let value = String(raw ?? "").trim().replace(/\\s/g, "");
  if (!value) return NaN;

  // Con ambos separadores, el último se toma como decimal.
  if (value.includes(",") && value.includes(".")) {
    if (value.lastIndexOf(",") > value.lastIndexOf(".")) {
      value = value.replace(/\\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  } else if (/^\\d{1,3}(\\.\\d{3})+$/.test(value)) {
    // Un punto seguido de grupos de tres cifras se interpreta como miles.
    value = value.replace(/\\./g, "");
  }

  return /^\\d+(\\.\\d{1,2})?$/.test(value) ? Number(value) : NaN;
}

const today = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getIncomes() {
  const db = await openNubariaDB();
  try {
    return await requestResult(db.transaction("ingresos", "readonly").objectStore("ingresos").getAll());
  } finally {
    db.close();
  }
}

async function saveIncome(income) {
  const db = await openNubariaDB();
  try {
    const tx = db.transaction("ingresos", "readwrite");
    tx.objectStore("ingresos").put(income);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function deleteIncome(id) {
  const db = await openNubariaDB();
  try {
    const tx = db.transaction("ingresos", "readwrite");
    tx.objectStore("ingresos").delete(id);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function mountIncomes(container) {
  let selectedMonth = today().slice(0, 7);
  let editingId = null;

  const monthLabel = month => {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" })
      .format(new Date(year, number - 1, 1));
  };

  const render = async () => {
    const all = await getIncomes();
    const monthItems = all
      .filter(item => item.date?.slice(0, 7) === selectedMonth)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const total = monthItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthOptions = [...new Set([today().slice(0, 7), ...all.map(item => item.date?.slice(0, 7)).filter(Boolean)])]
      .sort((a, b) => b.localeCompare(a));

    container.innerHTML = `
      <section class="income-screen">
        <div class="income-toolbar">
          <div><p class="eyebrow">RESUMEN DEL MES</p><h2>${escapeHTML(monthLabel(selectedMonth))}</h2></div>
          <label class="month-picker">Consultar mes
            <select id="income-month">${monthOptions.map(month => `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${escapeHTML(monthLabel(month))}</option>`).join("")}</select>
          </label>
        </div>
        <article class="income-total"><span>Total cobrado</span><strong>${money.format(total)}</strong><small>${monthItems.length} ${monthItems.length === 1 ? "ingreso registrado" : "ingresos registrados"}</small></article>
        <article class="panel income-form-panel">
          <h3>${editingId ? "Editar ingreso" : "Registrar ingreso"}</h3>
          <form id="income-form" class="income-form">
            <label>Concepto<input id="income-concept" name="concept" maxlength="100" placeholder="Ej. Sueldo" required></label>
            <label>Importe<input id="income-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej. 125000,50 o 125000.50" required></label>
            <label>Fecha de cobro<input id="income-date" name="date" type="date" value="${today()}" required></label>
            <div class="income-form-actions"><button class="primary-button" type="submit">${editingId ? "Guardar cambios" : "Guardar ingreso"}</button>${editingId ? '<button class="secondary-button" id="income-cancel" type="button">Cancelar</button>' : ""}</div>
          </form>
        </article>
        <div class="income-list-heading"><h3>Movimientos</h3><span>${monthItems.length} en el mes</span></div>
        <div class="income-list">
          ${monthItems.length ? monthItems.map(item => `
            <article class="income-row">
              <div class="income-row-main"><span class="income-row-icon">↗</span><div><strong>${escapeHTML(item.concept)}</strong><small>${new Intl.DateTimeFormat("es-AR").format(new Date(item.date + "T12:00:00"))}</small></div></div>
              <div class="income-row-end"><strong>${money.format(Number(item.amount))}</strong><div><button type="button" class="text-button" data-edit="${escapeHTML(item.id)}">Editar</button><button type="button" class="text-button danger-text" data-delete="${escapeHTML(item.id)}">Eliminar</button></div></div>
            </article>`).join("") : '<div class="panel income-empty"><div class="empty-icon">↗</div><h3>Todavía no hay ingresos</h3><p>Cuando registres uno, lo vas a encontrar acá.</p></div>'}
        </div>
      </section>`;

    container.querySelector("#income-month").addEventListener("change", event => {
      selectedMonth = event.target.value;
      editingId = null;
      render();
    });

    container.querySelector("#income-form").addEventListener("submit", async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const concept = String(form.get("concept") || "").trim();
      const amount = parseAmount(form.get("amount"));
      const date = String(form.get("date") || "");
      if (!concept || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Revisá el concepto, el importe y la fecha.");
        return;
      }
      const previous = editingId ? all.find(item => item.id === editingId) : null;
      const income = {
        id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `ing-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        concept,
        amount,
        date,
        createdAt: previous?.createdAt || Date.now(),
        updatedAt: Date.now()
      };
      try {
        await saveIncome(income);
        selectedMonth = date.slice(0, 7);
        editingId = null;
        await render();
      } catch (error) {
        console.error(error);
        alert("No se pudo guardar el ingreso. Intentá nuevamente.");
      }
    });

    container.querySelectorAll("[data-edit]").forEach(button => {
      button.addEventListener("click", () => {
        const item = all.find(entry => entry.id === button.dataset.edit);
        if (!item) return;
        editingId = item.id;
        render().then(() => {
          container.querySelector("#income-concept").value = item.concept;
          container.querySelector("#income-amount").value = item.amount;
          container.querySelector("#income-date").value = item.date;
          container.querySelector("#income-concept").focus();
        });
      });
    });

    container.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click", async () => {
        const item = all.find(entry => entry.id === button.dataset.delete);
        if (!item || !confirm(`¿Eliminar el ingreso "${item.concept}"? Esta acción no se puede deshacer.`)) return;
        try {
          await deleteIncome(item.id);
          if (editingId === item.id) editingId = null;
          await render();
        } catch (error) {
          console.error(error);
          alert("No se pudo eliminar el ingreso.");
        }
      });
    });

    const cancel = container.querySelector("#income-cancel");
    if (cancel) cancel.addEventListener("click", () => {
      editingId = null;
      render();
    });
  };

  try {
    await render();
  } catch (error) {
    console.error(error);
    container.innerHTML = '<article class="panel"><h2>No pudimos abrir Ingresos</h2><p>Revisá que el navegador permita el almacenamiento local e intentá recargar Nubaria.</p></article>';
  }
}
