// Dashboard script: polls /api/status and /api/logs, drives the Start/Stop
// buttons. Defensive by design — every fetch is wrapped so a transient
// network blip can't crash the page.

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const producerState = document.getElementById("producer-state");
const consumerState = document.getElementById("consumer-state");
const uptimeEl = document.getElementById("uptime");
const logEl = document.getElementById("log");

function setState(el, state) {
    if (!state) return;
    const dotClass = state.running ? "dot on" : "dot off";
    const text = state.running ? "running" : "stopped";
    el.innerHTML = `<span class="${dotClass}"></span>${text}`;
}

function formatUptime(seconds) {
    if (seconds == null) return "—";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
}

async function refreshStatus() {
    try {
        const data = await fetchJson("/api/status");
        setState(producerState, data.producer);
        setState(consumerState, data.consumer);
        const up = data.producer.running
            ? data.producer.uptime_seconds
            : data.consumer.running
                ? data.consumer.uptime_seconds
                : null;
        uptimeEl.textContent = formatUptime(up);
    } catch (e) {
        console.warn("status refresh failed", e);
    }
}

async function refreshLogs() {
    try {
        const data = await fetchJson("/api/logs?tail=20");
        if (!data.lines || data.lines.length === 0) {
            logEl.textContent = "(no messages yet — start the stream)";
            return;
        }
        logEl.textContent = data.lines
            .map((l) => {
                try {
                    return JSON.stringify(JSON.parse(l), null, 2);
                } catch {
                    return l;
                }
            })
            .join("\n\n");
    } catch (e) {
        console.warn("logs refresh failed", e);
    }
}

async function callAction(endpoint) {
    startBtn.disabled = true;
    stopBtn.disabled = true;
    try {
        const r = await fetch(endpoint, { method: "POST" });
        if (!r.ok) {
            const err = await r.text();
            console.error(`${endpoint} failed`, err);
        }
    } catch (e) {
        console.error(`${endpoint} error`, e);
    } finally {
        await refreshStatus();
        await refreshLogs();
        startBtn.disabled = false;
        stopBtn.disabled = false;
    }
}

startBtn.addEventListener("click", () => callAction("/api/start"));
stopBtn.addEventListener("click", () => callAction("/api/stop"));

refreshStatus();
refreshLogs();
setInterval(refreshStatus, 2000);
setInterval(refreshLogs, 2000);
