export function showNubariaDialog({ title = "Aviso", message = "", confirmText = "Aceptar", cancelText = "Cancelar", showCancel = false, danger = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "nubaria-modal-backdrop";
    overlay.innerHTML = `
      <section class="nubaria-modal" role="alertdialog" aria-modal="true" aria-labelledby="nubaria-modal-title" aria-describedby="nubaria-modal-message">
        <span class="eyebrow">NUBARIA</span>
        <h3 id="nubaria-modal-title"></h3>
        <p id="nubaria-modal-message"></p>
        <div class="nubaria-modal-actions">
          ${showCancel ? '<button type="button" class="secondary-button" data-modal-cancel></button>' : ""}
          <button type="button" class="primary-button ${danger ? "danger-button" : ""}" data-modal-ok></button>
        </div>
      </section>`;
    overlay.querySelector("#nubaria-modal-title").textContent = title;
    overlay.querySelector("#nubaria-modal-message").textContent = message;
    overlay.querySelector("[data-modal-ok]").textContent = confirmText;
    const cancel = overlay.querySelector("[data-modal-cancel]");
    if (cancel) cancel.textContent = cancelText;
    const finish = value => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish(false);
    });
    if (cancel) cancel.addEventListener("click", () => finish(false));
    overlay.querySelector("[data-modal-ok]").addEventListener("click", () => finish(true));
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    overlay.querySelector("[data-modal-ok]").focus();
  });
}
export async function showNubariaMessage(message, title = "Aviso") {
  await showNubariaDialog({ title, message, confirmText: "Entendido" });
}
export async function showNubariaConfirm(message, title = "¿Confirmar acción?") {
  return showNubariaDialog({ title, message, confirmText: "Sí, continuar", cancelText: "Cancelar", showCancel: true, danger: true });
}
