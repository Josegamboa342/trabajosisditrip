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
        <html>
        <head>
            <title>Worker Status</title>
            <style>
                body {
                    font-family: Arial;
                }
                table {
                    border-collapse: collapse;
                    width: 60%;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid black;
                    padding: 5px;
                    text-align: left;
                }
                th {
                    background-color: #b7b3b3;
                }
                .ok {
                    color: green;
                }
                .fail {
                    color: red;
                }
            </style>
        </head>
        <body>

            <h2>Worker Information</h2>

            <div id="content">Loading...</div>

            <script>
                async function loadStatus() {
                    try {
                        const response = await fetch("/status");
                        const data = await response.json();

                        let estadoClase = data.coordinator.status === "Conectado"
                            ? "ok"
                            : "fail";

                        let html = "";

                        html += "<table>";
                        html += "<tr><th colspan='2'>Worker</th></tr>";
                        html += "<tr><td>ID</td><td>" + data.worker.id + "</td></tr>";
                        html += "<tr><td>Puerto</td><td>" + data.worker.port + "</td></tr>";
                        html += "<tr><td>URL pública</td><td>" + data.worker.public_url + "</td></tr>";
                        html += "<tr><td>Heartbeat interval</td><td>" + data.worker.heartbeat_interval + " ms</td></tr>";
                        html += "<tr><td>Timestamp</td><td>" + new Date(data.worker.timestamp).toLocaleString() + "</td></tr>";
                        html += "</table>";

                        html += "<table>";
                        html += "<tr><th colspan='2'>Coordinator</th></tr>";
                        html += "<tr><td>URL</td><td>" + data.coordinator.url + "</td></tr>";
                        html += "<tr><td>Estado</td><td class='" + estadoClase + "'>" + data.coordinator.status + "</td></tr>";
                        html += "<tr><td>Último heartbeat</td><td>" +
                            (data.coordinator.last_heartbeat
                                ? new Date(data.coordinator.last_heartbeat).toLocaleString()
                                : "N/A") + "</td></tr>";
                        html += "</table>";

                        document.getElementById("content").innerHTML = html;

                    } catch (error) {
                        document.getElementById("content").innerHTML =
                            "<p style='color:red;'>Error obteniendo datos</p>";
                    }
                }

                loadStatus();
                setInterval(loadStatus, 2000);
            </script>

        </body>
        </html>
    `);
});
