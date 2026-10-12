const express = require('express');
const path = require('path');
const client = require('prom-client');

const app = express();
const PORT = 3000;

// -----------------------------------------------------------------------------
// Prometheus metrics setup
// -----------------------------------------------------------------------------
// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: 'student-task-manager'
});

// Enable default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Custom counter: total HTTP requests received
const httpRequestsTotal = new client.Counter({
    name: 'task_manager_http_requests_total',
    help: 'Total number of HTTP requests received by the Student Task Manager',
    labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

// Middleware: count every incoming HTTP request
app.use((req, res, next) => {
    res.on('finish', () => {
        httpRequestsTotal.inc({
            method: req.method,
            route: req.path,
            status_code: res.statusCode
        });
    });
    next();
});

// -----------------------------------------------------------------------------
// Application routes
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Expose the /metrics endpoint for Prometheus to scrape
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// Health check endpoint (useful for Kubernetes probes)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Student Task Manager running on port ${PORT}`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
});
