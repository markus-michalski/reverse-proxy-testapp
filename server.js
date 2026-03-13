const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3000;
const WS_ENABLED = process.env.WS_ENABLED === 'true';

// Simple HTTP server
const server = http.createServer((req, res) => {
  const info = {
    message: 'Reverse Proxy Test App',
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    method: req.method,
    url: req.url,
    headers: {
      host: req.headers.host,
      'x-forwarded-for': req.headers['x-forwarded-for'] || 'direct',
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'none',
    },
    websocket: WS_ENABLED ? 'enabled' : 'disabled',
  };

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Reverse Proxy Test</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #0f3460; background: #e94560; padding: 15px 20px; border-radius: 8px; color: #fff; }
    .card { background: #16213e; padding: 20px; border-radius: 8px; margin: 15px 0; }
    .card h2 { margin-top: 0; color: #e94560; }
    code { background: #0f3460; padding: 2px 8px; border-radius: 4px; }
    #ws-status { padding: 10px; border-radius: 4px; margin-top: 10px; }
    .connected { background: #2d6a4f; }
    .disconnected { background: #6a2d2d; }
    #ws-messages { max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 13px; }
    #ws-messages div { padding: 3px 0; border-bottom: 1px solid #0f3460; }
  </style>
</head>
<body>
  <h1>Reverse Proxy Test App</h1>

  <div class="card">
    <h2>Request Info</h2>
    <p>Host Header: <code>${info.headers.host}</code></p>
    <p>X-Forwarded-For: <code>${info.headers['x-forwarded-for']}</code></p>
    <p>X-Forwarded-Proto: <code>${info.headers['x-forwarded-proto']}</code></p>
    <p>Timestamp: <code>${info.timestamp}</code></p>
  </div>

  <div class="card">
    <h2>Endpoints</h2>
    <p><code>GET /</code> - This page</p>
    <p><code>GET /api</code> - JSON response</p>
    <p><code>GET /health</code> - Health check</p>
    ${WS_ENABLED ? '<p><code>ws://</code> - WebSocket (auto-connects below)</p>' : '<p>WebSocket: <em>disabled</em> (start with <code>WS_ENABLED=true</code>)</p>'}
  </div>

  ${WS_ENABLED ? `
  <div class="card">
    <h2>WebSocket</h2>
    <div id="ws-status" class="disconnected">Connecting...</div>
    <div id="ws-messages"></div>
  </div>
  <script>
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(proto + '//' + location.host);
    const status = document.getElementById('ws-status');
    const messages = document.getElementById('ws-messages');

    ws.onopen = () => {
      status.textContent = 'Connected';
      status.className = 'connected';
      ws.send(JSON.stringify({ type: 'ping', time: Date.now() }));
    };
    ws.onmessage = (e) => {
      const div = document.createElement('div');
      div.textContent = e.data;
      messages.prepend(div);
    };
    ws.onclose = () => {
      status.textContent = 'Disconnected';
      status.className = 'disconnected';
    };
  </script>` : ''}
</body>
</html>`);
    return;
  }

  if (req.url === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', path: req.url }));
});

// Optional WebSocket support
if (WS_ENABLED) {
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log(`[WS] Client connected from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);

    ws.send(JSON.stringify({ type: 'welcome', message: 'WebSocket connected!', time: new Date().toISOString() }));

    // Send periodic heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', time: new Date().toISOString() }));
      }
    }, 5000);

    ws.on('message', (data) => {
      console.log(`[WS] Received: ${data}`);
      ws.send(JSON.stringify({ type: 'echo', original: JSON.parse(data), time: new Date().toISOString() }));
    });

    ws.on('close', () => {
      clearInterval(heartbeat);
      console.log('[WS] Client disconnected');
    });
  });

  console.log('[WS] WebSocket server enabled');
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket: ${WS_ENABLED ? 'enabled' : 'disabled (start with WS_ENABLED=true)'}`);
});
