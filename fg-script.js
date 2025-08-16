// Get selected valve from localStorage
const selectedValve = localStorage.getItem("selectedValve") || "Gate_Valve"; // default if none selected
document.getElementById("selectedValveTitle").textContent = `Valve: ${selectedValve}`;

// Optional: clear selection after reading
// localStorage.removeItem("selectedValve");

// Google Sheet URL
const SHEET_ID   = "1jvStP_Hoz-3Xu5t0Il1OjUoxkU9GZjDbjzMsRnL31gU";
const SHEET_NAME = selectedValve + "_MasterData"; // e.g., Gate_Valve_MasterData
const SHEET_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

// Fields
const FIELDS = [
  {key:"Valve",                 code:"Valve Code"},
  {key:"Valve Type",            code:"Valve Type Code"},
  {key:"Size",                  code:"Size Code"},
  {key:"Class",                 code:"Class Code"},
  {key:"End Connection",        code:"End Connection Code"},
  {key:"End Detail",            code:"End Detail Code"},
  {key:"Shell/Bolting",         code:"Shell/Bolting Code"},
  {key:"Trim",                  code:"Trim Code"},
  {key:"Gasket and Packing",    code:"Gasket and Packing Code"},
  {key:"Operation",             code:"Operation Code"},
  {key:"Special Testing",       code:"Special Testing Code"},
];

let MASTER_ROWS = [];
let selections  = {};

const byId = (id)=>document.getElementById(id);
const uniq = arr => Array.from(new Set(arr));
const clean = v => (v==null? "": String(v).trim());

async function loadSheet() {
  try {
    const res  = await fetch(SHEET_URL, {cache:"no-cache"});
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length-2));
    const cols = json.table.cols.map(c => c.label?.trim());
    const rows = json.table.rows
      .map(r => r.c.map(c => c?.v))
      .filter(r => r.some(v => v!=null && String(v).trim()!==""));
    MASTER_ROWS = rows.map(r => {
      const obj = {};
      cols.forEach((name, idx) => { if(name) obj[name] = clean(r[idx]); });
      return obj;
    });
    buildUI();
    refreshAllOptions();
  } catch (err) {
    byId("globalError").style.display="block";
    byId("globalError").textContent = "Failed to load Google Sheet. Check SHEET_ID / tab name / sharing permissions.";
  }
}

// Build the dropdown UI
function buildUI(){
  const host = byId("fields");
  host.innerHTML = "";
  selections = {};
  FIELDS.forEach((f, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.dataset.index = idx;

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = f.key;

    const combo = document.createElement("div");
    combo.className = "combo";

    const btn = document.createElement("button");
    btn.type="button";
    btn.className = "combo-btn";
    btn.innerHTML = `<span class="val placeholder">Select ${f.key}…</span><span>▾</span>`;
    btn.addEventListener("click", () => togglePanel(combo, true));

    const panel = document.createElement("div");
    panel.className = "combo-panel";
    panel.innerHTML = `
      <div class="panel-head">
        <input type="text" class="search" placeholder="Search ${f.key}…">
      </div>
      <div class="options"></div>
    `;

    combo.appendChild(btn);
    combo.appendChild(panel);
    wrap.appendChild(label);
    wrap.appendChild(combo);

    const tools = document.createElement("div");
    tools.className = "row-actions";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "reset-small";
    resetBtn.textContent = "Clear";
    resetBtn.addEventListener("click", () => clearFromIndex(idx));
    tools.appendChild(resetBtn);
    wrap.appendChild(tools);

    host.appendChild(wrap);

    const search = panel.querySelector(".search");
    search.addEventListener("input", () => filterOptionsList(idx, search.value));
    document.addEventListener("click",(e)=>{ if(!combo.contains(e.target)) togglePanel(combo,false); });
  });

  byId("resetAll").onclick = ()=>clearFromIndex(0);
  byId("copyBtn").onclick  = copyCode;
}

// Functions for dropdowns, filtering, selections
function togglePanel(combo, open){
  combo.classList.toggle("open", open);
  if(open) combo.querySelector(".search").focus();
}

function optionsForField(fieldIndex){
  const key = FIELDS[fieldIndex].key;
  return uniq(MASTER_ROWS.map(r => r[key]).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
}

function renderOptions(fieldIndex, filterText=""){
  const wrap   = document.querySelector(`.field[data-index="${fieldIndex}"]`);
  const list   = wrap.querySelector(".options");
  const values = optionsForField(fieldIndex)
    .filter(v => v.toLowerCase().includes(filterText.toLowerCase()));
  list.innerHTML = "";
  if(values.length===0){
    const empty = document.createElement("div");
    empty.className="opt";
    empty.style.opacity=".7";
    empty.textContent = "No results";
    list.appendChild(empty);
    return;
  }
  values.forEach(v=>{
    const item = document.createElement("div");
    item.tabIndex = 0;
    item.className = "opt";
    item.textContent = v;
    item.addEventListener("click", ()=>{
      const key = FIELDS[fieldIndex].key;
      selections[key] = v;
      const btn = wrap.querySelector(".combo-btn .val");
      btn.classList.remove("placeholder");
      btn.textContent = v;
      togglePanel(wrap.querySelector(".combo"), false);
      refreshAllOptions();
    });
    list.appendChild(item);
  });
}

function filterOptionsList(fieldIndex, q){ renderOptions(fieldIndex, q); }

function clearFromIndex(startIndex){
  for(let i=startIndex;i<FIELDS.length;i++){
    const key = FIELDS[i].key;
    delete selections[key];
    const wrap = document.querySelector(`.field[data-index="${i}"]`);
    const btn  = wrap.querySelector(".combo-btn .val");
    btn.classList.add("placeholder");
    btn.textContent = `Select ${key}…`;
  }
  refreshAllOptions();
}

function refreshAllOptions(){
  FIELDS.forEach((_,i)=>renderOptions(i,""));
  updateProgress();
  makeFinalCode();
}

function updateProgress(){
  const picked = FIELDS.filter(f => selections[f.key]).length;
  byId("progress").textContent = `${picked} / ${FIELDS.length} selected`;
}

function makeFinalCode(){
  const errBox = byId("globalError");
  errBox.style.display = "none";
  errBox.textContent = "";

  const codeEl = byId("finalCode");
  const infoEl = byId("codeInfo");
  const copyBtn = byId("copyBtn");

  const parts = FIELDS.map(f => {
    if(!selections[f.key]) return "";
    const row = MASTER_ROWS.find(r => r[f.key] === selections[f.key]);
    return row ? clean(row[f.code]) : "";
  });
  const finalCode = parts.join("");
  codeEl.textContent = finalCode || "—";

  if(finalCode.length){
    const lengthOk = finalCode.length === 18;
    infoEl.innerHTML = lengthOk
      ? `<span class="status-ok">Length = ${finalCode.length} (OK)</span>`
      : `<span class="status-bad">Length = ${finalCode.length} (expected 18)</span>`;
    copyBtn.disabled = false;
  } else {
    infoEl.innerHTML = `<span class="status-bad">Length = 0 (no code)</span>`;
    copyBtn.disabled = true;
  }
}

async function copyCode(){
  const txt = byId("finalCode").textContent.trim();
  if(!txt) return;
  try{
    await navigator.clipboard.writeText(txt);
    byId("codeInfo").innerHTML += ` <span class="status-ok">(Copied!)</span>`;
  }catch(e){
    byId("codeInfo").innerHTML += ` <span class="status-bad">(Copy failed)</span>`;
  }
}

// Load sheet on page load
loadSheet();
