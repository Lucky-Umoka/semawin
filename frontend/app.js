const ENTRIES_KEY = "semawin_entries";
const SETTINGS_KEY = "semawin_settings";

let entries = [];
let settings = null;

function byId(id) {
  return document.getElementById(id);
}

const setupSection = byId("setup-section");
const appSection = byId("app-section");
const shopTitle = byId("shop-title");
const businessInput = byId("business-name");
const currencySelect = byId("currency");
const saveSetupButton = byId("save-setup");
const serverName = byId("server-name");

function loadData() {
  try {
    entries = JSON.parse(localStorage.getItem(ENTRIES_KEY)) || [];
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch (error) {
    entries = [];
    settings = null;
  }
}

function saveEntries() {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    return false;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    return false;
  }
}

function formatMoney(amount) {
  const text = Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return text + " " + settings.currency;
}

function showScreen() {
  if (settings === null) {
    setupSection.hidden = false;
    appSection.hidden = true;
  } else {
    setupSection.hidden = true;
    appSection.hidden = false;
    shopTitle.textContent = settings.business;
  }
}

saveSetupButton.addEventListener("click", function () {
  const business = businessInput.value.trim();
  if (business === "") {
    alert("Please type your shop name.");
    return;
  }
  settings = { business: business, currency: currencySelect.value };
  saveSettings();
  showScreen();
});

async function showServerName() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    serverName.textContent = data.server;
  } catch (error) {
    serverName.textContent = "not reachable";
  }
}

const entryText = byId("entry-text");
const recordButton = byId("record-button");
const parseButton = byId("parse-button");
const statusMessage = byId("status-message");
const confirmSection = byId("confirm-section");
const sourceNote = byId("source-note");
const confirmType = byId("confirm-type");
const confirmItem = byId("confirm-item");
const confirmQuantity = byId("confirm-quantity");
const confirmPrice = byId("confirm-price");
const confirmCustomer = byId("confirm-customer");
const confirmPaid = byId("confirm-paid");
const confirmTotal = byId("confirm-total");
const saveEntryButton = byId("save-entry");
const cancelEntryButton = byId("cancel-entry");

function setStatus(message, isError) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function todayText() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

function updateConfirmTotal() {
  const quantity = Number(confirmQuantity.value);
  const price = Number(confirmPrice.value);
  confirmTotal.textContent = formatMoney(quantity * price);
}

function fillConfirmCard(entry, source) {
  confirmType.value = entry.type;
  confirmItem.value = entry.item;
  confirmQuantity.value = entry.quantity;
  confirmPrice.value = entry.unit_price;
  confirmCustomer.value = entry.customer;
  confirmPaid.checked = entry.paid;
  if (source === "ai") {
    sourceNote.textContent = "Understood by the AI. Check the numbers before saving.";
  } else {
    sourceNote.textContent = "The AI was not available, so a simple reader was used. Please check every field.";
  }
  updateConfirmTotal();
  confirmSection.hidden = false;
}

function renderAll() {
  console.log("Entries saved:", entries.length);
}

confirmQuantity.addEventListener("input", updateConfirmTotal);
confirmPrice.addEventListener("input", updateConfirmTotal);

parseButton.addEventListener("click", async function () {
  const text = entryText.value.trim();
  if (text === "") {
    setStatus("Please say or type what happened first.", true);
    return;
  }
  parseButton.disabled = true;
  setStatus("Reading your entry...", false);
  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });
    const servedBy = response.headers.get("X-Served-By");
    if (servedBy) {
      serverName.textContent = servedBy;
    }
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Something went wrong.", true);
    } else {
      fillConfirmCard(data.entry, data.source);
      setStatus("", false);
    }
  } catch (error) {
    setStatus("Could not reach the server. Check your connection and try again.", true);
  }
  parseButton.disabled = false;
});

saveEntryButton.addEventListener("click", function () {
  const type = confirmType.value;
  const item = confirmItem.value.trim().toLowerCase();
  const quantity = Number(confirmQuantity.value);
  const price = Number(confirmPrice.value);
  const customer = confirmCustomer.value.trim();
  const paid = type === "sale" ? confirmPaid.checked : true;

  if (item === "") {
    setStatus("Please type the item name.", true);
    return;
  }
  if (!(quantity > 0) || !(price > 0)) {
    setStatus("Quantity and price must be more than zero.", true);
    return;
  }
  if (!paid && customer === "") {
    setStatus("Who owes you? Type the customer name.", true);
    return;
  }

  entries.push({
    id: Date.now(),
    date: todayText(),
    type: type,
    item: item,
    quantity: quantity,
    unit_price: price,
    total: Math.round(quantity * price * 100) / 100,
    customer: customer,
    paid: paid,
  });

  if (!saveEntries()) {
    entries.pop();
    setStatus("Could not save on this device. The storage may be full or blocked.", true);
    return;
  }

  confirmSection.hidden = true;
  entryText.value = "";
  setStatus("Saved.", false);
  renderAll();
});

cancelEntryButton.addEventListener("click", function () {
  confirmSection.hidden = true;
  setStatus("", false);
});


loadData();
showScreen();
renderAll();
showServerName();