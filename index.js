const express = require("express")
const cors = require("cors")
const crypto = require("crypto")
const { json } = require("stream/consumers")
const { error } = require("console")

const app = express()
const port = process.argv[2] || 4000
const coordinator_url = process.argv[3]
const public_url = process.argv[4]
const pulse_interval = 2000

if (!coordinator_url || !public_url) {
    console.log("Uso: node index.js <port> <coordinator_url> <public_url> ")
    process.exit(1)
}

const id = crypto.randomUUID()

app.use(cors())
app.use(express.json())

let lastHeartbeat = null
let coordinatorStatus = "Desconocido"

app.get("/status", (req, res) => {
    res.json({
        worker: {
            id,
            port,
            public_url,
            heartbeat_interval: pulse_interval,
            timestamp: Date.now()
        },
        coordinator: {
            url: coordinator_url,
            status: coordinatorStatus,
            last_heartbeat: lastHeartbeat
        }
    })
})

async function register() {
    try {
        await fetch(`${coordinator_url}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id,
                url: public_url
            })
        })
        console.log("enviado correctamente")
    } catch (error) {
        console.log("Error registrado;", error)

    }
}

async function sendPulse() {
    try {
        await fetch(`${coordinator_url}/pulse`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        })

        coordinatorStatus = "Conectado"
        lastHeartbeat = Date.now()

        console.log("Pulso enviado")
    } catch (error) {
        coordinatorStatus = "Error"
        console.log("Error al enviar pulso:", error.message)
    }
}



app.listen(port, async () => {
    console.log(`Worker ${id} corrido en ${port}`)
    await register()
    setInterval(sendPulse, pulse_interval)
})

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Worker Monitor</title>

<style>
body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #f4f6f9;
    color: #2c3e50;
}

header {
    background: #2c3e50;
    color: white;
    padding: 18px 30px;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 0.5px;
}

.container {
    max-width: 1100px;
    margin: 30px auto;
    padding: 0 20px;
}

.section {
    background: white;
    border: 1px solid #dcdfe6;
    margin-bottom: 25px;
}

.section-title {
    background: #eef1f5;
    padding: 12px 18px;
    font-size: 14px;
    font-weight: bold;
    border-bottom: 1px solid #dcdfe6;
    text-transform: uppercase;
}

.section-content {
    padding: 15px 18px;
}

.grid {
    display: grid;
    grid-template-columns: 220px 1fr;
    row-gap: 10px;
    column-gap: 15px;
    font-size: 14px;
}

.label {
    color: #7f8c8d;
}

.value {
    font-weight: 500;
    word-break: break-all;
}

.status-badge {
    display: inline-block;
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 3px;
    font-weight: bold;
}

.status-ok {
    background: #e8f8f2;
    color: #1e8449;
    border: 1px solid #27ae60;
}

.status-fail {
    background: #fdecea;
    color: #922b21;
    border: 1px solid #c0392b;
}

footer {
    text-align: center;
    padding: 15px;
    font-size: 12px;
    color: #95a5a6;
    margin-top: 40px;
}

@media (max-width: 700px) {
    .grid {
        grid-template-columns: 1fr;
    }
}
</style>
</head>

<body>

<header>
Worker Monitoring Service
</header>

<div class="container">

<div class="section">
<div class="section-title">Worker</div>
<div class="section-content" id="workerSection">
Cargando información...
</div>
</div>

<div class="section">
<div class="section-title">Coordinator</div>
<div class="section-content" id="coordinatorSection">
Cargando información...
</div>
</div>

</div>

<footer>
Sistema de monitoreo en ejecución
</footer>

<script>
async function loadStatus() {
    try {
        const response = await fetch("/status");
        const data = await response.json();

        const workerHtml = \`
            <div class="grid">
                <div class="label">ID</div>
                <div class="value">\${data.worker.id}</div>

                <div class="label">Puerto</div>
                <div class="value">\${data.worker.port}</div>

                <div class="label">URL pública</div>
                <div class="value">\${data.worker.public_url}</div>

                <div class="label">Heartbeat interval</div>
                <div class="value">\${data.worker.heartbeat_interval} ms</div>

                <div class="label">Timestamp</div>
                <div class="value">\${new Date(data.worker.timestamp).toLocaleString()}</div>
            </div>
        \`;

        const statusClass = data.coordinator.status === "Conectado"
            ? "status-ok"
            : "status-fail";

        const coordinatorHtml = \`
            <div class="grid">
                <div class="label">URL</div>
                <div class="value">\${data.coordinator.url}</div>

                <div class="label">Estado</div>
                <div class="value">
                    <span class="status-badge \${statusClass}">
                        \${data.coordinator.status}
                    </span>
                </div>

                <div class="label">Último heartbeat</div>
                <div class="value">
                    \${data.coordinator.last_heartbeat
                        ? new Date(data.coordinator.last_heartbeat).toLocaleString()
                        : "N/A"}
                </div>
            </div>
        \`;

        document.getElementById("workerSection").innerHTML = workerHtml;
        document.getElementById("coordinatorSection").innerHTML = coordinatorHtml;

    } catch (error) {
        document.getElementById("workerSection").innerHTML =
            "<span style='color:#c0392b'>Error cargando datos</span>";
        document.getElementById("coordinatorSection").innerHTML = "";
    }
}

loadStatus();
setInterval(loadStatus, 2000);
</script>

</body>
</html>
`);
});
    
