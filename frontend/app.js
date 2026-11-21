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
  const currency = settings ? settings.currency : "";
  return text + " " + currency;
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

const searchBox = byId("search-box");
const filterType = byId("filter-type");
const filterPaid = byId("filter-paid");
const sortBy = byId("sort-by");
const ledgerBody = byId("ledger-body");
const emptyMessage = byId("empty-message");

function getVisibleEntries() {
  const searchText = searchBox.value.trim().toLowerCase();

  const visible = entries.filter(function (entry) {
    if (filterType.value !== "all" && entry.type !== filterType.value) {
      return false;
    }
    if (filterPaid.value === "paid" && !entry.paid) {
      return false;
    }
    if (filterPaid.value === "owed" && entry.paid) {
      return false;
    }
    if (searchText !== "") {
      const words = entry.item + " " + entry.customer;
      if (!words.toLowerCase().includes(searchText)) {
        return false;
      }
    }
    return true;
  });

  if (sortBy.value === "oldest") {
    visible.sort(function (a, b) {
      return a.id - b.id;
    });
  } else if (sortBy.value === "biggest") {
    visible.sort(function (a, b) {
      return b.total - a.total;
    });
  } else if (sortBy.value === "item") {
    visible.sort(function (a, b) {
      return a.item.localeCompare(b.item);
    });
  } else {
    visible.sort(function (a, b) {
      return b.id - a.id;
    });
  }
  return visible;
}

function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
}

function markPaid(id) {
  const entry = entries.find(function (item) {
    return item.id === id;
  });
  if (!entry) {
    return;
  }
  entry.paid = true;
  if (!saveEntries()) {
    entry.paid = false;
    alert("Could not save on this device.");
    return;
  }
  renderAll();
}

function deleteEntry(id) {
  if (!confirm("Delete this entry?")) {
    return;
  }
  const oldEntries = entries;
  entries = entries.filter(function (entry) {
    return entry.id !== id;
  });
  if (!saveEntries()) {
    entries = oldEntries;
    alert("Could not save on this device.");
  }
  renderAll();
}

function renderLedger() {
  const visible = getVisibleEntries();
  ledgerBody.textContent = "";

  if (entries.length === 0) {
    emptyMessage.textContent = "No entries yet. Add your first one above.";
    emptyMessage.hidden = false;
  } else if (visible.length === 0) {
    emptyMessage.textContent = "No entries match your search or filters.";
    emptyMessage.hidden = false;
  } else {
    emptyMessage.hidden = true;
  }

  visible.forEach(function (entry) {
    const row = document.createElement("tr");
    addCell(row, entry.date);
    addCell(row, entry.type);
    addCell(row, entry.item);
    addCell(row, entry.quantity);
    addCell(row, formatMoney(entry.unit_price));
    addCell(row, formatMoney(entry.total));
    addCell(row, entry.customer);
    if (entry.type === "sale") {
      addCell(row, entry.paid ? "Paid" : "Owed");
    } else {
      addCell(row, "");
    }

    const actions = document.createElement("td");
    if (entry.type === "sale" && !entry.paid) {
      const paidButton = document.createElement("button");
      paidButton.textContent = "Mark paid";
      paidButton.addEventListener("click", function () {
        markPaid(entry.id);
      });
      actions.appendChild(paidButton);
    }
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "secondary";
    deleteButton.addEventListener("click", function () {
      deleteEntry(entry.id);
    });
    actions.appendChild(deleteButton);
    row.appendChild(actions);

    ledgerBody.appendChild(row);
  });
}

function renderAll() {
  renderLedger();
}

searchBox.addEventListener("input", renderLedger);
filterType.addEventListener("change", renderLedger);
filterPaid.addEventListener("change", renderLedger);
sortBy.addEventListener("change", renderLedger);

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

let recorder = null;
let recordedChunks = [];
let stopTimer = null;

function pickMimeType() {
  const options = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of options) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    setStatus("Voice needs a secure page (https) and a modern browser. Please type your entry instead.", true);
    return;
  }

  recordButton.disabled = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    recordButton.disabled = false;
    setStatus("The microphone is blocked. Allow it in your browser, or type your entry.", true);
    return;
  }
  recordButton.disabled = false;

  const mimeType = pickMimeType();
  if (mimeType) {
    recorder = new MediaRecorder(stream, { mimeType: mimeType });
  } else {
    recorder = new MediaRecorder(stream);
  }
  recordedChunks = [];

  recorder.addEventListener("dataavailable", function (event) {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });

  recorder.addEventListener("stop", function () {
    stream.getTracks().forEach(function (track) {
      track.stop();
    });
    sendRecording(recorder.mimeType);
  });

  recorder.start();
  recordButton.textContent = "Stop";
  recordButton.classList.add("recording");
  setStatus("Listening... press Stop when you finish.", false);
  stopTimer = setTimeout(stopRecording, 30000);
}

function stopRecording() {
  clearTimeout(stopTimer);
  if (recorder && recorder.state === "recording") {
    recorder.stop();
  }
  recordButton.textContent = "Record";
  recordButton.classList.remove("recording");
}

async function sendRecording(mimeType) {
  const type = mimeType || "audio/webm";
  const extension = type.split("/")[1].split(";")[0];
  const blob = new Blob(recordedChunks, { type: type });
  const formData = new FormData();
  formData.append("audio", blob, "voice." + extension);

  recordButton.disabled = true;
  setStatus("Listening to your recording...", false);
  try {
    const response = await fetch("/api/transcribe", { method: "POST", body: formData });
    const servedBy = response.headers.get("X-Served-By");
    if (servedBy) {
      serverName.textContent = servedBy;
    }
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Something went wrong.", true);
    } else {
      entryText.value = data.text;
      parseButton.click();
    }
  } catch (error) {
    setStatus("Could not reach the server. You can type your entry instead.", true);
  }
  recordButton.disabled = false;
}

recordButton.addEventListener("click", function () {
  if (recorder && recorder.state === "recording") {
    stopRecording();
  } else {
    startRecording();
  }
});



loadData();
showScreen();
renderAll();
showServerName();