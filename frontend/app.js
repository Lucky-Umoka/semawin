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

loadData();
showScreen();
showServerName();