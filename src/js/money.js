const digitsOnly = value => String(value ?? "").replace(/\D/g, "");

export function formatMoneyInput(value, decimal = false) {
  const digits = digitsOnly(value);
  const wholeDigits = decimal ? digits.slice(0, -Math.min(digits.length, 2)) : digits;
  const cents = decimal ? digits.slice(-2).padStart(Math.min(digits.length, 2), "0") : "";
  const whole = (wholeDigits || "0").replace(/^0+(?=\d)/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal ? grouped + "," + cents : grouped;
}

export function parseAmount(raw) {
  let value = String(raw ?? "").trim().replace(/\s/g, "");
  if (!value) return NaN;
  if (value.includes(",") && value.includes(".")) {
    if (value.lastIndexOf(",") > value.lastIndexOf(".")) value = value.replace(/\./g, "").replace(",", ".");
    else value = value.replace(/,/g, "");
  } else if (value.includes(",")) value = value.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  return /^\d+(\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
}

export function attachMoneyInput(input) {
  if (!input || input.dataset.moneyAttached) return;
  input.dataset.moneyAttached = "true";
  input.dataset.moneyDecimal = "false";

  const render = () => {
    const digits = digitsOnly(input.value);
    const decimal = input.dataset.moneyDecimal === "true";
    const formatted = formatMoneyInput(digits, decimal);
    input.value = formatted;
    input.setSelectionRange(formatted.length, formatted.length);
  };

  input.addEventListener("keydown", event => {
    if (event.key === "." || event.key === ",") {
      if (input.dataset.moneyDecimal === "true") {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      input.dataset.moneyDecimal = "true";
      render();
    }
  });

  input.addEventListener("input", event => {
    if (event.inputType === "insertFromPaste") {
      const pasted = input.value;
      const hasDecimal = /[,.]/.test(pasted);
      input.dataset.moneyDecimal = hasDecimal ? "true" : "false";
      if (hasDecimal) {
        const parts = pasted.split(/[,.]/);
        const digits = digitsOnly(parts.join(""));
        const formatted = formatMoneyInput(digits, true);
        input.value = formatted;
        input.setSelectionRange(formatted.length, formatted.length);
        return;
      }
    }
    render();
  });
}
