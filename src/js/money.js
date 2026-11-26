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

const digits = value => String(value ?? "").replace(/\D/g, "");
const grouped = value => (value || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function attachMoneyInput(input) {
  if (!input || input.dataset.moneyAttached) return;
  input.dataset.moneyAttached = "true";
  const format = () => {
    const current = input.value;
    if (current.includes(",")) {
      const [wholeRaw, centsRaw = ""] = current.split(",");
      const whole = grouped(digits(wholeRaw));
      const cents = digits(centsRaw).slice(0, 2);
      input.value = whole + "," + cents;
    } else {
      input.value = grouped(digits(current));
    }
    input.setSelectionRange(input.value.length, input.value.length);
  };
  input.addEventListener("keydown", event => {
    if (event.key !== "." && event.key !== ",") return;
    event.preventDefault();
    if (input.value.includes(",")) return;
    const whole = grouped(digits(input.value));
    input.value = whole + ",";
    input.setSelectionRange(input.value.length, input.value.length);
  });
  input.addEventListener("input", event => {
    if (event.inputType === "insertFromPaste") {
      const raw = input.value;
      if (/[,.]/.test(raw)) {
        const last = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
        const whole = grouped(digits(raw.slice(0, last)));
        const cents = digits(raw.slice(last + 1)).slice(0, 2);
        input.value = whole + "," + cents;
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
    }
    format();
  });
  if (input.value) format();
}
