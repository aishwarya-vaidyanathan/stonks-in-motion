// Placeholder dashboard script.
// Wired to the /api/start, /api/stop, /api/status, /api/logs endpoints in V1d.

const startBtn = document.getElementById("start");
const stopBtn  = document.getElementById("stop");

function flash(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

startBtn.addEventListener("click", () => flash("start clicked (V1d will POST /api/start)"));
stopBtn.addEventListener("click",  () => flash("stop clicked (V1d will POST /api/stop)"));
