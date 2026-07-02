import { fieldsSchema } from './data/allAchievement.js';
import { allWebsitesDefault } from './data/allWebsite.js';
import { allAchievementsDefault } from './data/gameData.js';
import { KNOWN_FLAGS } from './data/knowFlags.js';
/*
console.log(fieldsSchema);
console.log(allWebsitesDefault);
console.log(allAchievementsDefault);
console.log(KNOWN_FLAGS);
*/
// Global App State
// Global App State
let fullJsonData = null;
let currentSlotData = null;
let currentSlotRoot = null;
let confirmActionCallback = null;
let loadedFileName = "";
let activeTabId = "anon";
let activeSlotCategory = "normal";

const SLOTS_LIMIT = 63;
const AUTO_BASE = ((SLOTS_LIMIT / 10 | 0) + 1) * 10; // Hitungan base otomatis 70

function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function minutesToDHM(value) {
    let val = parseInt(value) || 0;
    let days = Math.floor(val / (24 * 60));
    val %= (24 * 60);
    let hours = Math.floor(val / 60);
    let minutes = val % 60;
    return { days, hours, minutes };
}

function formatInGameTime(totalMinutes) {
    let t = minutesToDHM(totalMinutes);
    return `${t.days}d ${t.hours}h ${t.minutes}m`;
}

// Loader File JSON utama
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    loadedFileName = file.name;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            fullJsonData = JSON.parse(evt.target.result);
            const statusLbl = document.getElementById('fileStatus');
            statusLbl.innerText = `Loaded: ${loadedFileName}`;
            statusLbl.style.color = "var(--text-green)";
            document.getElementById('saveBtn').disabled = false;
            
            // Tampilkan opsi Sub-Tab Slot jika file sukses di-load
            document.getElementById('slotSubTabsArea').style.display = "flex";
            generateSlotButtons();
        } catch (err) {
            const statusLbl = document.getElementById('fileStatus');
            statusLbl.innerText = "FAILED (Invalid JSON file)";
            statusLbl.style.color = "var(--text-red)";
        }
    };
    reader.readAsText(file);
});

// Mengganti kategori sub-tab slot (Normal vs Auto)
function changeSlotCategory(category) {
    activeSlotCategory = category;
    document.getElementById('slotTabNormal').classList.remove('active');
    document.getElementById('slotTabAuto').classList.remove('active');
    
    if(category === 'normal') {
        document.getElementById('slotTabNormal').classList.add('active');
    } else {
        document.getElementById('slotTabAuto').classList.add('active');
    }
    
    generateSlotButtons();
}

// Generator List Slot dengan Filter Kategori (Normal / Auto)
function generateSlotButtons() {
    const container = document.getElementById('slotSelector');
    container.innerHTML = "";
    
    let saves = fullJsonData.saves || [];
    let autoSaves = fullJsonData.autoSaves || [];

    let combined = [];
    saves.forEach(s => combined.push({ raw: s, isAuto: false }));
    autoSaves.forEach(s => combined.push({ raw: s, isAuto: true }));
    
    // Urutkan simpanan dari waktu terbaru (_time desc) seperti script python
    combined.sort((a, b) => b.raw._time - a.raw._time);

    // Filter daftar berdasarkan sub-tab yang sedang aktif dipilih user
    let filtered = combined.filter(item => {
        if(activeSlotCategory === 'normal') return !item.isAuto;
        if(activeSlotCategory === 'auto') return item.isAuto;
        return true;
    });

    if(filtered.length === 0) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem; padding: 10px;'>No slots found here.</p>";
        return;
    }

    filtered.forEach((item, index) => {
        const save = item.raw;
        const finalSlotId = item.isAuto ? save.slot + AUTO_BASE : save.slot; //
        
        const btn = document.createElement('button');
        btn.className = "slot-select-btn";
        btn.innerText = item.isAuto ? `Auto ${finalSlotId}` : `Slot ${finalSlotId}`;
        btn.onclick = () => selectActiveSlot(finalSlotId, save, btn);
        container.appendChild(btn);
        
        // Auto-click pemicu slot teratas agar langsung ter-render
        if(index === 0) btn.click();
    });
}

function selectActiveSlot(slotId, saveRawData, element) {
    document.querySelectorAll('.slot-select-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
    
    currentSlotRaw = saveRawData;

    if (typeof saveRawData.savedata === 'string') { //
        try { saveRawData.savedata = JSON.parse(saveRawData.savedata); } catch(e){}
    }
    currentSlotData = saveRawData.savedata;
    if(!currentSlotData.flags) currentSlotData.flags = []; //

    updateDashboardOverview();
    document.getElementById('emptyStateMsg').style.display = "none";
    document.getElementById('fieldsContainer').style.display = "grid";
    renderWorkspaceFields();
}

function updateDashboardOverview() {
    document.getElementById('overviewMoney').innerText = currentSlotData.money !== undefined ? `$${currentSlotData.money}` : '-';
    document.getElementById('overviewFollowers').innerText = currentSlotData.followers !== undefined ? currentSlotData.followers : '-';
    document.getElementById('overviewSubscribers').innerText = currentSlotData.subs !== undefined ? currentSlotData.subs : '-';
    document.getElementById('overviewPlayTime').innerText = currentSlotData.time !== undefined ? formatInGameTime(currentSlotData.time) : '-';
    document.getElementById('overviewFlags').innerText = currentSlotData.flags ? currentSlotData.flags.length : '0';
}

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
    activeTabId = tabId;
    if (currentSlotData) renderWorkspaceFields();
}

// --- MAIN ENGINE FIELD WORKSPACE & SCROLL CONTROLLER ---
function renderWorkspaceFields() {
    const container = document.getElementById('fieldsContainer');
    container.innerHTML = "";
    document.getElementById('searchField').value = "";

    // Logika Kondisional: Tambahkan scrollbar internal hanya untuk tab-tab data panjang
    if (activeTabId === 'flags' || activeTabId === 'raw') {
        container.classList.remove('scrollable-workspace');
    } else {
        container.classList.add('scrollable-workspace');
    }

    // CASE 1: Tab Raw JSON Editor
    if (activeTabId === 'raw') {
        const wrap = document.createElement('div');
        wrap.className = "field-row";
        wrap.style.gridColumn = "1 / -1";
        
        const txt = document.createElement('textarea');
        txt.className = "raw-textarea";
        txt.value = JSON.stringify(currentSlotData, null, 2);
        txt.oninput = (e) => {
            try {
                const parsed = JSON.parse(e.target.value);
                Object.assign(currentSlotData, parsed);
                updateDashboardOverview();
            } catch(err) {}
        };
        wrap.appendChild(txt);
        container.appendChild(wrap);
        return;
    }
    
    if (activeTabId === 'websites') {
        const websitesContainer = document.createElement('div');
        websitesContainer.className = "field-row";
        websitesContainer.innerHTML = "";
        
        const activeSec = document.createElement('div');
        activeSec.className = "flag-box-section";
        activeSec.innerHTML = `<div class="flag-box-title">Visited Websites</div>`;
        const activeScroll = document.createElement('div');
        activeScroll.className = "flag-list-scroll";
        
        websitesContainer.appendChild(activeSec);
        activeSec.appendChild(activeScroll);
        
        // Pengecekan: Pastikan visitedWebsites ada dan berbentuk Array, jika tidak buat array kosong
        const visitedWebsites = (fullJsonData && Array.isArray(fullJsonData.visitedWebsites)) ? fullJsonData.visitedWebsites : [];
        
        const allWebsites = Array.from(new Set([...allWebsitesDefault, ...visitedWebsites]));
        allWebsites.forEach(site => {
            const label = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = site;
            
            // Centang otomatis jika website ini ada di dalam daftar visitedWebsites
            cb.checked = visitedWebsites.includes(site);
            cb.onchange = (e) => {
                if (e.target.checked) {
                    // Jika dicentang, masukkan ke array global jika belum ada
                    if (!fullJsonData.visitedWebsites.includes(site)) {
                        fullJsonData.visitedWebsites.push(site);
                    }
                } else {
                    // Jika centang dilepas, hapus item tersebut dari array global
                    fullJsonData.visitedWebsites = fullJsonData.visitedWebsites.filter(item => item !== site);
                }
            };
            
            label.appendChild(cb);
            label.appendChild(document.createTextNode(` ${site}`));
            activeScroll.appendChild(label);
        });
        
        container.appendChild(websitesContainer);
        return;
    }

    if (activeTabId === 'achievement') {
        const achievementsContainer = document.createElement('div');
        achievementsContainer.className = "field-row";
        achievementsContainer.innerHTML = "";

        const activeSec = document.createElement('div');
        activeSec.className = "flag-box-section";
        activeSec.innerHTML = `<div class="flag-box-title">Achievements List</div>`;
        const activeScroll = document.createElement('div');
        activeScroll.className = "flag-list-scroll";

        achievementsContainer.appendChild(activeSec);
        activeSec.appendChild(activeScroll);

        // Pastikan objek pengaman di dalam slot aktif sudah terdefinisi
        if (!fullJsonData.achievements) fullJsonData.achievements = { values: [] };
        if (!fullJsonData.achievements.values) fullJsonData.achievements.values = [];

        // Ambil referensi langsung ke array data achievement global milik fullJsonData
        const unlockedAchievements = fullJsonData.achievements.values

        // 2. Gabungkan daftar default dengan yang sudah di-unlock (Pastikan allAchievementsDefault sudah kamu deklarasikan di atas ya!)
        const allAchievements = Array.from(new Set([...allAchievementsDefault, ...unlockedAchievements]));

        allAchievements.forEach(ach => {
            const label = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = ach;
            cb.checked = unlockedAchievements.includes(ach); // Otomatis centang jika ada di data save
    
            // 3. PERBAIKAN LOGIKA SAVE ONCHANGE (Real-time Sync):
            cb.onchange = (e) => {
                if (e.target.checked) {
                    // Jika dicentang, masukkan ke array global jika belum ada
                    if (!fullJsonData.achievements.values.includes(ach)) {
                        fullJsonData.achievements.values.push(ach);
                    }
                } else {
                    // Jika centang dilepas, hapus item tersebut dari array global
                    fullJsonData.achievements.values = fullJsonData.achievements.values.filter(item => item !== ach);
                }
            };
    
            label.appendChild(cb);
            label.appendChild(document.createTextNode(` ${ach}`));
            activeScroll.appendChild(label);
        });

        container.appendChild(achievementsContainer);
        return;
    }

    // CASE 2: Tab Flags Editor (Mempunyai layout scroll internal sendiri)
    if (activeTabId === 'flags') {
        renderFlagsInterface(container);
        return;
    }

            // CASE 3: Standard Metadata Tabs (anon, bot, sex, events)
    const schema = fieldsSchema[activeTabId] || [];
    schema.forEach(field => {
        
        // --- LOGIKA BARU: MENENTUKAN JALUR TARGET VARIABEL ---
        let targetData = currentSlotData; // Default: mencari di dalam savedata
        
        if (targetData[field.key] === undefined) return;
        // --- AKHIR LOGIKA BARU ---

        const card = document.createElement('div');
        card.className = "field-row";
        card.setAttribute('data-key', field.key.toLowerCase());
        card.setAttribute('data-label', field.label.toLowerCase());

        if (field.type === 'boolean') {
            card.classList.add('field-row-checkbox');
            const lbl = document.createElement('span');
            lbl.className = "field-label";
            lbl.innerText = field.label;
            card.appendChild(lbl);

            const chk = document.createElement('input');
            chk.type = "checkbox";
            chk.className = "field-checkbox";
            chk.checked = Boolean(targetData[field.key]); // Gunakan targetData
            chk.onchange = (e) => { targetData[field.key] = e.target.checked; };
            card.appendChild(chk);
        } 
        else if (field.type === 'time') {
            const lbl = document.createElement('label');
            lbl.className = "field-label";
            lbl.innerText = field.label;
            card.appendChild(lbl);

            const inlineRow = document.createElement('div');
            inlineRow.className = "time-inputs-inline";
            const tObj = minutesToDHM(targetData[field.key]); // Gunakan targetData

            const dIn = createSubTimeInput(tObj.days, 'd', (newDays) => { tObj.days = newDays; updateTimeKey(field.key, tObj); });
            const hIn = createSubTimeInput(tObj.hours, 'h', (newHours) => { tObj.hours = newHours; updateTimeKey(field.key, tObj); });
            const mIn = createSubTimeInput(tObj.minutes, 'm', (newMins) => { tObj.minutes = newMins; updateTimeKey(field.key, tObj); });

            inlineRow.append(dIn.val, dIn.lbl, hIn.val, hIn.lbl, mIn.val, mIn.lbl);
            card.appendChild(inlineRow);
        }
        else {
            const lbl = document.createElement('label');
            lbl.className = "field-label";
            lbl.innerText = field.label;
            card.appendChild(lbl);

            const inp = document.createElement('input');
            inp.className = "field-input";
            inp.type = field.type === 'number' ? 'number' : 'text';
            inp.value = targetData[field.key]; // Gunakan targetData
            inp.oninput = (e) => {
                targetData[field.key] = field.type === 'number' ? Number(e.target.value) : e.target.value;
                if(['money','subs','followers'].includes(field.key)) updateDashboardOverview();
            };
            card.appendChild(inp);
        }
        container.appendChild(card);
    });
}

function createSubTimeInput(initialValue, unitLabel, onUpdate) {
    const val = document.createElement('input');
    val.type = "number";
    val.className = "time-sub-input";
    val.value = initialValue;
    val.oninput = (e) => onUpdate(parseInt(e.target.value) || 0);

    const lbl = document.createElement('span');
    lbl.className = "time-label-inline";
    lbl.innerText = unitLabel;
    return { val, lbl };
}

function updateTimeKey(key, tObj) {
    const totalMinutes = (tObj.days * 24 + tObj.hours) * 60 + tObj.minutes; //
    currentSlotData[key] = totalMinutes;
    if(key === 'time') updateDashboardOverview();
}

// --- INTERFACE MANAGER FLAG GAME ---
function renderFlagsInterface(container) {
    const wrap = document.createElement('div');
    wrap.className = "field-row";
    wrap.style.gridColumn = "1 / -1";

    const customWrapper = document.createElement('div');
    customWrapper.className = "custom-flag-wrapper";
    const customInp = document.createElement('input');
    customInp.className = "field-input";
    customInp.placeholder = "Add new custom flag name...";
    
    const addBtn = document.createElement('button');
    addBtn.className = "btn-primary";
    addBtn.style.padding = "4px 14px";
    addBtn.innerText = "✚";
    addBtn.onclick = () => {
        const flagName = customInp.value.trim();
        if(!flagName) return;
        const curTime = currentSlotData.time || 0;
        if(!currentSlotData.flags.some(f => f.name === flagName)) {
            currentSlotData.flags.push({ name: flagName, timeAdded: curTime });
            updateDashboardOverview();
            renderWorkspaceFields();
        }
        customInp.value = "";
    };
    customWrapper.append(customInp, addBtn);
    wrap.appendChild(customWrapper);

    // Active Flags Section
    const activeSec = document.createElement('div');
    activeSec.className = "flag-box-section";
    activeSec.innerHTML = `<div class="flag-box-title">Flags in Save File (${currentSlotData.flags.length})</div>`;
    const activeScroll = document.createElement('div');
    activeScroll.className = "flag-list-scroll";
    
    const sortedActive = [...currentSlotData.flags].sort((a,b) => b.timeAdded - a.timeAdded); //
    sortedActive.forEach(flag => {
        const row = document.createElement('div');
        row.className = "flag-item-row";
        row.setAttribute('data-flagkey', flag.name.toLowerCase());

        const nameSpan = document.createElement('span');
        nameSpan.innerText = flag.name;
        nameSpan.style.wordBreak = "break-all";

        const delBtn = document.createElement('button');
        delBtn.className = "flag-btn-action";
        delBtn.style.color = "var(--text-red)";
        delBtn.innerText = "✕";
        delBtn.onclick = () => {
            triggerConfirmation(`Hapus flag "${flag.name}" dari save file?`, () => {
                currentSlotData.flags = currentSlotData.flags.filter(f => f.name !== flag.name);
                updateDashboardOverview();
                renderWorkspaceFields();
            });
        };
        row.append(nameSpan, delBtn);
        activeScroll.appendChild(row);
    });
    activeSec.appendChild(activeScroll);
    wrap.appendChild(activeSec);

    // Available Known Flags Section
    const unassignedFlags = KNOWN_FLAGS.filter(fName => !currentSlotData.flags.some(f => f.name === fName)).sort();
    const availSec = document.createElement('div');
    availSec.className = "flag-box-section";
    availSec.innerHTML = `<div class="flag-box-title">Available Known Flags (${unassignedFlags.length})</div>`;
    const availScroll = document.createElement('div');
    availScroll.className = "flag-list-scroll"; //
    unassignedFlags.forEach(fName => {
        const row = document.createElement('div');
        row.className = "flag-item-row";
        row.setAttribute('data-flagkey', fName.toLowerCase());

        const nameSpan = document.createElement('span');
        nameSpan.innerText = fName;

        const addIconBtn = document.createElement('button');
        addIconBtn.className = "flag-btn-action";
        addIconBtn.style.color = "var(--text-green)";
        addIconBtn.innerText = "✚";
        addIconBtn.onclick = () => {
            const curTime = currentSlotData.time || 0;
            currentSlotData.flags.push({ name: fName, timeAdded: curTime });
            updateDashboardOverview();
            renderWorkspaceFields();
        };
        row.append(nameSpan, addIconBtn);
        availScroll.appendChild(row);
    });
    availSec.appendChild(availScroll);
    wrap.appendChild(availSec);

    container.appendChild(wrap);
}

// --- SEARCH FITUR ---
function filterFields() {
    const query = document.getElementById('searchField').value.toLowerCase().trim();
    if (activeTabId === 'flags') {
        document.querySelectorAll('.flag-item-row').forEach(row => {
            const fKey = row.getAttribute('data-flagkey') || "";
            row.style.setProperty('display', fKey.includes(query) ? 'flex' : 'none', 'important');
        });
        return;
    }
    document.querySelectorAll('.field-row').forEach(row => {
        const k = row.getAttribute('data-key') || "";
        const l = row.getAttribute('data-label') || "";
        row.style.display = (k.includes(query) || l.includes(query)) ? "flex" : "none";
    });
}

// Export Handler
function exportJsonFile() {
    if (!fullJsonData) return;
    const outputData = JSON.parse(JSON.stringify(fullJsonData));
    if(outputData.saves) {
        outputData.saves.forEach(s => { if(typeof s.savedata === 'object') s.savedata = JSON.stringify(s.savedata); });
    }
    if(outputData.autoSaves) {
        outputData.autoSaves.forEach(s => { if(typeof s.savedata === 'object') s.savedata = JSON.stringify(s.savedata); });
    }
    const dataBlob = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(outputData, null, "\t"));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataBlob);
    downloadAnchor.setAttribute("download", loadedFileName || "save_modified.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function triggerConfirmation(message, onConfirmAction, noText, yesText) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmMsg').innerText = message ?? "UI Confirm Text";
    document.getElementById('confirmYesBtn').innerText = yesText ?? "Yes";
    document.getElementById('confirmNoBtn').innerText = noText ?? "No";
    overlay.style.display = 'flex';
    confirmActionCallback = onConfirmAction;
}

// Listener Tombol Batal
document.getElementById('confirmNoBtn').addEventListener('click', () => {
    document.getElementById('confirmOverlay').style.display = 'none';
    confirmActionCallback = null;
});

// Listener Tombol Konfirmasi Ya
document.getElementById('confirmYesBtn').addEventListener('click', () => {
    document.getElementById('confirmOverlay').style.display = 'none';
    if (typeof confirmActionCallback === 'function') {
        confirmActionCallback();
    }
    confirmActionCallback = null;
});