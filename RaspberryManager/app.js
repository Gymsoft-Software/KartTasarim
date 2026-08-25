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
async function api(url, options = {}) {
    const response = await fetch(apiUrl(url), {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : { ok: response.ok, error: await response.text() };
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
    $("dashGc3").textContent = status.gc3_active ? "AKTİF" : "KAPALI";
    $("dashDeviceName").textContent = `${status.hostname || "Raspberry"} · ${selectedDevice}`;
    $("dashTempNote").textContent = status.throttled && status.throttled !== "throttled=0x0" && status.throttled !== "0x0" ? status.throttled : "normal çalışma";

    const throttleBad = status.throttled && !String(status.throttled).endsWith("0x0");
    const bad = !status.apache_active || !status.network_active || (temp !== null && temp >= 80);
    const warn = throttleBad || !status.gc3_active || (temp !== null && temp >= 70) || cpu >= 85 || disk >= 90;
    const badge = $("dashHealthBadge");
    badge.className = `dashboard-health ${bad ? "bad" : warn ? "warn" : "ok"}`;
    badge.textContent = bad ? "KRİTİK" : warn ? "DİKKAT" : "NORMAL";
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
        $("liveTurnstile").textContent = `${s.apache_active ? "Apache ✓" : "Apache ×"} · ${s.gc3_active ? "gc3 ✓" : "gc3 ×"}`;
        updateDashboard(s);
    } catch (err) {
        setLiveConnection("Bağlantı yok", false);
        $("liveNetwork").textContent = "--";
        $("liveTurnstile").textContent = "--";
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

    if (!confirm(`${selectedDevice} cihazına Gymsoft kurulumu başlatılsın mı?`)) return;

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
        if (!confirm(`${selectedDevice} cihazındaki turnike ayarları değiştirilsin mi?`)) return;

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
        if (!confirm(message)) return;

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
        if (!confirm(`${selectedDevice} üzerindeki ${target.username} kullanıcısının SSH parolası değiştirilsin mi?`)) return;

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

        if (!confirm(`${selectedDevice} üzerindeki daySet.php ve set.php lisans/turnike bilgileri değiştirilsin mi?`)) return;
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

async function changeNetwork(action) {
    const profile = $("networkProfile").value;
    if (!profile) return alert("Önce NetworkManager bağlantı profilini seçin.");

    let message = "";
    if (action === "static") {
        if (!$("networkAddress").value.trim() || !$("networkGateway").value.trim()) {
            return alert("Statik IP için IP/CIDR ve Gateway alanları zorunludur.");
        }
        message = `${selectedDevice} üzerindeki ${profile} profili statik IP'ye geçirilecek. SSH bağlantısı kesilebilir. Devam edilsin mi?`;
    } else if (action === "dhcp") {
        message = `${selectedDevice} üzerindeki ${profile} profili DHCP'ye alınacak. Cihazın IP adresi değişebilir ve SSH bağlantısı kesilebilir. Devam edilsin mi?`;
    } else {
        message = `${selectedDevice} üzerindeki ${profile} bağlantı profili SİLİNECEK. Aktif profilse bağlantı tamamen kesilebilir. Devam edilsin mi?`;
    }
    if (!confirm(message)) return;

    const buttonId = action === "static" ? "networkStaticBtn" : action === "dhcp" ? "networkDhcpBtn" : "networkDeleteBtn";
    try {
        const target = requireToolTarget();
        const btn = $(buttonId);
        btn.disabled = true;
        setStatus($("networkState"), "Uygulanıyor", "running");
        $("networkOutput").textContent = "Ağ ayarı Raspberry Pi'ye gönderiliyor…";
        const data = await api("/api/tools/network/change", {
            method: "POST",
            body: JSON.stringify({
                ...target,
                action,
                profile,
                address: $("networkAddress").value.trim(),
                gateway: $("networkGateway").value.trim(),
                dns: $("networkDns").value.trim(),
            }),
        });
        $("networkOutput").textContent = data.output || "Ağ ayarı uygulandı.";
        setStatus($("networkState"), "Gönderildi", "success");
    } catch (err) {
        $("networkOutput").textContent = `Hata: ${err.message}\n\nNot: Ağ değişikliği uygulanmışsa SSH bağlantısı işlem sırasında kesilmiş olabilir.`;
        setStatus($("networkState"), "Bağlantı değişti / Hata", "error");
    } finally {
        $(buttonId).disabled = false;
    }
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
    if (!confirm(`${selectedDevice || "Seçili cihaz"} ekranı normal yöne alınsın mı?`)) return;
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
    if (confirmText && !confirm(confirmText)) return;
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
$("gc3RestartBtn").addEventListener("click", () => runTurnService("gc3_restart", "gc3RestartBtn", "gc3.py yeniden başlatılsın mı?"));

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
        if (confirmText && !confirm(confirmText)) return;
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
        if (!confirm(`${selectedDevice} ekranı ${mode} / ${direction} olarak değiştirilsin ve labwc için kalıcılaştırılsın mı?`)) return;
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

async function rebootDevice(buttonId = "quickRebootBtn") {
    const btn = $(buttonId);
    try {
        const target = requireToolTarget();
        if (!confirm(`${selectedDevice} yeniden başlatılsın mı? SSH bağlantısı geçici olarak kesilecektir.`)) return;
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
$("quickGc3Btn")?.addEventListener("click", () => runTurnService("gc3_restart", "quickGc3Btn", "gc3.py yeniden başlatılsın mı?"));
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

const PAGE_META = {
    dashboard: ["YÖNETİM MERKEZİ", "Dashboard", "Tüm turnike ve Raspberry cihazlarının genel görünümü."],
    devices: ["ENVANTER", "Cihazlar", "Ağ taraması, Raspberry doğrulama ve müşteri / salon envanteri."],
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
const TURN_TESTS = ["Bobin 1", "Bobin 2", "Buzzer", "LED", "Switch", "Apache / gircik.php", "gc3.py servisi"];
let turnTestRunId = 0;
let demoAudit = [
    { time: "10:42:18", user: "Teknik-1", text: "Conan Fit / Turnike 1 · Kiosk yeniden başlatıldı", type: "success" },
    { time: "10:39:02", user: "Teknik-2", text: "X Fitness / Turnike 1 · throttled=0x50005 uyarısı görüldü", type: "warning" },
    { time: "10:35:44", user: "Teknik-1", text: "Power Zone / Turnike 3 · Release v22.2 kuruldu", type: "change" },
    { time: "10:31:07", user: "Teknik-3", text: "Conan Fit / Turnike 2 · IP 192.168.1.42 → 192.168.1.102", type: "change" },
];

function demoLog(text, type = "success") {
    const now = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    demoAudit.unshift({ time: now, user: "Demo Kullanıcı", text, type });
    demoAudit = demoAudit.slice(0, 20);
    renderDemoActivity();
    renderAudit();
}

function renderDemoAlarms() {
    const items = [
        ["critical", "Atlantis Gym / Turnike 1", "Cihaz çevrimdışı · son görülme 18 dk önce", "18 dk"],
        ["warning", "X Fitness / Turnike 1", "72.1°C · throttled geçmişi tespit edildi", "12 sn"],
        ["info", "Release güncellemesi", "v23.0 yayınlandı · 4 cihaz güncellenebilir", "yeni"],
    ];
    $("demoAlarmList").innerHTML = items.map(([type,title,detail,time]) => `<div class="alarm-item"><span class="alarm-dot ${type}"></span><div><strong>${title}</strong><small>${detail}</small></div><time>${time}</time></div>`).join("");
}

function renderDemoActivity() {
    const list = demoAudit.slice(0, 5);
    $("demoRecentActivity").innerHTML = list.length ? list.map(item => `<div class="timeline-item"><time>${item.time}</time><span class="timeline-marker"></span><div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.user)}</small></div></div>`).join("") : `<div class="info-box muted">İşlem geçmişi temizlendi.</div>`;
}

function renderInventory() {
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
    const t = 48 + (Math.random() * 2 - 1);
    const cpu = 22 + Math.random() * 14;
    const status = { temperature:t, cpu_percent:cpu, ram_percent:46.2, disk_percent:31.8, throttled:"throttled=0x0", network_active:true, uptime_seconds:218400, apache_active:true, gc3_active:true, hostname:"GYM-TURNIKE-01" };
    setLiveConnection("Aktif · Demo", true);
    $("liveDevice").textContent = "192.168.1.101 · GYM-TURNIKE-01";
    $("liveTemp").textContent = `${t.toFixed(1)} °C`;
    $("liveCpu").textContent = `${cpu.toFixed(1)}%`;
    $("liveRam").textContent = "46.2%";
    $("liveDisk").textContent = "31.8%";
    $("liveThrottle").textContent = "0x0";
    $("liveNetwork").textContent = "Aktif · 60s 40dk";
    $("liveTurnstile").textContent = "Apache ✓ · gc3 ✓";
    updateDashboard(status);
}

function setDemoMode(enabled) {
    window.GYMSOFT_DEMO_MODE = Boolean(enabled);
    document.body.classList.toggle("demo-mode", window.GYMSOFT_DEMO_MODE);
    $("demoModeBtn").classList.toggle("demo-active", window.GYMSOFT_DEMO_MODE);
    $("demoModeBtn").textContent = window.GYMSOFT_DEMO_MODE ? "Deneyim Modu: Açık" : "Deneyim Modu";
    if ($("demoModeSwitch")) $("demoModeSwitch").checked = window.GYMSOFT_DEMO_MODE;
    if ($("sidebarModeText")) $("sidebarModeText").textContent = window.GYMSOFT_DEMO_MODE ? "Deneyim modu aktif" : "Gerçek cihaz modu";
    if (window.GYMSOFT_DEMO_MODE) {
        selectedDevice = "192.168.1.101";
        verifiedDevices[selectedDevice] = { is_raspberry:true, model:"Raspberry Pi 5 Model B", hostname:"GYM-TURNIKE-01", os:"Raspberry Pi OS", arch:"aarch64" };
        lastScanDevices = DEMO_INVENTORY.map(item => ({ ip:item.ip, ssh:item.status!=="offline", http:item.status!=="offline", status:item.status === "offline" ? "Çevrimdışı" : "SSH adayı" }));
        $("selectedIp").value = selectedDevice;
        renderDevices(lastScanDevices);
        showDeviceInfo(verifiedDevices[selectedDevice]);
        applyDemoLiveStatus();
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
    }
    scheduleLiveStatus(100);
}

function simulateDemoAction(label, type="success") {
    demoLog(`Conan Fit / Turnike 1 · ${label}`, type);
    if ($("quickResult")) { $("quickResult").classList.remove("muted"); $("quickResult").textContent = `Deneyim Modu: ${label}`; }
}

function installDemoInterceptors() {
    const actions = {
        quickOpenBtn:"Geçiş izni verildi", dashOpenBtn:"Geçiş izni verildi", openTurnstileBtn:"Geçiş izni verildi",
        dashLockBtn:"Turnike kilitlendi", lockTurnstileBtn:"Turnike kilitlendi",
        quickKioskBtn:"Kiosk yeniden başlatıldı", chromiumRestartBtn:"Kiosk yeniden başlatıldı",
        quickGc3Btn:"gc3.py yeniden başlatıldı", gc3RestartBtn:"gc3.py yeniden başlatıldı",
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
    renderDemoAlarms(); renderDemoActivity(); renderInventory(); renderAudit(); renderTurnTests(); renderWizard(); refreshAgentBadge();
    $("demoModeBtn")?.addEventListener("click", () => setDemoMode(!window.GYMSOFT_DEMO_MODE));
    $("demoModeSwitch")?.addEventListener("change", e => setDemoMode(e.target.checked));
    $("inventorySearch")?.addEventListener("input", renderInventory);
    $("inventoryFilter")?.addEventListener("change", renderInventory);
    $("inventoryAddBtn")?.addEventListener("click", () => {
        const n = demoInventory.length + 1;
        demoInventory.push({ customer:"Demo Salon", name:`Turnike ${n}`, ip:`192.168.1.${110+n}`, model:"Raspberry Pi 5", release:"v22.2", status:"online", temp:46.0, health:92, seen:"şimdi" });
        renderInventory(); demoLog(`Demo Salon / Turnike ${n} envantere eklendi`, "change");
    });
    $("demoClearAuditBtn")?.addEventListener("click", () => { demoAudit=[]; renderDemoActivity(); renderAudit(); });
    $("auditFilter")?.addEventListener("change", renderAudit);
    $("demoReleaseBtn")?.addEventListener("click", () => {
        const btn=$("demoReleaseBtn"); btn.disabled=true; $("demoReleaseResult").textContent="1/3 Konfigürasyon yedeği alınıyor…";
        setTimeout(()=>$("demoReleaseResult").textContent="2/3 v23.0 release indiriliyor…",600);
        setTimeout(()=>$("demoReleaseResult").textContent="3/3 Sağlık kontrolü yapılıyor…",1200);
        setTimeout(()=>{ $("demoReleaseResult").textContent="✓ Deneme güncellemesi tamamlandı. Rollback noktası hazır."; $("demoInstalledRelease").textContent="v23.0"; btn.disabled=false; demoLog("Conan Fit / Turnike 1 · v23.0 deneme güncellemesi tamamlandı","change"); },1800);
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
document.getElementById("agentCheckBtn")?.addEventListener("click", checkGitHubPagesAgent);
document.getElementById("agentDemoBtn")?.addEventListener("click", () => setDemoMode(true));
checkGitHubPagesAgent();
