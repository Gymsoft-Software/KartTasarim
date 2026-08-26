const $ = (id) => document.getElementById(id);
let selectedDevice = null;
let verifiedDevices = {};
let currentJob = null;
let pollTimer = null;
let liveStatusTimer = null;
let liveStatusBusy = false;
let lastScanDevices = [];
const liveHistory = { temp: [], cpu: [] };
const HISTORY_MAX = 60;

function setStatus(el, text, type = "neutral") {
    el.textContent = text;
    el.className = `status ${type}`;
}

const API_BASE = String(window.GYMSOFT_AGENT_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
function apiUrl(url) {
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}
const AUTH_TOKEN_KEY = "gymsoft.manager.auth.token";
function getAuthToken(){ return sessionStorage.getItem(AUTH_TOKEN_KEY) || ""; }
function setAuthToken(token){ if(token) sessionStorage.setItem(AUTH_TOKEN_KEY, token); else sessionStorage.removeItem(AUTH_TOKEN_KEY); }
async function api(url, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getAuthToken();
    if (token && !/^https?:\/\//i.test(url)) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(apiUrl(url), { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : { ok: response.ok, error: await response.text() };
    if (response.status === 401 && data?.auth_required) {
        setAuthToken("");
        if (typeof showAuthGate === "function") showAuthGate({setup:false, message:"Oturum süresi doldu. Tekrar giriş yapın."});
    }
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
}

function renderDevices(devices) {
    const body = $("deviceRows");
    const query = ($("deviceFilter")?.value || "").trim().toLowerCase();
    const filtered = devices.filter(device => {
        const verified = verifiedDevices[device.ip];
        const haystack = [device.ip, device.status, verified?.model, verified?.hostname].filter(Boolean).join(" ").toLowerCase();
        return !query || haystack.includes(query);
    });

    if ($("scanSummary")) {
        const sshCount = devices.filter(d => d.ssh).length;
        const raspberryCount = devices.filter(d => verifiedDevices[d.ip]?.is_raspberry).length;
        $("scanSummary").textContent = `${devices.length} cihaz bulundu · ${sshCount} SSH açık · ${raspberryCount} Raspberry doğrulandı${query ? ` · ${filtered.length} eşleşme` : ""}`;
    }

    if (!filtered.length) {
        body.innerHTML = `<tr><td colspan="6" class="empty">${devices.length ? "Filtreye uyan cihaz yok." : "Açık SSH/HTTP portu bulunan cihaz bulunamadı."}</td></tr>`;
        return;
    }

    body.innerHTML = filtered.map(device => {
        const verified = verifiedDevices[device.ip];
        const checked = selectedDevice === device.ip ? "checked" : "";
        const model = verified?.model || "Doğrulanmadı";
        const modelClass = verified?.is_raspberry ? "model-good" : "model-warn";
        return `<tr>
            <td><input type="radio" name="device" value="${device.ip}" ${checked}></td>
            <td><strong>${escapeHtml(device.ip)}</strong></td>
            <td class="${device.ssh ? "port-ok" : "port-off"}">${device.ssh ? "Açık" : "Kapalı"}</td>
            <td class="${device.http ? "port-ok" : "port-off"}">${device.http ? "Açık" : "Kapalı"}</td>
            <td>${escapeHtml(device.status)}</td>
            <td class="${modelClass}">${escapeHtml(model)}</td>
        </tr>`;
    }).join("");

    body.querySelectorAll('input[name="device"]').forEach(radio => {
        radio.addEventListener("change", () => {
            selectedDevice = radio.value;
            $("selectedIp").value = selectedDevice;
            const info = verifiedDevices[selectedDevice];
            if (info) showDeviceInfo(info);
            else $("deviceInfo").innerHTML = "Cihaz bilgisi henüz alınmadı.";
            $("dashDeviceName").textContent = selectedDevice;
            $("dashDeviceMeta").textContent = "SSH doğrulaması bekleniyor.";
            resetLiveStatus();
            if (window.GYMSOFT_DEMO_MODE) {
                const demoItem = demoInventory.find(x => x.ip === selectedDevice);
                if (demoItem) {
                    verifiedDevices[selectedDevice] = { is_raspberry: demoItem.status !== "offline", model: demoItem.model, hostname:`GYM-TURNIKE-${selectedDevice.split('.').pop()}`, os:"Raspberry Pi OS", arch:demoItem.model.includes("5")?"aarch64":"armv7l" };
                    if (verifiedDevices[selectedDevice].is_raspberry) showDeviceInfo(verifiedDevices[selectedDevice]);
                    renderDemoAlarms(); renderDemoActivity();
                }
            } else {
                refreshRealActivity(); resetReleaseStatus();
            }
            scheduleLiveStatus(250);
        });
    });
}
function showDeviceInfo(info) {
    $("deviceInfo").classList.remove("muted");
    $("deviceInfo").innerHTML = `
        <strong>${info.is_raspberry ? "✓ Raspberry Pi doğrulandı" : "⚠ Raspberry Pi doğrulanamadı"}</strong><br>
        Model: ${escapeHtml(info.model || "-")}<br>
        Hostname: ${escapeHtml(info.hostname || "-")}<br>
        İşletim Sistemi: ${escapeHtml(info.os || "-")}<br>
        Mimari: ${escapeHtml(info.arch || "-")}`;
    if (info.is_raspberry) {
        $("dashDeviceName").textContent = info.hostname ? `${info.hostname} · ${selectedDevice}` : selectedDevice;
        $("dashDeviceMeta").textContent = `${info.model || "Raspberry Pi"} · ${info.os || "OS bilinmiyor"} · ${info.arch || "-"}`;
    }
    if (lastScanDevices.length) renderDevices(lastScanDevices);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}


function setLiveConnection(text, online = false) {
    $("liveConnection").textContent = text;
    $("liveDot").className = `live-dot ${online ? "online" : "offline"}`;
}

function resetLiveStatus() {
    $("liveDevice").textContent = selectedDevice || "Cihaz seçilmedi";
    setLiveConnection("Bekliyor", false);
    $("liveTemp").textContent = "-- °C";
    $("liveCpu").textContent = "--%";
    $("liveRam").textContent = "--%";
    $("liveDisk").textContent = "--%";
    $("liveThrottle").textContent = "--";
    $("liveNetwork").textContent = "--";
    $("liveTurnstile").textContent = "--";
    if ($("dashTemp")) $("dashTemp").textContent = "-- °C";
    if ($("dashCpu")) $("dashCpu").textContent = "--%";
    if ($("dashRam")) $("dashRam").textContent = "--%";
    if ($("dashDisk")) $("dashDisk").textContent = "--%";
    if ($("dashApache")) $("dashApache").textContent = "--";
    if ($("dashGc3")) $("dashGc3").textContent = "--";
    if ($("dashHealthScore")) $("dashHealthScore").textContent = "--/100";
    if ($("dashHealthReasons")) $("dashHealthReasons").textContent = "canlı değerlendirme";
    if ($("dashHealthBadge")) { $("dashHealthBadge").textContent = "BEKLİYOR"; $("dashHealthBadge").className = "dashboard-health"; }
}

function formatUptime(seconds) {
    const mins = Math.floor(Number(seconds || 0) / 60);
    if (mins < 60) return `${mins} dk`;
    const hours = Math.floor(mins / 60);
    return `${hours}s ${mins % 60}dk`;
}


function pushHistory(series, value) {
    if (!Number.isFinite(value)) return;
    series.push(value);
    while (series.length > HISTORY_MAX) series.shift();
}

function drawSparkline(canvasId, values, { min = null, max = null } = {}) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.round(rect.width || 700));
    const height = Math.max(80, Math.round(rect.height || 120));
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const css = getComputedStyle(document.documentElement);
    const border = css.getPropertyValue("--border").trim() || "#2b3039";
    const accent = css.getPropertyValue("--yellow").trim() || "#f2c318";
    const muted = css.getPropertyValue("--muted").trim() || "#969eaa";

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    if (values.length < 2) {
        ctx.fillStyle = muted; ctx.font = "11px sans-serif"; ctx.fillText("Canlı veri bekleniyor…", 8, 20); return;
    }
    let lo = min ?? Math.min(...values);
    let hi = max ?? Math.max(...values);
    if (hi <= lo) hi = lo + 1;
    const pad = 6;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((value, index) => {
        const x = pad + (index / (HISTORY_MAX - 1)) * (width - pad * 2);
        const y = height - pad - ((value - lo) / (hi - lo)) * (height - pad * 2);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function updateDashboard(status) {
    const temp = status.temperature === null ? null : Number(status.temperature);
    const cpu = Number(status.cpu_percent);
    const ram = Number(status.ram_percent);
    const disk = Number(status.disk_percent);
    $("dashTemp").textContent = temp === null ? "-- °C" : `${temp.toFixed(1)} °C`;
    $("dashCpu").textContent = `${cpu.toFixed(1)}%`;
    $("dashRam").textContent = `${ram.toFixed(1)}%`;
    $("dashDisk").textContent = `${disk.toFixed(1)}%`;
    $("dashApache").textContent = status.apache_active ? "AKTİF" : "KAPALI";
    $("dashGc3").textContent = status.gc3_ready ? (status.gc3_running ? "GEÇİŞTE" : "HAZIR") : "DOSYA YOK";
    if ($("dashHealthScore")) $("dashHealthScore").textContent = `${Number(status.health_score ?? 0).toFixed(0)}/100`;
    if ($("dashHealthReasons")) $("dashHealthReasons").textContent = (status.health_reasons || []).slice(0,2).join(" · ") || "Sorun tespit edilmedi";
    $("dashDeviceName").textContent = `${status.hostname || "Raspberry"} · ${selectedDevice}`;
    $("dashTempNote").textContent = status.throttled && status.throttled !== "throttled=0x0" && status.throttled !== "0x0" ? status.throttled : "normal çalışma";

    const throttleBad = status.throttled && !String(status.throttled).endsWith("0x0");
    const bad = !status.apache_active || !status.network_active || (temp !== null && temp >= 80);
    const warn = throttleBad || !status.gc3_ready || (temp !== null && temp >= 70) || cpu >= 85 || disk >= 90;
    const badge = $("dashHealthBadge");
    badge.className = `dashboard-health ${bad ? "bad" : warn ? "warn" : "ok"}`;
    badge.textContent = `${bad ? "KRİTİK" : warn ? "DİKKAT" : "NORMAL"}${status.health_score !== undefined ? ` · ${Number(status.health_score).toFixed(0)}/100` : ""}`;
    setStatus($("historyState"), "Canlı", "success");

    if (temp !== null) pushHistory(liveHistory.temp, temp);
    pushHistory(liveHistory.cpu, cpu);
    drawSparkline("tempChart", liveHistory.temp, { min: 35, max: Math.max(85, ...liveHistory.temp) });
    drawSparkline("cpuChart", liveHistory.cpu, { min: 0, max: 100 });

    const topPairs = [
        ["liveTemp", temp !== null && temp >= 80 ? "metric-bad" : temp !== null && temp >= 70 ? "metric-warn" : "metric-ok"],
        ["liveCpu", cpu >= 90 ? "metric-bad" : cpu >= 80 ? "metric-warn" : "metric-ok"],
        ["liveDisk", disk >= 95 ? "metric-bad" : disk >= 85 ? "metric-warn" : "metric-ok"],
        ["liveThrottle", throttleBad ? "metric-warn" : "metric-ok"],
    ];
    topPairs.forEach(([id, cls]) => { $(id).classList.remove("metric-ok", "metric-warn", "metric-bad"); $(id).classList.add(cls); });
}

function scheduleLiveStatus(delay = 3500) {
    if (liveStatusTimer) clearTimeout(liveStatusTimer);
    liveStatusTimer = setTimeout(refreshLiveStatus, delay);
}

async function refreshLiveStatus() {
    if (window.GYMSOFT_DEMO_MODE && typeof applyDemoLiveStatus === "function") {
        applyDemoLiveStatus();
        return scheduleLiveStatus();
    }
    if (liveStatusBusy) return scheduleLiveStatus();
    if (!selectedDevice) {
        resetLiveStatus();
        renderLiveAlarms([]);
        return scheduleLiveStatus();
    }

    const username = $("sshUser").value.trim();
    const password = $("sshPassword").value;
    $("liveDevice").textContent = selectedDevice;
    if (!username || !password || !verifiedDevices[selectedDevice]?.is_raspberry) {
        setLiveConnection("SSH bekliyor", false);
        return scheduleLiveStatus();
    }

    liveStatusBusy = true;
    try {
        const data = await api("/api/live-status", {
            method: "POST",
            body: JSON.stringify({ ip: selectedDevice, username, password }),
        });
        const s = data.status;
        setLiveConnection("Aktif", true);
        $("liveDevice").textContent = `${selectedDevice}${s.hostname ? ` · ${s.hostname}` : ""}`;
        $("liveTemp").textContent = s.temperature === null ? "-- °C" : `${Number(s.temperature).toFixed(1)} °C`;
        $("liveCpu").textContent = `${Number(s.cpu_percent).toFixed(1)}%`;
        $("liveRam").textContent = `${Number(s.ram_percent).toFixed(1)}%`;
        $("liveDisk").textContent = `${Number(s.disk_percent).toFixed(1)}%`;
        $("liveThrottle").textContent = s.throttled || "-";
        $("liveNetwork").textContent = s.network_active ? `Aktif · ${formatUptime(s.uptime_seconds)}` : "Route yok";
        $("liveTurnstile").textContent = `${s.apache_active ? "Apache ✓" : "Apache ×"} · ${s.gc3_ready ? (s.gc3_running ? "gc3 geçişte" : "gc3 hazır") : "gc3 dosya yok"}`;
        updateDashboard(s);
        renderLiveAlarms(s.alarms || []);
    } catch (err) {
        setLiveConnection("Bağlantı yok", false);
        $("liveNetwork").textContent = "--";
        $("liveTurnstile").textContent = "--";
        renderLiveAlarms([], err?.message || "SSH / canlı durum bağlantısı kurulamadı.");
    } finally {
        liveStatusBusy = false;
        scheduleLiveStatus();
    }
}

$("scanBtn").addEventListener("click", async () => {
    const btn = $("scanBtn");
    btn.disabled = true;
    setStatus($("scanState"), "Taranıyor", "running");
    $("deviceRows").innerHTML = `<tr><td colspan="6" class="empty">Ağ taranıyor…</td></tr>`;
    try {
        const data = await api("/api/scan", {
            method: "POST",
            body: JSON.stringify({ cidr: $("cidr").value.trim() }),
        });
        lastScanDevices = data.devices;
        renderDevices(lastScanDevices);
        setStatus($("scanState"), `${data.devices.length} cihaz`, "success");
    } catch (err) {
        $("deviceRows").innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
        setStatus($("scanState"), "Hata", "error");
    } finally {
        btn.disabled = false;
    }
});

$("verifyBtn").addEventListener("click", async () => {
    if (!selectedDevice) return alert("Önce ağ listesinden bir cihaz seçin.");
    const btn = $("verifyBtn");
    btn.disabled = true;
    $("deviceInfo").textContent = "SSH bağlantısı kuruluyor…";
    try {
        const data = await api("/api/device-info", {
            method: "POST",
            body: JSON.stringify({
                ip: selectedDevice,
                username: $("sshUser").value.trim(),
                password: $("sshPassword").value,
            }),
        });
        verifiedDevices[selectedDevice] = data.info;
        showDeviceInfo(data.info);
        scheduleLiveStatus(0);
        refreshRealActivity();
        refreshReleaseStatus({silent:true});
    } catch (err) {
        $("deviceInfo").classList.remove("muted");
        $("deviceInfo").textContent = `Hata: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
});

$("toggleToken").addEventListener("click", () => {
    const input = $("githubToken");
    input.type = input.type === "password" ? "text" : "password";
    $("toggleToken").textContent = input.type === "password" ? "Göster" : "Gizle";
});

async function loadPiInstallerScripts(){
    const token=$("githubToken")?.value.trim()||"";
    if(!token){ showToast("Private GitHub Pi scriptlerini listelemek için token girin.","warning","Kurulum Scripti"); return; }
    const btn=$("loadInstallerScriptsBtn"); if(btn)btn.disabled=true;
    setStatus($("installerScriptState"),"Yükleniyor","running");
    try{
        const data=await api("/api/github/pi-scripts",{method:"POST",body:JSON.stringify({token})});
        const select=$("installerScriptSelect");
        select.innerHTML='<option value="">Panel v13 Entegre Kurulum Scripti (Önerilen)</option>' + (data.scripts||[]).map(s=>`<option value="${escapeHtml(s.path)}">${escapeHtml(s.name)}</option>`).join("");
        setStatus($("installerScriptState"),`${(data.scripts||[]).length} script`,"success");
        showToast(`${(data.scripts||[]).length} Pi kurulum scripti listelendi.`,"success","Private GitHub");
    }catch(err){ setStatus($("installerScriptState"),"Hata","error"); showToast(err.message,"error","Kurulum Scripti"); }
    finally{ if(btn)btn.disabled=false; }
}
$("loadInstallerScriptsBtn")?.addEventListener("click",loadPiInstallerScripts);
$("installerScriptSelect")?.addEventListener("change",()=>setStatus($("installerScriptState"),$("installerScriptSelect").value?"GitHub Script":"Entegre","success"));

$("installMode").addEventListener("change", () => {
    $("releaseArea").classList.toggle("hidden", $("installMode").value !== "github_release");
});

$("loadReleasesBtn").addEventListener("click", async () => {
    const token = $("githubToken").value.trim();
    if (!token) return alert("Önce GitHub token girin.");
    const btn = $("loadReleasesBtn");
    btn.disabled = true;
    try {
        const data = await api("/api/github/releases", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
        $("releaseSelect").innerHTML = data.releases.map(r =>
            `<option value="${escapeHtml(r.tag)}">${escapeHtml(r.tag)} — ${escapeHtml(r.name)}</option>`
        ).join("");
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
});


let lastPrecheck = { device:null, ready:false, at:0 };
function renderPrecheck(data) {
    const box=$("precheckResult"), state=$("precheckState");
    if(!box || !state) return;
    const checks=Array.isArray(data.checks)?data.checks:[];
    box.innerHTML=checks.map(c=>`<div class="precheck-item ${c.ok?'ok':c.required?'bad':'optional'}"><span class="check-icon">${c.ok?'✓':c.required?'×':'!'}</span><div><strong>${escapeHtml(c.label)}</strong><small>${escapeHtml(c.detail||'')}</small></div></div>`).join("") + `<div class="precheck-summary ${data.ready?'ready':'blocked'}">${data.ready?'✓ KURULUMA HAZIR':'✕ KURULUM ÖNERİLMİYOR · Zorunlu kontrollerde sorun var'}</div>`;
    state.className=`status ${data.ready?'success':'error'}`; state.textContent=data.ready?'HAZIR':'SORUN VAR';
}
async function runPrecheck({silent=false}={}) {
    if(window.GYMSOFT_DEMO_MODE){
        const data={ready:true,checks:[{label:'Raspberry doğrulaması',ok:true,detail:'Raspberry Pi 5 Model B',required:true},{label:'İnternet erişimi',ok:true,detail:'Dış bağlantı var',required:true},{label:'Gateway',ok:true,detail:'192.168.1.1',required:true},{label:'DNS çözümleme',ok:true,detail:'api.github.com çözümleniyor',required:true},{label:'Boş disk alanı',ok:true,detail:'18.4 GB boş',required:true},{label:'GitHub private repo',ok:true,detail:'Demo erişimi başarılı',required:true},{label:'Chromium',ok:true,detail:'Kurulu',required:false}]};
        renderPrecheck(data); lastPrecheck={device:selectedDevice||'demo',ready:true,at:Date.now()}; return true;
    }
    const target=requireTurnstileTarget();
    const btn=$("precheckBtn"); if(btn)btn.disabled=true;
    setStatus($("precheckState"),"Kontrol ediliyor","running");
    try{
        const data=await api('/api/precheck',{method:'POST',body:JSON.stringify({...target,github_token:$("githubToken")?.value.trim()||'',install_mode:$("installMode")?.value||'github_latest',installer_path:$("installerScriptSelect")?.value||''})});
        renderPrecheck(data); lastPrecheck={device:selectedDevice,ready:!!data.ready,at:Date.now()};
        if(!silent) showToast(data.ready?'Cihaz kuruluma hazır.':'Kurulum öncesi zorunlu kontrollerde sorun var.',data.ready?'success':'error','Kurulum Öncesi Kontrol');
        return !!data.ready;
    }catch(err){
        setStatus($("precheckState"),"Hata","error"); $("precheckResult").innerHTML=`<div class="info-box">${escapeHtml(err.message)}</div>`; if(!silent)showToast(err.message,'error','Ön Kontrol'); return false;
    }finally{if(btn)btn.disabled=false;}
}
$("precheckBtn")?.addEventListener('click',()=>runPrecheck());

$("installBtn").addEventListener("click", async () => {
    if (!selectedDevice) return alert("Önce kurulum yapılacak cihazı seçin.");
    if (!verifiedDevices[selectedDevice]?.is_raspberry) {
        return alert("Kurulumdan önce cihazı SSH üzerinden Raspberry Pi olarak doğrulayın.");
    }

    const mode = $("installMode").value;
    if ((mode === "github_latest" || mode === "github_release") && !$("githubToken").value.trim()) {
        return alert("GitHub kurulumu için token gerekli.");
    }
    if (mode === "github_release" && !$("releaseSelect").value) {
        return alert("Bir release seçin.");
    }

    if (!window.GYMSOFT_DEMO_MODE) {
        const ready = await runPrecheck({silent:true});
        if (!ready) { showToast("Kurulum başlatılmadı. Ön kontroldeki zorunlu sorunları çözün.","error","Kurulum Engellendi"); return; }
    }

    if (!await uiConfirm(`${selectedDevice} cihazına Gymsoft kurulumu başlatılsın mı?`)) return;

    const btn = $("installBtn");
    btn.disabled = true;
    $("logBox").textContent = "Kurulum isteği hazırlanıyor…";
    setStatus($("jobState"), "Başlatılıyor", "running");

    try {
        const data = await api("/api/install", {
            method: "POST",
            body: JSON.stringify({
                ip: selectedDevice,
                username: $("sshUser").value.trim(),
                password: $("sshPassword").value,
                token: $("githubToken").value.trim(),
                mode,
                release_tag: $("releaseSelect").value,
                installer_path: $("installerScriptSelect")?.value || "",
                reboot: $("rebootAfter").checked,
            }),
        });
        currentJob = data.job_id;
        startPolling();
    } catch (err) {
        $("logBox").textContent = `HATA: ${err.message}`;
        setStatus($("jobState"), "Hata", "error");
        btn.disabled = false;
    }
});

function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    const poll = async () => {
        if (!currentJob) return;
        try {
            const data = await api(`/api/jobs/${currentJob}`);
            const job = data.job;
            $("logBox").textContent = job.logs.join("\n") || "Kurulum bekleniyor…";
            $("logBox").scrollTop = $("logBox").scrollHeight;

            if (job.status === "success") {
                setStatus($("jobState"), "Tamamlandı", "success");
                clearInterval(pollTimer);
                $("installBtn").disabled = false;
            } else if (job.status === "error") {
                setStatus($("jobState"), "Hata", "error");
                clearInterval(pollTimer);
                $("installBtn").disabled = false;
            } else {
                setStatus($("jobState"), "Çalışıyor", "running");
            }
        } catch (err) {
            $("logBox").textContent += `\nPanel bağlantı hatası: ${err.message}`;
        }
    };
    poll();
    pollTimer = setInterval(poll, 1500);
}

function requireTurnstileTarget() {
    if (!selectedDevice) throw new Error("Önce ağ listesinden bir Raspberry Pi seçin.");
    if (!verifiedDevices[selectedDevice]?.is_raspberry) {
        throw new Error("Önce seçili cihazı Raspberry Pi olarak doğrulayın.");
    }
    const username = $("sshUser").value.trim();
    const password = $("sshPassword").value;
    if (!username || !password) throw new Error("SSH kullanıcı adı ve parola gerekli.");
    return { ip: selectedDevice, username, password };
}

function applyTurnstileConfig(config) {
    if (config.direction) $("turnDirection").value = config.direction;
    if (config.transition_seconds !== null && config.transition_seconds !== undefined) {
        $("transitionSeconds").value = Math.round(Number(config.transition_seconds));
    }
    if (config.color && /^#[0-9a-fA-F]{6}$/.test(config.color)) {
        $("turnColor").value = config.color;
        $("turnColorHex").value = config.color.toUpperCase();
        $("colorPreview").style.background = config.color;
    }
}

async function loadTurnstileConfig() {
    const btn = $("loadTurnstileConfigBtn");
    try {
        const target = requireTurnstileTarget();
        btn.disabled = true;
        setStatus($("turnstileState"), "Okunuyor", "running");
        const data = await api("/api/turnstile/config", {
            method: "POST",
            body: JSON.stringify(target),
        });
        applyTurnstileConfig(data.config);
        setStatus($("turnstileState"), "Ayarlar alındı", "success");
    } catch (err) {
        setStatus($("turnstileState"), "Hata", "error");
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
}

$("loadTurnstileConfigBtn").addEventListener("click", loadTurnstileConfig);

$("turnColor").addEventListener("input", () => {
    const color = $("turnColor").value.toUpperCase();
    $("turnColorHex").value = color;
    $("colorPreview").style.background = color;
});

$("turnColorHex").addEventListener("input", () => {
    const value = $("turnColorHex").value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        $("turnColor").value = value;
        $("colorPreview").style.background = value;
    }
});

$("saveTurnstileConfigBtn").addEventListener("click", async () => {
    const btn = $("saveTurnstileConfigBtn");
    try {
        const target = requireTurnstileTarget();
        const color = $("turnColorHex").value.trim();
        const seconds = Number.parseInt($("transitionSeconds").value, 10);
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Renk #RRGGBB biçiminde olmalıdır.");
        if (!Number.isInteger(seconds) || seconds < 1 || seconds > 60) {
            throw new Error("Geçiş süresi 1 ile 60 saniye arasında olmalıdır.");
        }
        if (!await uiConfirm(`${selectedDevice} cihazındaki turnike ayarları değiştirilsin mi?`)) return;

        btn.disabled = true;
        setStatus($("turnstileState"), "Kaydediliyor", "running");
        const data = await api("/api/turnstile/config/update", {
            method: "POST",
            body: JSON.stringify({
                ...target,
                direction: $("turnDirection").value,
                transition_seconds: seconds,
                color,
            }),
        });
        applyTurnstileConfig(data.config);
        setStatus($("turnstileState"), "Kaydedildi", "success");
        $("turnstileActionResult").classList.remove("muted");
        $("turnstileActionResult").textContent = "Ayarlar kaydedildi. Yeni yön/süre bir sonraki geçişte; renk sayfa yenilendiğinde uygulanır.";
    } catch (err) {
        setStatus($("turnstileState"), "Hata", "error");
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
});

async function sendTurnstileAction(action) {
    const button = action === "open" ? $("openTurnstileBtn") : $("lockTurnstileBtn");
    try {
        const target = requireTurnstileTarget();
        const message = action === "open"
            ? `${selectedDevice} için bir geçiş izni verilsin mi?`
            : `${selectedDevice} üzerindeki aktif geçiş sonlandırılıp turnike kilitlensin mi?`;
        if (!await uiConfirm(message)) return;

        button.disabled = true;
        $("turnstileActionResult").classList.remove("muted");
        $("turnstileActionResult").textContent = "Komut Raspberry Pi'ye gönderiliyor…";
        const data = await api("/api/turnstile/action", {
            method: "POST",
            body: JSON.stringify({ ...target, action }),
        });
        $("turnstileActionResult").textContent = data.message || "Komut tamamlandı.";
    } catch (err) {
        $("turnstileActionResult").classList.remove("muted");
        $("turnstileActionResult").textContent = `Hata: ${err.message}`;
    } finally {
        button.disabled = false;
    }
}

$("openTurnstileBtn").addEventListener("click", () => sendTurnstileAction("open"));
$("lockTurnstileBtn").addEventListener("click", () => sendTurnstileAction("lock"));

$("colorPreview").style.background = $("turnColor").value;


// -----------------------------------------------------------------------------
// Raspberry güvenlik + Turnike kurulum/lisans — MVP v4
// -----------------------------------------------------------------------------
$("changePasswordBtn").addEventListener("click", async () => {
    const btn = $("changePasswordBtn");
    try {
        const target = requireTurnstileTarget();
        const newPassword = $("newSshPassword").value;
        const confirmPassword = $("newSshPasswordConfirm").value;
        if (newPassword.length < 8) throw new Error("Yeni parola en az 8 karakter olmalıdır.");
        if (newPassword !== confirmPassword) throw new Error("Yeni parola alanları birbiriyle aynı değil.");
        if (newPassword === target.password) throw new Error("Yeni parola mevcut paroladan farklı olmalıdır.");
        if (!await uiConfirm(`${selectedDevice} üzerindeki ${target.username} kullanıcısının SSH parolası değiştirilsin mi?`)) return;

        btn.disabled = true;
        setStatus($("passwordState"), "Değiştiriliyor", "running");
        const data = await api("/api/security/change-password", {
            method: "POST",
            body: JSON.stringify({ ...target, new_password: newPassword }),
        });
        $("sshPassword").value = newPassword;
        $("newSshPassword").value = "";
        $("newSshPasswordConfirm").value = "";
        $("passwordResult").classList.remove("muted");
        $("passwordResult").textContent = `${data.message} Paneldeki SSH parola alanı yeni parola ile güncellendi.`;
        setStatus($("passwordState"), "Değiştirildi", "success");
        scheduleLiveStatus(250);
    } catch (err) {
        $("passwordResult").classList.remove("muted");
        $("passwordResult").textContent = `Hata: ${err.message}`;
        setStatus($("passwordState"), "Hata", "error");
    } finally {
        btn.disabled = false;
    }
});

function applyTurnSetup(config) {
    if (config.turn_id !== undefined) $("turnSetupId").value = config.turn_id || "";
    if (config.turn_number) $("turnSetupNumber").value = config.turn_number;
    if (config.license_key !== undefined) $("turnLicenseKey").value = config.license_key || "";
    if (config.domain !== undefined) $("turnDomain").value = config.domain || "";
    $("turnSetupResult").classList.remove("muted");
    $("turnSetupResult").innerHTML = `daySet.php → ID: <strong>${escapeHtml(config.turn_id || "-")}</strong>, Turnike: <strong>${escapeHtml(config.turn_number || "-")}</strong><br>set.php → Lisans: <strong>${escapeHtml(config.license_key || "-")}</strong>, Domain: <strong>${escapeHtml(config.domain || "-")}</strong>`;
}

$("loadTurnSetupBtn").addEventListener("click", async () => {
    const btn = $("loadTurnSetupBtn");
    try {
        const target = requireTurnstileTarget();
        btn.disabled = true;
        setStatus($("turnSetupState"), "Okunuyor", "running");
        const data = await api("/api/turnstile/setup", {
            method: "POST",
            body: JSON.stringify(target),
        });
        applyTurnSetup(data.config);
        setStatus($("turnSetupState"), "Ayarlar alındı", "success");
    } catch (err) {
        setStatus($("turnSetupState"), "Hata", "error");
        $("turnSetupResult").classList.remove("muted");
        $("turnSetupResult").textContent = `Hata: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
});

$("saveTurnSetupBtn").addEventListener("click", async () => {
    const btn = $("saveTurnSetupBtn");
    try {
        const target = requireTurnstileTarget();
        const turnId = $("turnSetupId").value.trim();
        const turnNumber = $("turnSetupNumber").value.trim();
        const licenseKey = $("turnLicenseKey").value.trim();
        const domain = $("turnDomain").value.trim();

        if (!/^[A-Za-z0-9._-]+$/.test(turnId)) throw new Error("Turnike ID boş olamaz ve yalnızca harf/rakam/._- içerebilir.");
        if (!/^\d{1,4}$/.test(turnNumber) || Number(turnNumber) < 1) throw new Error("Turnike numarası 1-9999 arasında olmalıdır.");
        if (!/^[A-Za-z0-9._-]+$/.test(licenseKey)) throw new Error("Lisans anahtarı geçersiz.");
        if (!/^[A-Za-z0-9.-]+$/.test(domain) || !domain.includes(".") || domain.includes("..")) throw new Error("Domain örneğin gymsoftx1.com biçiminde olmalıdır.");

        if (!await uiConfirm(`${selectedDevice} üzerindeki daySet.php ve set.php lisans/turnike bilgileri değiştirilsin mi?`)) return;
        btn.disabled = true;
        setStatus($("turnSetupState"), "Kaydediliyor", "running");
        const data = await api("/api/turnstile/setup/update", {
            method: "POST",
            body: JSON.stringify({ ...target, turn_id: turnId, turn_number: turnNumber, license_key: licenseKey, domain }),
        });
        applyTurnSetup(data.config);
        setStatus($("turnSetupState"), "Kaydedildi", "success");
    } catch (err) {
        setStatus($("turnSetupState"), "Hata", "error");
        $("turnSetupResult").classList.remove("muted");
        $("turnSetupResult").textContent = `Hata: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
});

$("sshUser").addEventListener("change", () => scheduleLiveStatus(250));
$("sshPassword").addEventListener("change", () => scheduleLiveStatus(250));
resetLiveStatus();
scheduleLiveStatus(1000);

// -----------------------------------------------------------------------------
// Gymsoft Raspberry Tools — MVP v4
// -----------------------------------------------------------------------------
function requireToolTarget() {
    return requireTurnstileTarget();
}

async function runTextTool({ button, state, output, url, payload = {}, running = "Çalışıyor" }) {
    const btn = $(button);
    const stateEl = state ? $(state) : null;
    const outputEl = $(output);
    try {
        const target = requireToolTarget();
        btn.disabled = true;
        if (stateEl) setStatus(stateEl, running, "running");
        outputEl.textContent = "Raspberry Pi'ye bağlanılıyor…";
        const data = await api(url, {
            method: "POST",
            body: JSON.stringify({ ...target, ...payload }),
        });
        outputEl.textContent = data.output || data.message || "İşlem tamamlandı.";
        if (stateEl) setStatus(stateEl, "Tamamlandı", "success");
        return data;
    } catch (err) {
        outputEl.textContent = `Hata: ${err.message}`;
        if (stateEl) setStatus(stateEl, "Hata", "error");
        throw err;
    } finally {
        btn.disabled = false;
    }
}

async function loadNetworkProfiles() {
    const btn = $("networkRefreshProfilesBtn");
    try {
        const target = requireToolTarget();
        btn.disabled = true;
        setStatus($("networkState"), "Profiller okunuyor", "running");
        const data = await api("/api/tools/network/profiles", {
            method: "POST",
            body: JSON.stringify(target),
        });
        const select = $("networkProfile");
        if (!data.profiles.length) {
            select.innerHTML = '<option value="">Profil bulunamadı</option>';
        } else {
            select.innerHTML = data.profiles.map(profile => {
                const suffix = [profile.type, profile.device].filter(Boolean).join(" / ");
                return `<option value="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}${suffix ? ` — ${escapeHtml(suffix)}` : ""}</option>`;
            }).join("");
        }
        setStatus($("networkState"), `${data.profiles.length} profil`, "success");
    } catch (err) {
        setStatus($("networkState"), "Hata", "error");
        $("networkOutput").textContent = `Hata: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
}

$("networkRefreshProfilesBtn").addEventListener("click", loadNetworkProfiles);

$("networkSummaryBtn").addEventListener("click", () => runTextTool({
    button: "networkSummaryBtn",
    state: "networkState",
    output: "networkOutput",
    url: "/api/tools/network/read",
    payload: { view: "summary" },
}).catch(() => {}));

$("networkProfilesBtn").addEventListener("click", async () => {
    try {
        await runTextTool({
            button: "networkProfilesBtn",
            state: "networkState",
            output: "networkOutput",
            url: "/api/tools/network/read",
            payload: { view: "profiles" },
        });
        await loadNetworkProfiles();
    } catch (_) {}
});

$("networkActiveBtn").addEventListener("click", () => runTextTool({
    button: "networkActiveBtn",
    state: "networkState",
    output: "networkOutput",
    url: "/api/tools/network/read",
    payload: { view: "active" },
}).catch(() => {}));

async function checkNetworkIp({silent=false}={}) {
    const raw=$("networkAddress")?.value.trim()||"";
    if(window.GYMSOFT_DEMO_MODE){setStatus($("networkIpCheckState"),"IP BOŞ","success");if(!silent)showToast(`${raw||"192.168.1.50"} demo ağında boş görünüyor.`,"success","IP Kontrolü");return true;}
    if(!raw) { if(!silent)showToast("Önce yeni IP/CIDR girin.","warning","IP Kontrolü"); return false; }
    try{
        setStatus($("networkIpCheckState"),"Kontrol ediliyor","running");
        const data=await api('/api/tools/network/check-ip',{method:'POST',body:JSON.stringify({ip:raw})});
        setStatus($("networkIpCheckState"),data.available?'IP BOŞ':'KULLANIMDA',data.available?'success':'error');
        if(!silent)showToast(data.detail,data.available?'success':'error','IP Kontrolü');
        return !!data.available;
    }catch(err){setStatus($("networkIpCheckState"),"Hata","error"); if(!silent)showToast(err.message,'error','IP Kontrolü'); return false;}
}
$("networkCheckIpBtn")?.addEventListener('click',()=>checkNetworkIp());
const sleepMs=(ms)=>new Promise(r=>setTimeout(r,ms));
async function confirmSafeNetworkChange(data,target){
    if(!data?.safe_change) return;
    const oldIp=selectedDevice, newIp=data.new_ip, txid=data.txid;
    $("networkOutput").textContent += `\n\nYeni IP ${newIp} doğrulanıyor. ${data.rollback_seconds||90} saniye içinde doğrulanamazsa eski ayar otomatik geri gelecek…`;
    for(let i=0;i<12;i++){
        await sleepMs(i===0?3500:4000);
        try{
            const verify=await api('/api/device-info',{method:'POST',body:JSON.stringify({ip:newIp,username:target.username,password:target.password})});
            if(verify.info?.is_raspberry){
                await api('/api/tools/network/confirm',{method:'POST',body:JSON.stringify({ip:newIp,username:target.username,password:target.password,txid})});
                selectedDevice=newIp; $("selectedIp").value=newIp; verifiedDevices[newIp]=verify.info; delete verifiedDevices[oldIp];
                $("networkOutput").textContent += `\n✓ Yeni IP doğrulandı: ${newIp}\n✓ Otomatik rollback iptal edildi.`;
                setStatus($("networkState"),"Yeni IP doğrulandı","success"); showToast(`${oldIp} → ${newIp} başarıyla doğrulandı. Rollback iptal edildi.`,`success`,`Güvenli IP Değişimi`);
                showDeviceInfo(verify.info); scheduleLiveStatus(1000); refreshRealActivity(); return true;
            }
        }catch(_err){}
    }
    $("networkOutput").textContent += `\n⚠ Yeni IP doğrulanamadı. Raspberry üzerindeki otomatik geri dönüş mekanizması eski ayarı geri yükleyecek.`;
    setStatus($("networkState"),"Rollback bekleniyor","error"); showToast("Yeni IP doğrulanamadı. 90 saniyelik güvenlik süresi sonunda eski ağ ayarı geri yüklenir.","warning","Güvenli IP Değişimi"); return false;
}
async function changeNetwork(action) {
    const profile = $("networkProfile").value;
    if (!profile) return alert("Önce NetworkManager bağlantı profilini seçin.");
    let message="";
    if(action==="static"){
        if(!$("networkAddress").value.trim()||!$("networkGateway").value.trim())return alert("Statik IP için IP/CIDR ve Gateway alanları zorunludur.");
        const free=await checkNetworkIp({silent:true}); if(!free){showToast("Yeni IP kullanımda görünüyor. Statik IP işlemi durduruldu.","error","IP Çakışması");return;}
        message=`${selectedDevice} üzerindeki ${profile} profili güvenli statik IP değişimi ile güncellenecek. Yeni IP doğrulanmazsa eski ayar otomatik geri yüklenecek. Devam edilsin mi?`;
    }else if(action==="dhcp") message=`${selectedDevice} üzerindeki ${profile} profili DHCP'ye alınacak. Cihazın IP adresi değişebilir. Devam edilsin mi?`;
    else message=`${selectedDevice} üzerindeki ${profile} bağlantı profili SİLİNECEK. Aktif profilse bağlantı tamamen kesilebilir. Devam edilsin mi?`;
    if(!await uiConfirm(message))return;
    const buttonId=action==="static"?"networkStaticBtn":action==="dhcp"?"networkDhcpBtn":"networkDeleteBtn";
    try{
        const target=requireToolTarget(),btn=$(buttonId);btn.disabled=true;setStatus($("networkState"),"Uygulanıyor","running");$("networkOutput").textContent="Ağ ayarı Raspberry Pi'ye gönderiliyor…";
        const data=await api('/api/tools/network/change',{method:'POST',body:JSON.stringify({...target,action,profile,address:$("networkAddress").value.trim(),gateway:$("networkGateway").value.trim(),dns:$("networkDns").value.trim()})});
        $("networkOutput").textContent=data.output||"Ağ ayarı uygulandı.";setStatus($("networkState"),"Gönderildi","success");
        if(action==="static"&&data.safe_change) await confirmSafeNetworkChange(data,target);
    }catch(err){$("networkOutput").textContent=`Hata: ${err.message}\n\nAğ değişikliği başlamışsa güvenli rollback mekanizması eski ayarı geri yüklemeye çalışacaktır.`;setStatus($("networkState"),"Hata","error");}
    finally{$(buttonId).disabled=false;}
}

$("networkStaticBtn").addEventListener("click", () => changeNetwork("static"));
$("networkDhcpBtn").addEventListener("click", () => changeNetwork("dhcp"));
$("networkDeleteBtn").addEventListener("click", () => changeNetwork("delete"));

$("healthBtn").addEventListener("click", () => runTextTool({
    button: "healthBtn",
    state: "healthState",
    output: "healthOutput",
    url: "/api/tools/health",
    running: "Ölçülüyor",
}).catch(() => {}));

$("systemBtn").addEventListener("click", () => runTextTool({
    button: "systemBtn",
    state: "systemState",
    output: "systemOutput",
    url: "/api/tools/system",
    running: "Okunuyor",
}).catch(() => {}));

$("displayInfoBtn").addEventListener("click", () => runTextTool({
    button: "displayInfoBtn",
    state: "displayState",
    output: "displayOutput",
    url: "/api/tools/display",
    payload: { action: "info" },
}).catch(() => {}));

$("displayNormalBtn").addEventListener("click", async () => {
    if (!await uiConfirm(`${selectedDevice || "Seçili cihaz"} ekranı normal yöne alınsın mı?`)) return;
    await runTextTool({
        button: "displayNormalBtn",
        state: "displayState",
        output: "displayOutput",
        url: "/api/tools/display",
        payload: { action: "normal" },
    }).catch(() => {});
});

$("displayLabwcBtn").addEventListener("click", () => runTextTool({
    button: "displayLabwcBtn",
    state: "displayState",
    output: "displayOutput",
    url: "/api/tools/display",
    payload: { action: "labwc" },
}).catch(() => {}));

async function runTurnService(action, buttonId, confirmText = "") {
    if (confirmText && !await uiConfirm(confirmText)) return;
    const btn = $(buttonId);
    try {
        const target = requireToolTarget();
        btn.disabled = true;
        $("turnServiceOutput").textContent = "Servis işlemi gönderiliyor…";
        const data = await api("/api/tools/turnstile-service", {
            method: "POST",
            body: JSON.stringify({ ...target, action }),
        });
        $("turnServiceOutput").textContent = data.output || "İşlem tamamlandı.";
    } catch (err) {
        $("turnServiceOutput").textContent = `Hata: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
}

$("turnServiceStatusBtn").addEventListener("click", () => runTurnService("status", "turnServiceStatusBtn"));
$("apacheRestartBtn").addEventListener("click", () => runTurnService("apache_restart", "apacheRestartBtn", "Apache yeniden başlatılsın mı?"));
$("chromiumRestartBtn").addEventListener("click", () => runTurnService("chromium_restart", "chromiumRestartBtn", "Chromium kiosk yeniden başlatılsın mı?"));
$("gc3RestartBtn").addEventListener("click", () => runTurnService("gc3_check", "gc3RestartBtn", "gc3.py dosyası ve anlık geçiş durumu kontrol edilsin mi?"));

$("diagnoseBtn").addEventListener("click", () => runTextTool({
    button: "diagnoseBtn",
    state: "diagnoseState",
    output: "diagnoseOutput",
    url: "/api/tools/diagnose",
    running: "Tanılama yapılıyor",
}).catch(() => {}));

// Sidebar aktif bölüm göstergesi.
document.querySelectorAll(".sidebar nav a").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".sidebar nav a").forEach(item => item.classList.remove("active"));
        link.classList.add("active");
    });
});

// -----------------------------------------------------------------------------
// Dashboard, ekran görüntüsü, GPIO, log/yedek ve gelişmiş ekran — MVP v5
// -----------------------------------------------------------------------------
if ($("deviceFilter")) {
    $("deviceFilter").addEventListener("input", () => renderDevices(lastScanDevices));
}

function setQuickResult(message, error = false) {
    const box = $("quickResult");
    if (!box) return;
    box.classList.remove("muted");
    box.textContent = message;
    box.style.borderColor = error ? "rgba(239,103,103,.35)" : "";
}

async function takeScreenshot(triggerId = "screenshotBtn") {
    const btn = $(triggerId);
    try {
        const target = requireToolTarget();
        if (btn) btn.disabled = true;
        setStatus($("screenshotState"), "Alınıyor", "running");
        const data = await api("/api/tools/screenshot", {
            method: "POST",
            body: JSON.stringify(target),
        });
        $("screenImage").src = data.image;
        $("screenPreview").classList.add("has-image");
        setStatus($("screenshotState"), data.tool || "Tamamlandı", "success");
        setQuickResult(`Ekran görüntüsü alındı (${data.tool || "screenshot"}).`);
        document.querySelector("#visualTools")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
        setStatus($("screenshotState"), "Hata", "error");
        setQuickResult(`Ekran görüntüsü hatası: ${err.message}`, true);
        alert(err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

$("screenshotBtn")?.addEventListener("click", () => takeScreenshot("screenshotBtn"));
$("dashScreenshotBtn")?.addEventListener("click", () => takeScreenshot("dashScreenshotBtn"));

function renderGpioPins(pins) {
    if (!pins || !$("gpioPins")) return;
    const items = [
        ["Switch", pins.switch],
        ["Bobin 1", pins.coil1],
        ["Bobin 2", pins.coil2],
        ["Buzzer", pins.buzzer],
        ["LED", pins.led],
    ];
    $("gpioPins").innerHTML = items.map(([label, value]) => `<div><span>${label}</span><strong>GPIO ${escapeHtml(value ?? "--")}</strong></div>`).join("");
}

async function gpioAction(action, buttonId, confirmText = "") {
    const btn = $(buttonId);
    try {
        const target = requireToolTarget();
        if (confirmText && !await uiConfirm(confirmText)) return;
        if (btn) btn.disabled = true;
        setStatus($("gpioState"), "Çalışıyor", "running");
        $("gpioResult").classList.remove("muted");
        $("gpioResult").textContent = "GPIO işlemi gönderiliyor…";
        const data = await api("/api/tools/gpio", {
            method: "POST",
            body: JSON.stringify({ ...target, action }),
        });
        renderGpioPins(data.pins);
        $("gpioResult").textContent = data.message || "İşlem tamamlandı.";
        setStatus($("gpioState"), "Tamamlandı", "success");
    } catch (err) {
        $("gpioResult").classList.remove("muted");
        $("gpioResult").textContent = `Hata: ${err.message}`;
        setStatus($("gpioState"), "Hata", "error");
    } finally {
        if (btn) btn.disabled = false;
    }
}

$("gpioReadBtn")?.addEventListener("click", () => gpioAction("status", "gpioReadBtn"));
$("gpioSwitchBtn")?.addEventListener("click", () => gpioAction("switch", "gpioSwitchBtn"));
$("gpioBuzzerBtn")?.addEventListener("click", () => gpioAction("buzzer", "gpioBuzzerBtn"));
$("gpioLedBtn")?.addEventListener("click", () => gpioAction("led", "gpioLedBtn"));
$("gpioCoil1Btn")?.addEventListener("click", () => gpioAction("coil1", "gpioCoil1Btn", "Bobin 1 fiziksel olarak 0,6 saniye enerjilendirilecek. Devam edilsin mi?"));
$("gpioCoil2Btn")?.addEventListener("click", () => gpioAction("coil2", "gpioCoil2Btn", "Bobin 2 fiziksel olarak 0,6 saniye enerjilendirilecek. Devam edilsin mi?"));

async function loadDisplayModes() {
    const btn = $("displayModesBtn");
    try {
        const target = requireToolTarget();
        btn.disabled = true;
        setStatus($("displayState"), "Modlar okunuyor", "running");
        const data = await api("/api/tools/display/state", {
            method: "POST",
            body: JSON.stringify(target),
        });
        const d = data.display;
        const modes = d.modes?.length ? d.modes : (d.current_mode ? [d.current_mode] : []);
        $("displayModeSelect").innerHTML = modes.length
            ? modes.map(mode => `<option value="${escapeHtml(mode)}" ${mode === d.current_mode ? "selected" : ""}>${escapeHtml(mode)}${mode === d.current_mode ? " (aktif)" : ""}</option>`).join("")
            : '<option value="">Çözünürlük bulunamadı</option>';
        $("displayOutput").textContent = d.raw || "Ekran bilgisi alınamadı.";
        setStatus($("displayState"), d.output || "Okundu", "success");
    } catch (err) {
        $("displayOutput").textContent = `Hata: ${err.message}`;
        setStatus($("displayState"), "Hata", "error");
    } finally {
        btn.disabled = false;
    }
}

$("displayModesBtn")?.addEventListener("click", loadDisplayModes);
$("displayApplyBtn")?.addEventListener("click", async () => {
    const btn = $("displayApplyBtn");
    try {
        const target = requireToolTarget();
        const mode = $("displayModeSelect").value;
        const direction = $("displayDirection").value;
        if (!mode) throw new Error("Önce ekran modlarını okuyup bir çözünürlük seçin.");
        if (!await uiConfirm(`${selectedDevice} ekranı ${mode} / ${direction} olarak değiştirilsin ve labwc için kalıcılaştırılsın mı?`)) return;
        btn.disabled = true;
        setStatus($("displayState"), "Uygulanıyor", "running");
        const data = await api("/api/tools/display/apply", {
            method: "POST",
            body: JSON.stringify({ ...target, mode, direction }),
        });
        $("displayOutput").textContent = data.output || "Ekran ayarı uygulandı.";
        setStatus($("displayState"), "Uygulandı", "success");
    } catch (err) {
        $("displayOutput").textContent = `Hata: ${err.message}`;
        setStatus($("displayState"), "Hata", "error");
    } finally {
        btn.disabled = false;
    }
});

$("loadLogBtn")?.addEventListener("click", async () => {
    const btn = $("loadLogBtn");
    try {
        const target = requireToolTarget();
        btn.disabled = true;
        setStatus($("maintenanceState"), "Log okunuyor", "running");
        $("maintenanceOutput").textContent = "Log Raspberry Pi'den alınıyor…";
        const data = await api("/api/tools/logs", {
            method: "POST",
            body: JSON.stringify({ ...target, kind: $("logKind").value }),
        });
        $("maintenanceOutput").textContent = data.output || "Log boş.";
        setStatus($("maintenanceState"), "Tamamlandı", "success");
    } catch (err) {
        $("maintenanceOutput").textContent = `Hata: ${err.message}`;
        setStatus($("maintenanceState"), "Hata", "error");
    } finally {
        btn.disabled = false;
    }
});

$("downloadBackupBtn")?.addEventListener("click", async () => {
    const btn = $("downloadBackupBtn");
    try {
        const target = requireToolTarget();
        btn.disabled = true;
        setStatus($("maintenanceState"), "Yedek hazırlanıyor", "running");
        const data = await api("/api/tools/backup", {
            method: "POST",
            body: JSON.stringify(target),
        });
        const binary = atob(data.archive);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/gzip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || "gymsoft-backup.tar.gz";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        $("maintenanceOutput").textContent = `Yedek hazırlandı: ${data.filename}`;
        setStatus($("maintenanceState"), "Yedek indirildi", "success");
    } catch (err) {
        $("maintenanceOutput").textContent = `Hata: ${err.message}`;
        setStatus($("maintenanceState"), "Hata", "error");
    } finally {
        btn.disabled = false;
    }
});


function downloadBase64Archive(data, fallback="gymsoft-package.tar.gz") {
    const binary=atob(data.archive), bytes=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const blob=new Blob([bytes],{type:"application/gzip"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=data.filename||fallback;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
$("supportPackageBtn")?.addEventListener("click",async()=>{
    const btn=$("supportPackageBtn");
    if(window.GYMSOFT_DEMO_MODE){$("maintenanceOutput").textContent="Deneyim Modu: sistem, ağ, sağlık ve servis loglarını içeren gymsoft-support-demo.tar.gz paketi simüle edildi.";setStatus($("maintenanceState"),"Demo paket hazır","success");showToast("Teknik destek paketi oluşturma akışı simüle edildi.","success","Destek Paketi");return;}
    try{const target=requireToolTarget();btn.disabled=true;setStatus($("maintenanceState"),"Destek paketi hazırlanıyor","running");const data=await api('/api/tools/support-package',{method:'POST',body:JSON.stringify(target)});downloadBase64Archive(data,'gymsoft-support.tar.gz');$("maintenanceOutput").textContent=`Teknik destek paketi hazırlandı: ${data.filename}\n\nİçerik: sistem, ağ, sağlık, servis, Apache/Chromium/gc3/kernel logları, ekran ve Gymsoft configleri.`;setStatus($("maintenanceState"),"Destek paketi indirildi","success");showToast(data.filename,'success','Teknik Destek Paketi');}catch(err){setStatus($("maintenanceState"),"Hata","error");$("maintenanceOutput").textContent=`Hata: ${err.message}`;showToast(err.message,'error','Destek Paketi');}finally{btn.disabled=false;}
});

async function rebootDevice(buttonId = "quickRebootBtn") {
    const btn = $(buttonId);
    try {
        const target = requireToolTarget();
        if (!await uiConfirm(`${selectedDevice} yeniden başlatılsın mı? SSH bağlantısı geçici olarak kesilecektir.`)) return;
        btn.disabled = true;
        const data = await api("/api/tools/power", {
            method: "POST",
            body: JSON.stringify({ ...target, action: "reboot" }),
        });
        setQuickResult(data.output || "Reboot komutu gönderildi.");
        setLiveConnection("Yeniden başlıyor", false);
    } catch (err) {
        setQuickResult(`Reboot hatası: ${err.message}`, true);
    } finally {
        btn.disabled = false;
    }
}

$("quickRebootBtn")?.addEventListener("click", () => rebootDevice("quickRebootBtn"));
$("quickOpenBtn")?.addEventListener("click", () => sendTurnstileAction("open"));
$("dashOpenBtn")?.addEventListener("click", () => sendTurnstileAction("open"));
$("dashLockBtn")?.addEventListener("click", () => sendTurnstileAction("lock"));
$("quickKioskBtn")?.addEventListener("click", () => runTurnService("chromium_restart", "quickKioskBtn", "Chromium kiosk yeniden başlatılsın mı?"));
$("quickGc3Btn")?.addEventListener("click", () => runTurnService("gc3_check", "quickGc3Btn", "gc3.py durumu kontrol edilsin mi?"));
$("dashDiagnoseBtn")?.addEventListener("click", () => {
    if (typeof navigateToPage === "function") navigateToPage("diagnostics");
    setTimeout(() => $("diagnoseBtn")?.click(), 120);
});

window.addEventListener("resize", () => {
    drawSparkline("tempChart", liveHistory.temp, { min: 35, max: Math.max(85, ...(liveHistory.temp.length ? liveHistory.temp : [85])) });
    drawSparkline("cpuChart", liveHistory.cpu, { min: 0, max: 100 });
});


/* ========================================================================== 
   Gymsoft Raspberry Manager v8 — SPA navigation + Experience Mode
   ========================================================================== */
window.GYMSOFT_DEMO_MODE = false;
const UI_VERSION = "v10-live";

const PAGE_META = {
    dashboard: ["YÖNETİM MERKEZİ", "Dashboard", "Tüm turnike ve Raspberry cihazlarının genel görünümü."],
    devices: ["CİHAZ & SSH", "Cihazlar", "Ağ taraması, cihaz seçimi ve SSH doğrulaması aynı sayfada."],
    installation: ["KURULUM", "Kurulum Merkezi", "Raspberry kurulumu, GitHub Release ve turnike lisans ayarları."],
    turnstile: ["TURNİKE", "Turnike Kontrolü", "Geçiş, yön, süre, servis ve test işlemleri."],
    hardware: ["DONANIM", "Ekran & Donanım", "Ekran çözünürlüğü, screenshot ve GPIO testleri."],
    network: ["AĞ", "Ağ Yönetimi", "IP, DHCP, bağlantı profilleri ve ağ kalite kontrolleri."],
    health: ["SİSTEM", "Sağlık & Sistem", "Sıcaklık, CPU, RAM, disk ve sistem bilgileri."],
    diagnostics: ["TEKNİK SERVİS", "Tanı, Log & Yedek", "Arıza tespiti, servis logları, audit ve yedekleme."],
    settings: ["AYARLAR", "Ayarlar & Güvenlik", "Raspberry parolası, agent ve kullanıcı deneyimi tercihleri."],
};

function navigateToPage(page, { updateHash = true } = {}) {
    const key = PAGE_META[page] ? page : "dashboard";
    document.querySelectorAll(".app-page-section").forEach(section => {
        section.classList.toggle("page-active", section.dataset.page === key);
    });
    document.querySelectorAll("[data-page-link]").forEach(link => {
        link.classList.toggle("active", link.dataset.pageLink === key);
    });
    const meta = PAGE_META[key];
    if ($("pageEyebrow")) $("pageEyebrow").textContent = meta[0];
    if ($("pageTitle")) $("pageTitle").textContent = meta[1];
    if ($("pageSubtitle")) $("pageSubtitle").textContent = meta[2];
    document.title = `${meta[1]} · Gymsoft Raspberry Manager`;
    if (updateHash && location.hash !== `#${key}`) history.replaceState(null, "", `#${key}`);
    document.querySelector(".sidebar")?.classList.remove("mobile-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function initPageRouter() {
    document.querySelectorAll("[data-page-link]").forEach(link => link.addEventListener("click", event => {
        event.preventDefault();
        navigateToPage(link.dataset.pageLink);
    }));
    const hash = location.hash.replace("#", "");
    navigateToPage(PAGE_META[hash] ? hash : "dashboard", { updateHash: !PAGE_META[hash] });
    window.addEventListener("hashchange", () => {
        const page = location.hash.replace("#", "");
        if (PAGE_META[page]) navigateToPage(page, { updateHash: false });
    });
    $("mobileMenuBtn")?.addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("mobile-open"));
}

let liveAlarmCache = [];
let realActivityTimer = null;

function renderLiveAlarms(alarms = [], connectionError = "") {
    if (window.GYMSOFT_DEMO_MODE) return;
    const list = $("demoAlarmList");
    const badge = $("demoAlarmCount");
    if (!list || !badge) return;

    let items = Array.isArray(alarms) ? alarms : [];
    if (connectionError) {
        items = [{ level:"critical", title:"Raspberry bağlantısı yok", detail:connectionError, time:"şimdi" }];
    }
    liveAlarmCache = items;
    badge.className = `status ${items.length ? "running" : "success"}`;
    badge.textContent = items.length ? `${items.length} açık uyarı · CANLI` : "0 uyarı · CANLI";

    if (!selectedDevice || !verifiedDevices[selectedDevice]?.is_raspberry) {
        badge.className = "status neutral";
        badge.textContent = "Canlı bekliyor";
        list.innerHTML = `<div class="info-box muted">Bir Raspberry doğrulandığında gerçek sağlık alarmları burada anlık olarak gösterilir.</div>`;
        return;
    }
    if (!items.length) {
        list.innerHTML = `<div class="alarm-item live-ok"><span class="alarm-dot info"></span><div><strong>Aktif alarm yok</strong><small>${escapeHtml(selectedDevice)} şu anda normal eşiklerde çalışıyor.</small></div><time>canlı</time></div>`;
        return;
    }
    list.innerHTML = items.map(item => {
        const level = ["critical","warning","info"].includes(item.level) ? item.level : "info";
        const remedy = item.remedy ? `<button type="button" class="secondary alarm-fix-btn" data-alarm-remedy="${escapeHtml(item.remedy)}">${escapeHtml(item.remedy_label || "Sorunu Çöz")}</button>` : "";
        return `<div class="alarm-item"><span class="alarm-dot ${level}"></span><div><strong>${escapeHtml(item.title || "Uyarı")}</strong><small>${escapeHtml(item.detail || "")}</small>${remedy}</div><time>${escapeHtml(item.time || "şimdi")}</time></div>`;
    }).join("");
    list.querySelectorAll("[data-alarm-remedy]").forEach(btn=>btn.addEventListener("click", async()=>{
        try{const target=requireToolTarget(), action=btn.dataset.alarmRemedy; btn.disabled=true; const data=await api("/api/tools/turnstile-service",{method:"POST",body:JSON.stringify({...target,action})}); showToast(data.output||"Düzeltme uygulandı.","success","Alarm Çözümü"); setTimeout(()=>refreshLiveStatus(),800);}catch(err){showToast(err.message,"error","Alarm Çözümü");}finally{btn.disabled=false;}
    }));
}

function renderRealActivity(items = []) {
    if (window.GYMSOFT_DEMO_MODE) return;
    const area = $("demoRecentActivity");
    if (!area) return;
    if (!items.length) {
        area.innerHTML = `<div class="info-box muted">Henüz gerçek teknik servis işlemi kaydedilmedi. Agent üzerinden yapılan değişiklikler burada görünür.</div>`;
        return;
    }
    area.innerHTML = items.map(item => {
        const target = item.target_ip ? ` · ${escapeHtml(item.target_ip)}` : "";
        const user = item.username ? escapeHtml(item.username) : "GymsoftAgent";
        const markerClass = item.type === "error" ? " error" : "";
        return `<div class="timeline-item"><time>${escapeHtml(item.time || "--:--:--")}</time><span class="timeline-marker${markerClass}"></span><div><strong>${escapeHtml(item.action || "İşlem")}${target}</strong><small>${user}${item.type === "error" ? " · BAŞARISIZ" : " · GERÇEK"}</small></div></div>`;
    }).join("");
}

async function refreshRealActivity() {
    if (window.GYMSOFT_DEMO_MODE) return;
    const button = $("demoClearAuditBtn");
    if (button) button.textContent = "Yenile";
    if (!selectedDevice || !verifiedDevices[selectedDevice]?.is_raspberry) {
        renderRealActivity([]);
        const area = $("demoRecentActivity");
        if (area) area.innerHTML = `<div class="info-box muted">Bir Raspberry seçip SSH doğrulaması yaptığınızda yalnızca o cihazdaki işlemler burada görünür.</div>`;
        if (realActivityTimer) clearTimeout(realActivityTimer);
        realActivityTimer = setTimeout(refreshRealActivity, 5000);
        return;
    }
    try {
        const data = await api(`/api/activity?limit=5&ip=${encodeURIComponent(selectedDevice)}`, { method:"GET" });
        renderRealActivity(data.items || []);
    } catch (err) {
        renderRealActivity([]);
    }
    if (realActivityTimer) clearTimeout(realActivityTimer);
    realActivityTimer = setTimeout(refreshRealActivity, 5000);
}


let releaseStatusTimer = null;
function resetReleaseStatus() {
    if ($("demoInstalledRelease")) $("demoInstalledRelease").textContent="--";
    if ($("demoLatestRelease")) $("demoLatestRelease").textContent="--";
    const state=$("releaseCompareState"); if(state){state.className="status neutral";state.textContent="Bekliyor";}
    if ($("demoReleaseResult")) $("demoReleaseResult").textContent="Bir Raspberry doğrulayın. Private GitHub Latest kontrolü için GitHub token alanını doldurun.";
}
function renderReleaseStatus(data) {
    const installed=data.installed_tag || "--";
    const latest=data.latest_tag || "--";
    $("demoInstalledRelease").textContent=installed;
    $("demoLatestRelease").textContent=latest;
    const state=$("releaseCompareState"), result=$("demoReleaseResult");
    if(data.status === "current") {
        state.className="status success"; state.textContent="GÜNCEL";
        result.className="mini-result release-status-current";
        result.textContent=`Sistem güncel · ${installed}`;
    } else if(data.status === "outdated") {
        state.className="status error"; state.textContent="GÜNCEL DEĞİL";
        result.className="mini-result release-status-outdated";
        result.textContent=`Sistem güncel değil · Kurulu ${installed} · GitHub Latest ${latest}`;
    } else if(!data.installed_tag) {
        state.className="status running"; state.textContent="SÜRÜM BİLİNMİYOR";
        result.className="mini-result release-status-unknown";
        result.textContent="Kurulu sürüm işaretçisi bulunamadı. v11 ile yapılan bir sonraki GitHub kurulumunda sürüm otomatik kaydedilecek.";
    } else if(data.latest_error) {
        state.className="status neutral"; state.textContent="LATEST BEKLİYOR";
        result.className="mini-result";
        result.textContent=`Kurulu ${installed} · GitHub Latest için token gerekli veya erişim doğrulanamadı.`;
    } else {
        state.className="status neutral"; state.textContent="KONTROL EDİLEMEDİ";
        result.className="mini-result"; result.textContent="Sürüm karşılaştırması tamamlanamadı.";
    }
}
async function refreshReleaseStatus({silent=false}={}) {
    if(window.GYMSOFT_DEMO_MODE){
        $("demoInstalledRelease").textContent="v22.2"; $("demoLatestRelease").textContent="v23.0";
        const st=$("releaseCompareState"); if(st){st.className="status error";st.textContent="DEMO · GÜNCEL DEĞİL";}
        $("demoReleaseResult").textContent="Deneyim Modu: Sistem güncel değil · Kurulu v22.2 · GitHub Latest v23.0";
        return;
    }
    if(!selectedDevice || !verifiedDevices[selectedDevice]?.is_raspberry){ resetReleaseStatus(); return; }
    const username=$("sshUser").value.trim(), password=$("sshPassword").value;
    if(!username || !password){ resetReleaseStatus(); return; }
    const state=$("releaseCompareState"); if(state){state.className="status running";state.textContent="KONTROL EDİLİYOR";}
    try {
        const data=await api("/api/release/status", {method:"POST",body:JSON.stringify({ip:selectedDevice,username,password,github_token:$("githubToken")?.value.trim()||""})});
        renderReleaseStatus(data);
        if(!silent && data.status==="current") showToast(`Sistem güncel: ${data.installed_tag}`,"success","Release Durumu");
        if(!silent && data.status==="outdated") showToast(`Güncelleme mevcut: ${data.installed_tag} → ${data.latest_tag}`,"warning","Release Durumu");
    } catch(err){
        if(state){state.className="status error";state.textContent="HATA";}
        $("demoReleaseResult").textContent=`Sürüm kontrolü başarısız: ${err.message}`;
    }
}


let lastReleaseBackups=[];
function renderReleaseHistory(data){
    const area=$("releaseHistoryResult"); if(!area)return; lastReleaseBackups=data.backups||[];
    const items=data.items||[];
    if(!items.length&&!lastReleaseBackups.length){area.innerHTML='<div class="mini-result">Henüz release geçmişi/yedeği yok.</div>';return;}
    area.innerHTML=items.slice(0,6).map(i=>`<div class="release-history-item"><small>${escapeHtml((i.timestamp||'').replace('T',' ').slice(0,19))}</small><strong>${escapeHtml(i.event||'-')} · ${escapeHtml(i.tag||'-')}</strong><small>${escapeHtml(i.note||'')}</small></div>`).join('') + (lastReleaseBackups.length?`<div class="mini-result">Rollback yedeği: ${escapeHtml(lastReleaseBackups[0].split('/').pop())}</div>`:'');
}
async function loadReleaseHistory(){
    if(window.GYMSOFT_DEMO_MODE){renderReleaseHistory({items:[{timestamp:new Date().toISOString(),event:'install',tag:'v23.0',note:'from=v22.2'},{timestamp:new Date(Date.now()-86400000).toISOString(),event:'backup',tag:'v22.2',note:'demo'}],backups:['/var/lib/gymsoft/backups/demo__v22.2.tar.gz']});return;}
    try{const target=requireToolTarget();const data=await api('/api/release/history',{method:'POST',body:JSON.stringify(target)});renderReleaseHistory(data);showToast(`${(data.items||[]).length} geçmiş kaydı okundu.`,'success','Release Geçmişi');}catch(err){showToast(err.message,'error','Release Geçmişi');}
}
$("releaseHistoryBtn")?.addEventListener('click',loadReleaseHistory);
$("releaseRollbackBtn")?.addEventListener('click',async()=>{
    if(window.GYMSOFT_DEMO_MODE){showToast('Deneyim Modu: v22.2 yedeğine rollback simüle edildi.','success','Rollback');return;}
    try{const target=requireToolTarget();if(!lastReleaseBackups.length)await loadReleaseHistory();const backup=lastReleaseBackups[0]||'';if(!backup)throw new Error('Rollback yedeği bulunamadı.');if(!await uiConfirm(`${selectedDevice} cihazı ${backup.split('/').pop()} yedeğine geri döndürülsün mü? Mevcut durum ayrıca güvenlik yedeğine alınacaktır.`,{title:'Release Rollback'}))return;const btn=$("releaseRollbackBtn");btn.disabled=true;const data=await api('/api/release/rollback',{method:'POST',body:JSON.stringify({...target,backup})});showToast(`Rollback tamamlandı: ${data.restored_tag}`,'success','Release Rollback');await refreshReleaseStatus();await loadReleaseHistory();refreshRealActivity();}catch(err){showToast(err.message,'error','Release Rollback');}finally{$("releaseRollbackBtn").disabled=false;}
});

const DEMO_INVENTORY = [
    { customer: "Conan Fit", name: "Turnike 1", ip: "192.168.1.101", model: "Raspberry Pi 5", release: "v22.2", status: "online", temp: 47.6, health: 96, seen: "şimdi" },
    { customer: "Conan Fit", name: "Turnike 2", ip: "192.168.1.102", model: "Raspberry Pi 5", release: "v22.2", status: "online", temp: 45.2, health: 98, seen: "8 sn önce" },
    { customer: "X Fitness", name: "Turnike 1", ip: "192.168.1.103", model: "Raspberry Pi 3", release: "v18.0", status: "warning", temp: 72.1, health: 68, seen: "12 sn önce" },
    { customer: "Atlantis Gym", name: "Turnike 1", ip: "192.168.1.104", model: "Raspberry Pi 5", release: "v22.2", status: "offline", temp: null, health: 20, seen: "18 dk önce" },
    { customer: "Power Zone", name: "Turnike 3", ip: "192.168.1.105", model: "Raspberry Pi 5", release: "v22.2", status: "online", temp: 44.8, health: 94, seen: "3 sn önce" },
];
let demoInventory = DEMO_INVENTORY.map(item => ({...item}));
let demoWizardStep = 1;
let demoWizardData = { profile: "Pi 5 Wayland", ip: "192.168.1.120", user: "gymsoft", direction: "cift", seconds: 9, release: "v22.2" };
const TURN_TESTS = ["Bobin 1", "Bobin 2", "Buzzer", "LED", "Switch", "Apache / gircik.php", "gc3.py dosyası"];
let turnTestRunId = 0;
let demoAudit = [
    { time: "10:42:18", user: "Teknik-1", target_ip:"192.168.1.101", text: "Kiosk yeniden başlatıldı", type: "success" },
    { time: "10:39:02", user: "Teknik-2", target_ip:"192.168.1.103", text: "throttled=0x50005 uyarısı görüldü", type: "warning" },
    { time: "10:35:44", user: "Teknik-1", target_ip:"192.168.1.105", text: "Release v22.2 kuruldu", type: "change" },
    { time: "10:31:07", user: "Teknik-3", target_ip:"192.168.1.102", text: "IP 192.168.1.42 → 192.168.1.102", type: "change" },
];

function demoLog(text, type = "success") {
    const now = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    demoAudit.unshift({ time: now, user: "Demo Kullanıcı", target_ip:selectedDevice || "", text, type });
    demoAudit = demoAudit.slice(0, 20);
    renderDemoActivity();
    renderAudit();
}

function renderDemoAlarms() {
    if (!window.GYMSOFT_DEMO_MODE) return;
    const item = demoInventory.find(x => x.ip === selectedDevice);
    const badge = $("demoAlarmCount"), list = $("demoAlarmList");
    if (!badge || !list) return;
    if (!item) {
        badge.className="status neutral"; badge.textContent="Cihaz bekleniyor";
        list.innerHTML='<div class="info-box muted">Demo ağ listesinden bir cihaz seçin.</div>'; return;
    }
    const alarms=[];
    if (item.status === "offline") alarms.push(["critical","Cihaz çevrimdışı",`${item.ip} için bağlantı kurulamıyor.`,item.seen]);
    if (item.status === "warning" || (item.temp !== null && item.temp >= 70)) alarms.push(["warning","Sıcaklık / throttled uyarısı",`${item.temp?.toFixed?.(1) || "--"}°C · güç/ısı geçmişi kontrol edilmeli`,"şimdi"]);
    badge.className=`status ${alarms.length ? "running" : "success"}`;
    badge.textContent=alarms.length ? `${alarms.length} demo uyarı · SEÇİLİ CİHAZ` : "0 uyarı · SEÇİLİ CİHAZ";
    list.innerHTML=alarms.length ? alarms.map(([type,title,detail,time])=>`<div class="alarm-item"><span class="alarm-dot ${type}"></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div><time>${escapeHtml(time)}</time></div>`).join("") : `<div class="alarm-item live-ok"><span class="alarm-dot info"></span><div><strong>Aktif alarm yok</strong><small>${escapeHtml(item.ip)} demo cihazı normal eşiklerde.</small></div><time>canlı</time></div>`;
}

function renderDemoActivity() {
    if (!window.GYMSOFT_DEMO_MODE) return;
    const list = demoAudit.filter(item => !selectedDevice || item.target_ip === selectedDevice).slice(0, 5);
    $("demoRecentActivity").innerHTML = list.length ? list.map(item => `<div class="timeline-item"><time>${item.time}</time><span class="timeline-marker"></span><div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.user)}</small></div></div>`).join("") : `<div class="info-box muted">İşlem geçmişi temizlendi.</div>`;
}

function renderInventory() {
    if (!$("inventoryGrid") || !$("inventoryStatus")) return;
    if (!window.GYMSOFT_DEMO_MODE) {
        if ($("inventoryStatus")) $("inventoryStatus").textContent = "Deneyim modu kapalı";
        if ($("inventoryGrid")) $("inventoryGrid").innerHTML = `<div class="info-box muted">Bu envanter örnek verileri yalnızca Deneyim Modu'nda gösterilir. Gerçek cihazlar için Ağ Tarama tablosunu kullanın.</div>`;
        return;
    }
    const q = ($("inventorySearch")?.value || "").trim().toLowerCase();
    const filter = $("inventoryFilter")?.value || "all";
    const list = demoInventory.filter(item => {
        const matches = !q || `${item.customer} ${item.name} ${item.ip} ${item.model} ${item.release}`.toLowerCase().includes(q);
        return matches && (filter === "all" || item.status === filter);
    });
    $("inventoryStatus").textContent = `${list.length} / ${demoInventory.length} cihaz`;
    $("inventoryGrid").innerHTML = list.map(item => {
        const temp = item.temp === null ? "--" : `${item.temp.toFixed(1)} °C`;
        return `<article class="inventory-card"><span class="inventory-state ${item.status}"></span><span class="customer">${escapeHtml(item.customer)}</span><h3>${escapeHtml(item.name)}</h3><div class="inventory-meta"><div><span>IP</span><strong>${item.ip}</strong></div><div><span>Model</span><strong>${escapeHtml(item.model)}</strong></div><div><span>Sürüm</span><strong>${item.release}</strong></div><div><span>Sıcaklık</span><strong>${temp}</strong></div></div><div class="health-score"><div class="health-score-track"><div class="health-score-fill" style="width:${item.health}%"></div></div><strong>${item.health}/100</strong></div><div class="mini-result">Son görülme: ${item.seen}</div></article>`;
    }).join("") || `<div class="info-box muted">Filtreye uygun cihaz bulunamadı.</div>`;
}

function renderAudit() {
    const filter = $("auditFilter")?.value || "all";
    const rows = demoAudit.filter(item => filter === "all" || item.type === filter);
    $("auditTableWrap").innerHTML = rows.map(item => `<div class="audit-row"><time>${item.time}</time><span class="audit-user">${escapeHtml(item.user)}</span><strong>${escapeHtml(item.text)}</strong><span class="audit-badge ${item.type}">${item.type === "warning" ? "UYARI" : item.type === "change" ? "DEĞİŞİKLİK" : "BAŞARILI"}</span></div>`).join("") || `<div class="info-box muted">Bu filtrede kayıt yok.</div>`;
}

function renderTurnTests(states = {}) {
    $("turnTestSteps").innerHTML = TURN_TESTS.map((name, index) => {
        const state = states[index] || "pending";
        const icon = state === "ok" ? "✓" : state === "running" ? "…" : index + 1;
        const result = state === "ok" ? "Başarılı" : state === "running" ? "Test ediliyor" : "Bekliyor";
        return `<div class="test-step-item ${state}"><span class="test-step-icon">${icon}</span><strong>${name}</strong><span class="test-step-result">${result}</span></div>`;
    }).join("");
}

function renderWizard() {
    $("wizardStatus").textContent = `Adım ${demoWizardStep} / 4`;
    document.querySelectorAll(".wizard-step").forEach(btn => {
        const step = Number(btn.dataset.step);
        btn.classList.toggle("active", step === demoWizardStep);
        btn.classList.toggle("done", step < demoWizardStep);
    });
    $("wizardBackBtn").disabled = demoWizardStep === 1;
    $("wizardNextBtn").textContent = demoWizardStep === 4 ? "Deneme Kurulumunu Tamamla" : "Devam";
    if (demoWizardStep === 1) {
        $("wizardContent").innerHTML = `<h3>Kurulum Profili</h3><p>Raspberry tipine göre hazır ayar seçin.</p><div class="profile-grid">${["Pi 5 Wayland","Pi 5 X11","Pi 3 Legacy"].map(profile => `<div class="profile-option ${demoWizardData.profile===profile?'selected':''}" data-profile="${profile}"><strong>${profile}</strong><small>${profile === 'Pi 5 Wayland' ? 'Önerilen · labwc / wlr-randr' : profile === 'Pi 5 X11' ? 'Xorg kiosk uyumluluğu' : 'Eski Debian / LXDE sistemleri'}</small></div>`).join('')}</div>`;
    } else if (demoWizardStep === 2) {
        $("wizardContent").innerHTML = `<h3>Raspberry Bilgileri</h3><div class="two-col"><label><span>IP Adresi</span><input id="wizIp" value="${demoWizardData.ip}"></label><label><span>SSH Kullanıcısı</span><input id="wizUser" value="${demoWizardData.user}"></label></div><div class="info-box muted">Gerçek modda bu adım cihazı SSH üzerinden doğrular ve model/OS bilgisini getirir.</div>`;
    } else if (demoWizardStep === 3) {
        $("wizardContent").innerHTML = `<h3>Turnike Ayarları</h3><div class="two-col"><label><span>Yön</span><select id="wizDirection"><option value="sag">Sağ</option><option value="sol">Sol</option><option value="cift">Çift</option></select></label><label><span>Geçiş Süresi</span><input id="wizSeconds" type="number" value="${demoWizardData.seconds}"></label></div><label><span>Release</span><select id="wizRelease"><option>v22.2</option><option>v18.0</option><option>V22</option></select></label>`;
        $("wizDirection").value = demoWizardData.direction;
    } else {
        $("wizardContent").innerHTML = `<h3>Kurulum Özeti</h3><div class="summary-list"><div><span>Profil</span><strong>${demoWizardData.profile}</strong></div><div><span>IP</span><strong>${demoWizardData.ip}</strong></div><div><span>Kullanıcı</span><strong>${demoWizardData.user}</strong></div><div><span>Yön</span><strong>${demoWizardData.direction}</strong></div><div><span>Geçiş Süresi</span><strong>${demoWizardData.seconds} sn</strong></div><div><span>Release</span><strong>${demoWizardData.release}</strong></div></div><div class="warning-box">Deneyim modunda hiçbir Raspberry’ye komut gönderilmez. Gerçek modda kurulumdan önce onay ekranı gösterilir.</div>`;
    }
}

function collectWizardStep() {
    if (demoWizardStep === 2) {
        demoWizardData.ip = $("wizIp")?.value || demoWizardData.ip;
        demoWizardData.user = $("wizUser")?.value || demoWizardData.user;
    } else if (demoWizardStep === 3) {
        demoWizardData.direction = $("wizDirection")?.value || demoWizardData.direction;
        demoWizardData.seconds = Number($("wizSeconds")?.value || demoWizardData.seconds);
        demoWizardData.release = $("wizRelease")?.value || demoWizardData.release;
    }
}

function applyDemoLiveStatus() {
    const item = demoInventory.find(x => x.ip === selectedDevice) || demoInventory[0];
    if (!item || item.status === "offline") {
        setLiveConnection("Çevrimdışı · Demo", false);
        $("liveDevice").textContent = item?.ip || "Demo cihaz";
        renderDemoAlarms();
        return;
    }
    const t = (item.temp ?? 48) + (Math.random() * 1.2 - .6);
    const cpu = item.status === "warning" ? 55 + Math.random()*18 : 22 + Math.random() * 14;
    const throttled = item.status === "warning" ? "0x50005" : "0x0";
    const host = `GYM-TURNIKE-${item.ip.split('.').pop()}`;
    const status = { temperature:t, cpu_percent:cpu, ram_percent:46.2, disk_percent:31.8, throttled:`throttled=${throttled}`, network_active:true, uptime_seconds:218400, apache_active:true, gc3_ready:true, gc3_running:false, gc3_active:true, hostname:host };
    setLiveConnection("Aktif · Demo", true);
    $("liveDevice").textContent = `${item.ip} · ${host}`;
    $("liveTemp").textContent = `${t.toFixed(1)} °C`;
    $("liveCpu").textContent = `${cpu.toFixed(1)}%`;
    $("liveRam").textContent = "46.2%";
    $("liveDisk").textContent = "31.8%";
    $("liveThrottle").textContent = throttled;
    $("liveNetwork").textContent = "Aktif · 60s 40dk";
    $("liveTurnstile").textContent = "Apache ✓ · gc3 hazır";
    updateDashboard(status);
    renderDemoAlarms();
}

function setDemoMode(enabled) {
    window.GYMSOFT_DEMO_MODE = Boolean(enabled);
    document.body.classList.toggle("demo-mode", window.GYMSOFT_DEMO_MODE);
    $("demoModeBtn").classList.toggle("demo-active", window.GYMSOFT_DEMO_MODE);
    $("demoModeBtn").textContent = window.GYMSOFT_DEMO_MODE ? "Deneyim Modu: Açık" : "Deneyim Modu";
    if ($("demoModeSwitch")) $("demoModeSwitch").checked = window.GYMSOFT_DEMO_MODE;
    if ($("sidebarModeText")) $("sidebarModeText").textContent = window.GYMSOFT_DEMO_MODE ? "Deneyim modu aktif" : "Gerçek cihaz modu";
    if (window.GYMSOFT_DEMO_MODE) {
        if (realActivityTimer) clearTimeout(realActivityTimer);
        if ($("demoClearAuditBtn")) $("demoClearAuditBtn").textContent = "Temizle";
        if ($("demoInstalledRelease")) $("demoInstalledRelease").textContent = "v22.2";
        if ($("demoLatestRelease")) $("demoLatestRelease").textContent = "v23.0";
        if ($("releaseCompareState")) { $("releaseCompareState").className="status error"; $("releaseCompareState").textContent="DEMO · GÜNCEL DEĞİL"; }
        if ($("demoReleaseBtn")) $("demoReleaseBtn").textContent="Güncelleme Akışını Deneyimle";
        selectedDevice = "192.168.1.101";
        verifiedDevices[selectedDevice] = { is_raspberry:true, model:"Raspberry Pi 5 Model B", hostname:"GYM-TURNIKE-01", os:"Raspberry Pi OS", arch:"aarch64" };
        lastScanDevices = DEMO_INVENTORY.map(item => ({ ip:item.ip, ssh:item.status!=="offline", http:item.status!=="offline", status:item.status === "offline" ? "Çevrimdışı" : "SSH adayı" }));
        $("selectedIp").value = selectedDevice;
        renderDevices(lastScanDevices);
        showDeviceInfo(verifiedDevices[selectedDevice]);
        applyDemoLiveStatus();
        renderDemoAlarms();
        renderDemoActivity();
        demoLog("Deneyim modu etkinleştirildi", "success");
    } else {
        if (selectedDevice === "192.168.1.101" && verifiedDevices[selectedDevice]?.hostname === "GYM-TURNIKE-01") {
            selectedDevice = null;
            lastScanDevices = [];
            verifiedDevices = {};
            $("selectedIp").value = "";
            $("deviceInfo").textContent = "Cihaz bilgisi henüz alınmadı.";
            renderDevices([]);
            resetLiveStatus();
        }
        if ($("demoInstalledRelease")) $("demoInstalledRelease").textContent = "--";
        if ($("demoLatestRelease")) $("demoLatestRelease").textContent = "--";
        if ($("demoReleaseBtn")) $("demoReleaseBtn").textContent="Sürümü Kontrol Et";
        resetReleaseStatus();
        renderLiveAlarms([]);
        renderInventory();
        refreshRealActivity();
    }
    scheduleLiveStatus(100);
}

function simulateDemoAction(label, type="success") {
    demoLog(label, type);
    if ($("quickResult")) { $("quickResult").classList.remove("muted"); $("quickResult").textContent = `Deneyim Modu: ${label}`; }
}

function installDemoInterceptors() {
    const actions = {
        quickOpenBtn:"Geçiş izni verildi", dashOpenBtn:"Geçiş izni verildi", openTurnstileBtn:"Geçiş izni verildi",
        dashLockBtn:"Turnike kilitlendi", lockTurnstileBtn:"Turnike kilitlendi",
        quickKioskBtn:"Kiosk yeniden başlatıldı", chromiumRestartBtn:"Kiosk yeniden başlatıldı",
        quickGc3Btn:"gc3.py durumu kontrol edildi", gc3RestartBtn:"gc3.py durumu kontrol edildi",
        quickRebootBtn:"Reboot komutu simüle edildi", apacheRestartBtn:"Apache yeniden başlatıldı",
        gpioBuzzerBtn:"Buzzer testi tamamlandı", gpioLedBtn:"LED testi tamamlandı", gpioCoil1Btn:"Bobin 1 testi tamamlandı", gpioCoil2Btn:"Bobin 2 testi tamamlandı",
    };
    document.addEventListener("click", event => {
        if (!window.GYMSOFT_DEMO_MODE) return;
        const id = event.target.closest("button")?.id;
        if (!id || !actions[id]) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        simulateDemoAction(actions[id], id === "quickRebootBtn" ? "warning" : "success");
    }, true);
}

async function refreshAgentBadge() {
    try {
        const data = await api("/api/agent-status", { method:"GET" });
        if ($("sidebarAgentText")) $("sidebarAgentText").textContent = `Agent ${data.version || "bağlı"}`;
        if ($("settingsAgentVersion")) $("settingsAgentVersion").textContent = `${data.name || "Gymsoft Local Agent"} · ${data.version || "bağlı"}`;
    } catch (err) {
        if ($("sidebarAgentText")) $("sidebarAgentText").textContent = "Agent bağlı değil";
        if ($("settingsAgentVersion")) $("settingsAgentVersion").textContent = "Agent bağlı değil · Deneyim modu kullanılabilir";
    }
}

function initExperienceUi() {
    initPageRouter();
    renderLiveAlarms([]); renderInventory(); renderAudit(); renderTurnTests(); renderWizard(); refreshAgentBadge(); refreshRealActivity();
    $("demoModeBtn")?.addEventListener("click", () => setDemoMode(!window.GYMSOFT_DEMO_MODE));
    $("demoModeSwitch")?.addEventListener("change", e => setDemoMode(e.target.checked));
    $("inventorySearch")?.addEventListener("input", renderInventory);
    $("inventoryFilter")?.addEventListener("change", renderInventory);
    $("inventoryAddBtn")?.addEventListener("click", () => {
        const n = demoInventory.length + 1;
        demoInventory.push({ customer:"Demo Salon", name:`Turnike ${n}`, ip:`192.168.1.${110+n}`, model:"Raspberry Pi 5", release:"v22.2", status:"online", temp:46.0, health:92, seen:"şimdi" });
        renderInventory(); demoLog(`Demo Salon / Turnike ${n} envantere eklendi`, "change");
    });
    $("demoClearAuditBtn")?.addEventListener("click", () => {
        if (window.GYMSOFT_DEMO_MODE) { demoAudit=[]; renderDemoActivity(); renderAudit(); }
        else refreshRealActivity();
    });
    $("auditFilter")?.addEventListener("change", renderAudit);
    $("demoReleaseBtn")?.addEventListener("click", () => {
        if (!window.GYMSOFT_DEMO_MODE) { refreshReleaseStatus({silent:false}); return; }
        const btn=$("demoReleaseBtn"); btn.disabled=true; $("demoReleaseResult").textContent="1/3 Konfigürasyon yedeği alınıyor…";
        setTimeout(()=>$("demoReleaseResult").textContent="2/3 v23.0 release indiriliyor…",600);
        setTimeout(()=>$("demoReleaseResult").textContent="3/3 Sağlık kontrolü yapılıyor…",1200);
        setTimeout(()=>{ $("demoReleaseResult").textContent="✓ Deneme güncellemesi tamamlandı."; $("demoInstalledRelease").textContent="v23.0"; if($("releaseCompareState")){ $("releaseCompareState").className="status success"; $("releaseCompareState").textContent="DEMO · GÜNCEL"; } btn.disabled=false; demoLog("v23.0 deneme güncellemesi tamamlandı","change"); },1800);
    });
    $("wizardStepper")?.addEventListener("click", e => { const b=e.target.closest("[data-step]"); if(!b)return; collectWizardStep(); demoWizardStep=Number(b.dataset.step); renderWizard(); });
    $("wizardContent")?.addEventListener("click", e => { const p=e.target.closest("[data-profile]"); if(!p)return; demoWizardData.profile=p.dataset.profile; renderWizard(); });
    $("wizardBackBtn")?.addEventListener("click", () => { collectWizardStep(); demoWizardStep=Math.max(1,demoWizardStep-1); renderWizard(); });
    $("wizardNextBtn")?.addEventListener("click", () => { collectWizardStep(); if(demoWizardStep<4){demoWizardStep++;renderWizard();} else { setStatus($("wizardStatus"),"Deneme tamamlandı","success"); demoLog(`${demoWizardData.ip} · ${demoWizardData.profile} kurulum akışı deneyimlendi`,"change"); } });
    $("startTurnTestBtn")?.addEventListener("click", () => {
        const run=++turnTestRunId, states={}; setStatus($("turnTestStatus"),"Test ediliyor","running");
        TURN_TESTS.forEach((_,i)=>setTimeout(()=>{ if(run!==turnTestRunId)return; states[i]="running"; renderTurnTests(states); setTimeout(()=>{ if(run!==turnTestRunId)return; states[i]="ok"; renderTurnTests(states); if(i===TURN_TESTS.length-1){setStatus($("turnTestStatus"),"7/7 başarılı","success");demoLog("Turnike test sihirbazı 7/7 başarılı","success");}},360); }, i*520));
    });
    $("resetTurnTestBtn")?.addEventListener("click",()=>{turnTestRunId++;renderTurnTests();setStatus($("turnTestStatus"),"Hazır","neutral");});
    $("networkQualityBtn")?.addEventListener("click",()=>{
        setStatus($("networkQualityState"),"Test ediliyor","running"); const items=[...$("networkQualityGrid").children]; items.forEach(i=>{i.className="quality-item";i.querySelector("strong").textContent="…";});
        setTimeout(()=>{ const values=[["4 ms","good"],["0%","good"],["OK","good"],["Açık","good"]]; items.forEach((item,i)=>{item.querySelector("strong").textContent=values[i][0];item.classList.add(values[i][1]);});setStatus($("networkQualityState"),"Bağlantı iyi","success");demoLog("Ağ kalite testi · 4 ms / %0 kayıp / SSH açık","success"); },900);
    });
    $("confirmCriticalSwitch")?.addEventListener("change", e => demoLog(`Kritik işlem onayı ${e.target.checked?'açıldı':'kapatıldı'}`,"change"));
    $("liveRefreshSwitch")?.addEventListener("change", e => { if(!e.target.checked && liveStatusTimer) clearTimeout(liveStatusTimer); else scheduleLiveStatus(100); });
    installDemoInterceptors();
}

initExperienceUi();


async function checkGitHubPagesAgent() {
    const state = document.getElementById("agentState");
    if (!state) return;
    state.textContent = `Kontrol ediliyor · ${API_BASE}`;
    state.className = "agent-checking";
    try {
        const data = await api("/api/agent-status", { method:"GET" });
        state.textContent = `Bağlı · ${data.name || "Gymsoft Local Agent"} · ${data.version || "v8"}`;
        state.className = "agent-online";
        if (data.default_cidr && document.getElementById("cidr")?.value === "192.168.1.0/24") document.getElementById("cidr").value = data.default_cidr;
        refreshAgentBadge();
    } catch (err) {
        state.textContent = `Bağlanamadı · GymsoftAgent.exe çalışmıyor (${API_BASE})`;
        state.className = "agent-offline";
    }
}


/* ========================================================================== 
   Gymsoft Raspberry Manager v9 — Interaction & feedback layer
   ========================================================================== */
window.GYMSOFT_AGENT_ONLINE = false;
let __uiConfirmResolve = null;
let __commandIndex = 0;
let __lastClickedButton = null;

function setActionDock(text, state = "ready") {
    const t = document.getElementById("uiActionText");
    const d = document.getElementById("uiActionDot");
    if (t) t.textContent = text;
    if (d) d.className = `ui-action-dot ${state}`;
}

function showToast(message, type = "info", title = "") {
    const stack = document.getElementById("uiToastStack");
    if (!stack) return;
    const text = String(message || "İşlem tamamlandı.");
    const resolvedTitle = title || ({success:"Başarılı", error:"İşlem başarısız", warning:"Dikkat", info:"Bilgi"}[type] || "Bilgi");
    const icon = ({success:"✓", error:"×", warning:"!", info:"i"}[type] || "i");
    const toast = document.createElement("div");
    toast.className = `ui-toast ${type}`;
    toast.innerHTML = `<span class="ui-toast-icon">${icon}</span><div><strong>${escapeHtml(resolvedTitle)}</strong><small>${escapeHtml(text)}</small></div><button type="button" aria-label="Bildirimi kapat">×</button>`;
    const remove = () => { if (!toast.isConnected) return; toast.classList.add("removing"); setTimeout(()=>toast.remove(),180); };
    toast.querySelector("button").addEventListener("click", remove);
    stack.prepend(toast);
    while (stack.children.length > 5) stack.lastElementChild.remove();
    setTimeout(remove, type === "error" ? 6500 : 4200);
}

// Existing alert() calls now become non-blocking in-app feedback.
window.alert = (message) => showToast(message, "warning");

function uiConfirm(message, options = {}) {
    const backdrop = document.getElementById("uiConfirmBackdrop");
    const msg = document.getElementById("uiConfirmMessage");
    const title = document.getElementById("uiConfirmTitle");
    if (!backdrop || !msg || !title) return Promise.resolve(window.confirm(String(message)));
    if (__uiConfirmResolve) { __uiConfirmResolve(false); __uiConfirmResolve = null; }
    title.textContent = options.title || "İşlemi onaylayın";
    msg.textContent = String(message || "Bu işlem devam ettirilsin mi?");
    backdrop.classList.remove("hidden");
    document.getElementById("uiConfirmOk")?.focus();
    return new Promise(resolve => { __uiConfirmResolve = resolve; });
}

function closeUiConfirm(result) {
    document.getElementById("uiConfirmBackdrop")?.classList.add("hidden");
    const resolve = __uiConfirmResolve; __uiConfirmResolve = null;
    if (resolve) resolve(Boolean(result));
}

// Enhanced status badge with action-center feedback.
function setStatus(el, text, type = "neutral") {
    if (!el) return;
    el.textContent = text;
    el.className = `status ${type}`;
    if (type === "running") setActionDock(text, "running");
    if (type === "success") setActionDock(text, "success");
    if (type === "error") setActionDock(text, "error");
}

function actionLabel(button) {
    if (!button) return "İşlem";
    return button.dataset.actionLabel || button.textContent.trim().replace(/\s+/g," ") || "İşlem";
}

function makeButtonFeelAlive(button) {
    if (!button || button.classList.contains("wizard-step")) return;
    button.classList.add("ui-pressed");
    setTimeout(()=>button.classList.remove("ui-pressed"), 150);
    setActionDock(`${actionLabel(button)} seçildi`, "running");
}

function isAgentRequiredButton(id) {
    return new Set([
        "scanBtn","verifyBtn","loadReleasesBtn","installBtn","changePasswordBtn","loadTurnSetupBtn","saveTurnSetupBtn",
        "networkSummaryBtn","networkProfilesBtn","networkActiveBtn","networkRefreshProfilesBtn","networkStaticBtn","networkDhcpBtn","networkDeleteBtn",
        "healthBtn","systemBtn","displayModesBtn","displayApplyBtn","displayInfoBtn","displayNormalBtn","displayLabwcBtn","screenshotBtn","dashScreenshotBtn",
        "gpioReadBtn","gpioSwitchBtn","gpioBuzzerBtn","gpioLedBtn","gpioCoil1Btn","gpioCoil2Btn","openTurnstileBtn","lockTurnstileBtn","dashOpenBtn","dashLockBtn","quickOpenBtn",
        "loadTurnstileConfigBtn","saveTurnstileConfigBtn","turnServiceStatusBtn","apacheRestartBtn","chromiumRestartBtn","gc3RestartBtn","quickKioskBtn","quickGc3Btn","quickRebootBtn",
        "diagnoseBtn","loadLogBtn","downloadBackupBtn","supportPackageBtn","precheckBtn","networkCheckIpBtn","releaseHistoryBtn","releaseRollbackBtn","agentUpdateCheckBtn","agentUpdateBtn"
    ]).has(id);
}

function decorateButtons() {
    document.querySelectorAll("button").forEach(btn => {
        if (!btn.title && btn.id && !btn.classList.contains("wizard-step")) btn.title = `${actionLabel(btn)} işlemini çalıştır`;
    });
}

function initV9ButtonFeedback() {
    document.addEventListener("click", event => {
        const btn = event.target.closest("button");
        if (!btn || btn.disabled) return;
        __lastClickedButton = btn;
        makeButtonFeelAlive(btn);
        if (!window.GYMSOFT_DEMO_MODE && !window.GYMSOFT_AGENT_ONLINE && isAgentRequiredButton(btn.id)) {
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
            setActionDock("Local Agent bağlantısı gerekli", "error");
            showToast("Bu işlem için GymsoftAgent.exe çalışıyor olmalı. İstersen Deneyim Modu ile arayüzü test edebilirsin.", "warning", "Local Agent bağlı değil");
        }
    }, true);

    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type !== "attributes" || record.attributeName !== "disabled") continue;
            const btn = record.target;
            if (!(btn instanceof HTMLButtonElement)) continue;
            if (btn.disabled && btn === __lastClickedButton) btn.classList.add("is-loading");
            if (!btn.disabled) btn.classList.remove("is-loading");
        }
    });
    document.querySelectorAll("button").forEach(btn => observer.observe(btn,{attributes:true}));
}

// More useful demo feedback than silent API failures.
function simulateDemoAction(label, type="success") {
    demoLog(label, type);
    if ($("quickResult")) { $("quickResult").classList.remove("muted"); $("quickResult").textContent = `Deneyim Modu: ${label}`; }
    setActionDock(label, type === "warning" ? "error" : "success");
    showToast(label, type === "warning" ? "warning" : "success", "Deneyim Modu");
}

function demoOutput(id, text) {
    const el = document.getElementById(id);
    if (el) { el.classList?.remove("muted"); el.textContent = text; }
}

function demoFinishButton(btn, label, message, type="success") {
    if (!btn) return;
    btn.classList.remove("is-loading"); btn.disabled = false;
    setActionDock(message, type === "error" ? "error" : "success");
    showToast(message, type, label);
}

function runV9DemoAction(id, btn) {
    const delay = (fn, ms=550) => { btn.disabled=true; btn.classList.add("is-loading"); setTimeout(fn,ms); };
    if (id === "scanBtn") {
        delay(()=>{ lastScanDevices = DEMO_INVENTORY.map(item=>({ip:item.ip,ssh:item.status!=="offline",http:item.status!=="offline",status:item.status==="offline"?"Çevrimdışı":"SSH adayı"})); renderDevices(lastScanDevices); setStatus($("scanState"),`${lastScanDevices.length} cihaz`,"success"); demoFinishButton(btn,"Ağ Tarama",`${lastScanDevices.length} demo cihaz bulundu.`); },700); return true;
    }
    if (id === "verifyBtn") {
        delay(()=>{ selectedDevice = selectedDevice || "192.168.1.101"; $("selectedIp").value=selectedDevice; verifiedDevices[selectedDevice]={is_raspberry:true,model:"Raspberry Pi 5 Model B",hostname:"GYM-TURNIKE-01",os:"Raspberry Pi OS 64-bit",arch:"aarch64"}; showDeviceInfo(verifiedDevices[selectedDevice]); applyDemoLiveStatus(); demoFinishButton(btn,"SSH Doğrulama","Raspberry Pi başarıyla doğrulandı."); },650); return true;
    }
    if (id === "loadReleasesBtn") {
        delay(()=>{ $("releaseSelect").innerHTML='<option value="v23.0">v23.0 — Güncel Release</option><option value="v22.2">v22.2 — Ekran Rotasyon Ayarları</option><option value="V22">V22 — V22.0</option>'; demoFinishButton(btn,"GitHub Release","3 release listelendi."); },650); return true;
    }
    if (id === "installBtn") {
        if ($("logBox")) $("logBox").textContent="[DEMO] 1/5 Raspberry bağlantısı doğrulandı…\n[DEMO] 2/5 Release indiriliyor…";
        setStatus($("jobState"),"Kuruluyor","running"); btn.disabled=true; btn.classList.add("is-loading");
        setTimeout(()=>{ if($("logBox")) $("logBox").textContent += "\n[DEMO] 3/5 Web dosyaları aktarıldı…\n[DEMO] 4/5 Kiosk ve ekran ayarlandı…"; },700);
        setTimeout(()=>{ if($("logBox")) $("logBox").textContent += "\n[DEMO] 5/5 Sağlık kontrolü başarılı.\n✓ Deneme kurulumu tamamlandı."; setStatus($("jobState"),"Tamamlandı","success"); demoFinishButton(btn,"Raspberry Kurulumu","Deneme kurulumu başarıyla tamamlandı."); demoLog("Demo Raspberry kurulumu tamamlandı","change"); },1450); return true;
    }
    if (id === "changePasswordBtn") { delay(()=>{ demoOutput("passwordResult","Deneyim Modu: parola değişikliği doğrulandı; gerçek cihaza yazılmadı."); setStatus($("passwordState"),"Değiştirildi","success"); demoFinishButton(btn,"Güvenlik","Parola değişikliği simüle edildi."); },600); return true; }
    if (id === "loadTurnSetupBtn") { delay(()=>{ $("turnSetupId").value="txdxky126"; $("turnSetupNumber").value="1"; $("turnLicenseKey").value="gzyb6jcm"; $("turnDomain").value="gymsoftx1.com"; demoOutput("turnSetupResult","Demo ayarları Raspberry üzerinden okunmuş gibi forma yüklendi."); setStatus($("turnSetupState"),"Okundu","success"); demoFinishButton(btn,"Turnike Kurulumu","Mevcut turnike ayarları yüklendi."); },550); return true; }
    if (id === "saveTurnSetupBtn") { delay(()=>{ setStatus($("turnSetupState"),"Kaydedildi","success"); demoOutput("turnSetupResult","Deneyim Modu: daySet.php ve set.php değerleri doğrulandı. Gerçek dosyaya yazılmadı."); demoFinishButton(btn,"Turnike Kurulumu","Turnike kimlik ve lisans ayarları kaydedildi."); },650); return true; }
    if (["networkSummaryBtn","networkProfilesBtn","networkActiveBtn","networkRefreshProfilesBtn"].includes(id)) {
        delay(()=>{ if(id==="networkRefreshProfilesBtn" && $("networkProfile")) $("networkProfile").innerHTML='<option>netplan-eth0</option><option>netplan-wlan0-Gymsoft</option>'; demoOutput("networkOutput","Bağlantı: netplan-eth0\nIP: 192.168.1.101/24\nGateway: 192.168.1.1\nDNS: 8.8.8.8\nDurum: connected"); setStatus($("networkState"),"Okundu","success"); demoFinishButton(btn,"Ağ","Ağ bilgileri güncellendi."); },520); return true;
    }
    if (["networkStaticBtn","networkDhcpBtn","networkDeleteBtn"].includes(id)) {
        delay(()=>{ demoOutput("networkOutput",`Deneyim Modu: ${actionLabel(btn)} simüle edildi. SSH bağlantısı etkilenmedi.`); setStatus($("networkState"),"Demo tamamlandı","success"); demoFinishButton(btn,"Ağ Ayarı",`${actionLabel(btn)} simüle edildi.`, id==="networkDeleteBtn"?"warning":"success"); },650); return true;
    }
    if (id === "healthBtn") { delay(()=>{ demoOutput("healthOutput","Sıcaklık : 47.6 °C\nCPU      : %28\nRAM      : %46\nDisk     : %32\nVoltaj   : 1.20V\nThrottled: 0x0\nDurum    : NORMAL"); setStatus($("healthState"),"Sağlıklı","success"); demoFinishButton(btn,"Sağlık","Sağlık verileri alındı."); },520); return true; }
    if (id === "systemBtn") { delay(()=>{ demoOutput("systemOutput","Model    : Raspberry Pi 5 Model B Rev 1.0\nOS       : Raspberry Pi OS 64-bit\nKernel   : 6.6.x-rpi\nHostname : GYM-TURNIKE-01\nMimari   : aarch64\nUptime   : 2 gün 4 saat"); setStatus($("systemState"),"Okundu","success"); demoFinishButton(btn,"Sistem","Sistem bilgileri getirildi."); },520); return true; }
    if (["displayModesBtn","displayInfoBtn","displayLabwcBtn"].includes(id)) { delay(()=>{ if($("displayModeSelect")) $("displayModeSelect").innerHTML='<option value="1280x720">1280x720 (aktif)</option><option value="1920x1080">1920x1080</option>'; demoOutput("displayOutput","HDMI-A-1 connected\n1280x720 @ 60Hz\nTransform: normal\nlabwc autostart: aktif"); setStatus($("displayState"),"Okundu","success"); demoFinishButton(btn,"Ekran","Ekran bilgileri okundu."); },520); return true; }
    if (["displayApplyBtn","displayNormalBtn"].includes(id)) { delay(()=>{ demoOutput("displayOutput",`Deneyim Modu: ${$("displayModeSelect")?.value||"1280x720"} / ${$("displayDirection")?.value||"normal"} uygulandı.`); setStatus($("displayState"),"Uygulandı","success"); demoFinishButton(btn,"Ekran",`${actionLabel(btn)} tamamlandı.`); },620); return true; }
    if (["screenshotBtn","dashScreenshotBtn"].includes(id)) {
        delay(()=>{ const box=$("screenPreview"); if(box){ box.classList.remove("has-image"); box.innerHTML='<div class="demo-screen"><strong>GYMSOFT Turnike Sistemi</strong><span>Lütfen kartınızı okutun</span><small>Demo ekran görüntüsü · 1280×720</small></div>'; } setStatus($("screenshotState"),"Demo görüntü","success"); demoFinishButton(btn,"Ekran Görüntüsü","Demo kiosk görüntüsü alındı."); },650); return true;
    }
    if (["gpioReadBtn","gpioSwitchBtn"].includes(id)) { delay(()=>{ renderGpioPins({switch:21,coil1:6,coil2:5,buzzer:13,led:11}); demoOutput("gpioResult", id==="gpioSwitchBtn"?"Switch durumu: KAPALI":"GPIO pinleri gc3.py üzerinden okundu."); setStatus($("gpioState"),"Tamamlandı","success"); demoFinishButton(btn,"GPIO",id==="gpioSwitchBtn"?"Switch durumu okundu.":"GPIO pinleri okundu."); },450); return true; }
    if (id === "loadTurnstileConfigBtn") { delay(()=>{ $("turnDirection").value="cift"; $("transitionSeconds").value="9"; $("turnColorHex").value="#00b8d9"; $("turnColor").value="#00b8d9"; $("colorPreview").style.background="#00b8d9"; setStatus($("turnstileState"),"Okundu","success"); demoFinishButton(btn,"Turnike Ayarları","Mevcut yön, süre ve renk okundu."); },520); return true; }
    if (id === "saveTurnstileConfigBtn") { delay(()=>{ setStatus($("turnstileState"),"Kaydedildi","success"); demoOutput("turnstileActionResult","Deneyim Modu: yön / süre / renk ayarları kaydedildi."); demoFinishButton(btn,"Turnike Ayarları","Turnike ayarları kaydedildi."); },600); return true; }
    if (id === "turnServiceStatusBtn") { delay(()=>{ demoOutput("turnServiceOutput","Apache    : active ✓\nChromium  : running ✓\ngc3.py    : hazır / beklemede ✓\nKiosk URL : HTTP 200 ✓"); demoFinishButton(btn,"Servisler","Turnike servisleri aktif."); },500); return true; }
    if (id === "diagnoseBtn") { delay(()=>{ demoOutput("diagnoseOutput","=== GYMSOFT HIZLI ARIZA TESPİTİ ===\n✓ Raspberry: ONLINE\n✓ Apache: active\n✓ gircik.php: HTTP 200\n✓ gc3.py: hazır (event-driven)\n✓ Chromium: running\n✓ Gateway: 4 ms\n✓ Throttled: 0x0\n\nSONUÇ: Kritik arıza bulunamadı."); setStatus($("diagnoseState"),"Sorun yok","success"); demoFinishButton(btn,"Arıza Tespiti","Hızlı teşhis tamamlandı; kritik sorun yok."); },900); return true; }
    if (id === "loadLogBtn") { delay(()=>{ demoOutput("maintenanceOutput","12:01:14 [INFO] Apache aktif\n12:01:15 [INFO] gc3.py dosyası hazır; event-driven beklemede\n12:01:16 [INFO] Chromium kiosk HTTP 200\n12:01:17 [INFO] sıcaklık=47.6°C cpu=28%\n12:01:18 [INFO] sağlık kontrol döngüsü tamamlandı"); setStatus($("maintenanceState"),"Log okundu","success"); demoFinishButton(btn,"Log Merkezi","Demo logları getirildi."); },550); return true; }
    if (id === "downloadBackupBtn") { delay(()=>{ demoOutput("maintenanceOutput","Deneyim Modu: gymsoft-config-demo.tar.gz yedeği oluşturuldu (indirme simüle edildi)."); setStatus($("maintenanceState"),"Yedek hazır","success"); demoFinishButton(btn,"Yedekleme","Konfigürasyon yedeği hazırlandı."); },650); return true; }
    return false;
}

function installV9DemoInterceptors() {
    document.addEventListener("click", event => {
        if (!window.GYMSOFT_DEMO_MODE) return;
        const btn = event.target.closest("button");
        if (!btn || btn.disabled) return;
        const handled = runV9DemoAction(btn.id, btn);
        if (handled) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
    }, true);
}

// Inventory cards are now real selectable controls.
function renderInventory() {
    if (!$("inventoryGrid") || !$("inventoryStatus")) return;
    const q = ($("inventorySearch")?.value || "").trim().toLowerCase();
    const filter = $("inventoryFilter")?.value || "all";
    const list = demoInventory.filter(item => {
        const matches = !q || `${item.customer} ${item.name} ${item.ip} ${item.model} ${item.release}`.toLowerCase().includes(q);
        return matches && (filter === "all" || item.status === filter);
    });
    $("inventoryStatus").textContent = `${list.length} / ${demoInventory.length} cihaz`;
    $("inventoryGrid").innerHTML = list.map(item => {
        const temp = item.temp === null ? "--" : `${item.temp.toFixed(1)} °C`;
        const selected = selectedDevice === item.ip ? " selected" : "";
        return `<button type="button" class="inventory-card-button${selected}" data-demo-device-ip="${item.ip}"><span class="inventory-state ${item.status}"></span><span class="customer">${escapeHtml(item.customer)}</span><h3>${escapeHtml(item.name)}</h3><div class="inventory-meta"><div><span>IP</span><strong>${item.ip}</strong></div><div><span>Model</span><strong>${escapeHtml(item.model)}</strong></div><div><span>Sürüm</span><strong>${item.release}</strong></div><div><span>Sıcaklık</span><strong>${temp}</strong></div></div><div class="health-score"><div class="health-score-track"><div class="health-score-fill" style="width:${item.health}%"></div></div><strong>${item.health}/100</strong></div><div class="mini-result">Son görülme: ${item.seen}</div><div class="select-hint">Cihazı seçmek için tıklayın →</div></button>`;
    }).join("") || `<div class="info-box muted">Filtreye uygun cihaz bulunamadı.</div>`;
}

function selectDemoInventoryDevice(ip) {
    const item = demoInventory.find(x=>x.ip===ip); if(!item) return;
    selectedDevice = item.ip; $("selectedIp").value=item.ip;
    verifiedDevices[item.ip]={is_raspberry:item.status!=="offline",model:item.model,hostname:`GYM-${item.name.replace(/\s+/g,"-").toUpperCase()}`,os:"Raspberry Pi OS",arch:item.model.includes("5")?"aarch64":"armv7l"};
    if (item.status !== "offline") showDeviceInfo(verifiedDevices[item.ip]);
    $("dashDeviceName").textContent=`${item.customer} · ${item.name}`;
    $("dashDeviceMeta").textContent=`${item.ip} · ${item.model} · ${item.release}`;
    renderInventory();
    if(item.status!=="offline") applyDemoLiveStatus(); else setLiveConnection("Çevrimdışı",false);
    renderDemoAlarms(); renderDemoActivity();
    showToast(`${item.customer} / ${item.name} seçildi.`,"success","Aktif cihaz değişti");
    setActionDock(`${item.name} aktif cihaz olarak seçildi`,"success");
}

const COMMANDS = [
    {label:"Dashboard'a git", desc:"Genel durum ve alarmlar", page:"dashboard", icon:"⌂"},
    {label:"Ağı tara", desc:"Yerel ağdaki cihazları bul", page:"devices", target:"scanBtn", icon:"⌁"},
    {label:"Raspberry'yi doğrula", desc:"SSH üzerinden cihaz modelini kontrol et", page:"devices", target:"verifyBtn", icon:"✓"},
    {label:"Kurulum ön kontrolünü çalıştır", desc:"İnternet, disk, gateway ve GitHub erişimini doğrula", page:"installation", target:"precheckBtn", icon:"✓"},
    {label:"Geçiş izni ver", desc:"Turnikeden tek geçişe izin ver", page:"turnstile", target:"openTurnstileBtn", icon:"↔"},
    {label:"Turnikeyi kilitle", desc:"Aktif geçişi sonlandır", page:"turnstile", target:"lockTurnstileBtn", icon:"■"},
    {label:"Kiosk restart", desc:"Chromium kiosk servisini yeniden başlat", page:"turnstile", target:"chromiumRestartBtn", icon:"↻"},
    {label:"Ekran görüntüsü al", desc:"Kiosk ekranını görüntüle", page:"hardware", target:"screenshotBtn", icon:"▣"},
    {label:"GPIO pinlerini oku", desc:"gc3.py pin yapılandırmasını göster", page:"hardware", target:"gpioReadBtn", icon:"⚡"},
    {label:"Ağ özetini getir", desc:"IP, gateway ve DNS bilgileri", page:"network", target:"networkSummaryBtn", icon:"⌁"},
    {label:"Sağlık bilgilerini getir", desc:"Sıcaklık, CPU, RAM, disk, throttled", page:"health", target:"healthBtn", icon:"♥"},
    {label:"Hızlı arıza tespiti", desc:"Servis ve ağ kontrollerini tek raporda çalıştır", page:"diagnostics", target:"diagnoseBtn", icon:"!"},
    {label:"Teknik destek paketi oluştur", desc:"Sistem, ağ ve servis loglarını tek arşivde indir", page:"diagnostics", target:"supportPackageBtn", icon:"↓"},
    {label:"Release geçmişini göster", desc:"Kurulum ve rollback geçmişini oku", page:"dashboard", target:"releaseHistoryBtn", icon:"↺"},
    {label:"Deneyim Modunu aç/kapat", desc:"Raspberry olmadan arayüzü deneyimle", page:"dashboard", target:"demoModeBtn", icon:"◇"},
];

function filteredCommands() {
    const q=(document.getElementById("commandPaletteSearch")?.value||"").trim().toLowerCase();
    return COMMANDS.filter(c=>!q||`${c.label} ${c.desc} ${c.page}`.toLowerCase().includes(q));
}
function renderCommandPalette() {
    const list=document.getElementById("commandPaletteList"); if(!list)return;
    const commands=filteredCommands(); __commandIndex=Math.max(0,Math.min(__commandIndex,commands.length-1));
    list.innerHTML=commands.map((c,i)=>`<button type="button" class="command-item ${i===__commandIndex?'active':''}" data-command-index="${i}"><span class="command-icon">${c.icon}</span><span><strong>${escapeHtml(c.label)}</strong><small>${escapeHtml(c.desc)}</small></span><span class="command-page">${escapeHtml(c.page)}</span></button>`).join("") || '<div class="info-box muted">Komut bulunamadı.</div>';
}
function openCommandPalette() { document.getElementById("commandPaletteBackdrop")?.classList.remove("hidden"); __commandIndex=0; renderCommandPalette(); setTimeout(()=>document.getElementById("commandPaletteSearch")?.focus(),30); }
function closeCommandPalette() { document.getElementById("commandPaletteBackdrop")?.classList.add("hidden"); }
function runCommandAt(index) { const c=filteredCommands()[index]; if(!c)return; closeCommandPalette(); navigateToPage(c.page); if(c.target)setTimeout(()=>document.getElementById(c.target)?.click(),180); else showToast(`${c.label} açıldı.`,"info"); }

// Enhanced Agent check with visible body state.
async function checkGitHubPagesAgent() {
    const state = document.getElementById("agentState");
    if (!state) return;
    state.textContent = `Kontrol ediliyor · ${API_BASE}`; state.className="agent-checking";
    setActionDock("Local Agent kontrol ediliyor", "running");
    try {
        const data = await api("/api/agent-status", {method:"GET"});
        window.GYMSOFT_AGENT_ONLINE=true; document.body.classList.remove("agent-offline-mode");
        state.textContent=`Bağlı · ${data.name||"Gymsoft Local Agent"} · ${data.version||"v11"}`; state.className="agent-online";
        if(data.default_cidr && document.getElementById("cidr")?.value==="192.168.1.0/24") document.getElementById("cidr").value=data.default_cidr;
        refreshAgentBadge(); setActionDock("Local Agent bağlı", "success");
    } catch(err) {
        window.GYMSOFT_AGENT_ONLINE=false; document.body.classList.add("agent-offline-mode");
        state.textContent=`Bağlanamadı · GymsoftAgent.exe çalışmıyor (${API_BASE})`; state.className="agent-offline";
        setActionDock("Local Agent bağlı değil · Demo kullanılabilir", "error");
    }
}

function initV9Ux() {
    decorateButtons(); initV9ButtonFeedback(); installV9DemoInterceptors();
    document.getElementById("uiConfirmCancel")?.addEventListener("click",()=>closeUiConfirm(false));
    document.getElementById("uiConfirmOk")?.addEventListener("click",()=>closeUiConfirm(true));
    document.getElementById("uiConfirmBackdrop")?.addEventListener("click",e=>{if(e.target.id==="uiConfirmBackdrop")closeUiConfirm(false);});
    document.getElementById("commandPaletteBtn")?.addEventListener("click",openCommandPalette);
    document.getElementById("commandPaletteBackdrop")?.addEventListener("click",e=>{if(e.target.id==="commandPaletteBackdrop")closeCommandPalette();});
    document.getElementById("commandPaletteSearch")?.addEventListener("input",()=>{__commandIndex=0;renderCommandPalette();});
    document.getElementById("commandPaletteList")?.addEventListener("click",e=>{const b=e.target.closest("[data-command-index]");if(b)runCommandAt(Number(b.dataset.commandIndex));});
    document.getElementById("inventoryGrid")?.addEventListener("click",e=>{const card=e.target.closest("[data-demo-device-ip]");if(card)selectDemoInventoryDevice(card.dataset.demoDeviceIp);});
    document.addEventListener("keydown",e=>{
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();const open=!document.getElementById("commandPaletteBackdrop")?.classList.contains("hidden");open?closeCommandPalette():openCommandPalette();return;}
        if(e.key==="Escape"){closeCommandPalette();if(!document.getElementById("uiConfirmBackdrop")?.classList.contains("hidden"))closeUiConfirm(false);return;}
        if(!document.getElementById("commandPaletteBackdrop")?.classList.contains("hidden")){
            const cmds=filteredCommands(); if(e.key==="ArrowDown"){e.preventDefault();__commandIndex=Math.min(cmds.length-1,__commandIndex+1);renderCommandPalette();} if(e.key==="ArrowUp"){e.preventDefault();__commandIndex=Math.max(0,__commandIndex-1);renderCommandPalette();} if(e.key==="Enter"){e.preventDefault();runCommandAt(__commandIndex);}
        }
    });
    showToast("v13 güvenli servis merkezi hazır. Butonlar artık işlem durumu ve sonuç bildirimi gösterir.","info","Arayüz güncellendi");
}


async function checkAgentUpdate(){
    if(window.GYMSOFT_DEMO_MODE){$("agentUpdateVersion").textContent="v12 → v13-demo";$("agentUpdateNote").textContent="Deneyim Modu: yeni Agent sürümü bulundu.";$("agentUpdateBtn").disabled=false;return {available:true};}
    try{const data=await api('/api/agent/update-status',{method:'GET'});const text=data.latest?`${data.current} → ${data.latest}`:`${data.current} · yayın manifesti bekleniyor`;$("agentUpdateVersion").textContent=text;$("agentUpdateNote").textContent=data.warning?`Manifest okunamadı: ${data.warning}`:data.available?'Yeni Agent hazır. Güncelleme EXE’yi indirip Agent’ı yeniden başlatır.':'Agent güncel veya yayın dosyası henüz hazırlanmadı.';$("agentUpdateBtn").disabled=!data.available;showToast(data.available?'Yeni Agent güncellemesi mevcut.':'Agent için yeni sürüm bulunamadı.',data.available?'warning':'success','Agent Güncelleme');return data;}catch(err){$("agentUpdateNote").textContent=err.message;showToast(err.message,'error','Agent Güncelleme');}
}
$("agentUpdateCheckBtn")?.addEventListener('click',checkAgentUpdate);
$("agentUpdateBtn")?.addEventListener('click',async()=>{if(window.GYMSOFT_DEMO_MODE){showToast("Deneyim Modu: Agent güncelleme ve yeniden başlatma akışı simüle edildi.","success","Agent Güncelleme");return;}if(!await uiConfirm('Yeni GymsoftAgent.exe indirilsin ve Local Agent yeniden başlatılsın mı?',{title:'Agent Güncelleme'}))return;const btn=$("agentUpdateBtn");try{btn.disabled=true;const data=await api('/api/agent/update',{method:'POST',body:'{}'});showToast(data.message||'Agent yeniden başlatılıyor.','success','Agent Güncelleme');}catch(err){showToast(err.message,'error','Agent Güncelleme');btn.disabled=false;}});

initV9Ux();


// v11: Cihazlar ve SSH aynı sayfada; kurulum sayfası sadece kurulum işlerini gösterir.
(function mountSshOnDevicesPage(){
    const mount=$("devicesSshMount"), panel=$("sshPanel");
    if(mount && panel) mount.appendChild(panel);
})();
let __releaseTokenTimer=null;
$("githubToken")?.addEventListener("input",()=>{
    clearTimeout(__releaseTokenTimer);
    __releaseTokenTimer=setTimeout(()=>refreshReleaseStatus({silent:true}),700);
});


/* ========================================================================== 
   Gymsoft Raspberry Manager v13 — Login gate + Agent download bootstrap
   ========================================================================== */
let __authSetupMode=false;
let __authBootBusy=false;
function lockApplication(){ document.body.classList.add("auth-locked"); }
function unlockApplication(){
    document.body.classList.remove("auth-locked");
    $("authGate")?.classList.add("hidden");
    $("agentDownloadGate")?.classList.add("hidden");
    $("authLogoutBtn")?.classList.remove("hidden");
}
function showAgentDownloadGate(){
    lockApplication();
    $("authGate")?.classList.add("hidden");
    const gate=$("agentDownloadGate"); gate?.classList.remove("hidden");
    const link=$("agentDownloadBtn"); if(link) link.href=String(window.GYMSOFT_AGENT_DOWNLOAD_URL||"./downloads/GymsoftAgent.exe");
    $("authLogoutBtn")?.classList.add("hidden");
}
function showAuthGate({setup=false,message=""}={}){
    lockApplication(); __authSetupMode=!!setup;
    $("agentDownloadGate")?.classList.add("hidden");
    $("authGate")?.classList.remove("hidden");
    $("authPasswordRepeatRow")?.classList.toggle("hidden",!setup);
    $("authGateTitle").textContent=setup?"İlk Yönetici Hesabını Oluştur":"Raspberry Manager'a Giriş";
    $("authGateText").textContent=message||(setup?"Bu bilgisayardaki Local Agent için ilk yönetici hesabını oluşturun. Parola geri okunabilir biçimde saklanmaz.":"Devam etmek için yönetici hesabınızla giriş yapın.");
    $("authSubmitBtn").textContent=setup?"Hesabı Oluştur ve Giriş Yap":"Giriş Yap";
    $("authPassword").autocomplete=setup?"new-password":"current-password";
    $("authError")?.classList.add("hidden");
    $("authLogoutBtn")?.classList.add("hidden");
    setTimeout(()=>$("authUsername")?.focus(),60);
}
function authError(text){ const box=$("authError"); if(!box)return; box.textContent=text; box.classList.remove("hidden"); }
async function bootstrapAuth(){
    try{
        const status=await api("/api/auth/status",{method:"GET"});
        if(status.authenticated){ unlockApplication(); return true; }
        if(!status.configured){ showAuthGate({setup:true}); return false; }
        showAuthGate({setup:false}); return false;
    }catch(err){ showAuthGate({setup:false,message:err.message}); return false; }
}
$("authForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const username=$("authUsername").value.trim(), password=$("authPassword").value, repeat=$("authPasswordRepeat").value;
    if(__authSetupMode && password!==repeat){ authError("Parolalar eşleşmiyor."); return; }
    const btn=$("authSubmitBtn"); btn.disabled=true; $("authError")?.classList.add("hidden");
    try{
        const endpoint=__authSetupMode?"/api/auth/setup":"/api/auth/login";
        const data=await api(endpoint,{method:"POST",body:JSON.stringify({username,password})});
        setAuthToken(data.token||"");
        $("authPassword").value=""; $("authPasswordRepeat").value="";
        unlockApplication();
        showToast(`Oturum açıldı · ${data.username||username}`,"success","Güvenli Giriş");
        checkGitHubPagesAgent();
    }catch(err){ authError(err.message); }
    finally{ btn.disabled=false; }
});
$("authLogoutBtn")?.addEventListener("click",async()=>{
    try{ await api("/api/auth/logout",{method:"POST",body:"{}"}); }catch(_e){}
    setAuthToken(""); showAuthGate({setup:false,message:"Oturum kapatıldı. Tekrar giriş yapın."});
});
$("agentGateRetryBtn")?.addEventListener("click",()=>checkGitHubPagesAgent());

async function checkGitHubPagesAgent(){
    if(__authBootBusy)return; __authBootBusy=true;
    const state=$("agentState");
    if(state){state.textContent=`Kontrol ediliyor · ${API_BASE}`;state.className="agent-checking";}
    try{
        const data=await api("/api/agent-status",{method:"GET"});
        window.GYMSOFT_AGENT_ONLINE=true;document.body.classList.remove("agent-offline-mode");
        if(state){state.textContent=`Bağlı · ${data.name||"Gymsoft Local Agent"} · ${data.version||"v13"}`;state.className="agent-online";}
        if(data.default_cidr && $("cidr")?.value==="192.168.1.0/24") $("cidr").value=data.default_cidr;
        refreshAgentBadge(); setActionDock("Local Agent bağlı · giriş kontrol ediliyor","success");
        await bootstrapAuth();
    }catch(err){
        window.GYMSOFT_AGENT_ONLINE=false;document.body.classList.add("agent-offline-mode");setAuthToken("");
        if(state){state.textContent=`Bağlanamadı · GymsoftAgent.exe çalışmıyor (${API_BASE})`;state.className="agent-offline";}
        setActionDock("Local Agent gerekli","error"); showAgentDownloadGate();
    }finally{__authBootBusy=false;}
}

// Existing banner retry now uses the secure bootstrap.
$("agentCheckBtn")?.addEventListener("click",()=>checkGitHubPagesAgent());
// Start from a locked page every time; sessionStorage token can unlock only after Agent validation.
lockApplication();
setTimeout(()=>checkGitHubPagesAgent(),30);
