# SETUP.md — One-time setup, tonight, on the demo Mac

**Who runs this:** Tanush only (the demo laptop owner).
**Time required:** ~45 minutes if everything goes smoothly, 90 minutes with network hiccups.
**Prerequisite:** You have already completed Assignments 3–8 on this machine. Docker Desktop, Minikube, OrbStack with the `k8s-master` Ubuntu VM, Prometheus and Grafana are all already set up.

Follow these steps **in order**. Do not skip ahead.

---

## Step 0 — Verify what is already running

Open Mac Terminal and run:

```bash
docker --version
minikube status
orb list
```

You should see Docker working, Minikube "Running", and `k8s-master` in the orb list.

If `k8s-master` is stopped, start it:
```bash
orb start k8s-master
```

If Minikube is stopped, start it:
```bash
minikube start --driver=docker
```

---

## Step 1 — Update the local project folder

```bash
cd ~/devops-task-manager
```

If the folder doesn't exist, clone it:
```bash
cd ~
git clone https://github.com/Tanush-Mahale/devops-task-manager.git
cd devops-task-manager
```

---

## Step 2 — Replace the project files with the CIE versions

You will replace **4 files** and **add 1 new folder**:
- Replace `app.js`
- Replace `package.json`
- Add `k8s/deployment.yaml`
- Add `k8s/service.yaml`
- Replace `README.md` (and add `SETUP.md`, `DEMO_GUIDE.md`, `VIVA_CHEATSHEET.md`)

Copy each file I generated into the right place. You can use VS Code or any editor. Then verify the structure:

```bash
ls -la
ls -la k8s/
```

Should show `app.js`, `build.js`, `package.json`, `Dockerfile`, `.dockerignore`, `public/`, `k8s/deployment.yaml`, `k8s/service.yaml`, and the 4 markdown docs.

---

## Step 3 — Install the new Node.js dependency and verify locally

```bash
npm install
```

This installs `prom-client` (newly added). Then test:

```bash
npm start
```

Open a second Mac terminal tab and run:

```bash
curl http://localhost:3000/
curl http://localhost:3000/metrics
curl http://localhost:3000/health
```

- `/` returns the HTML page
- `/metrics` returns a long list of Prometheus metrics
- `/health` returns `{"status":"UP"}`

Press `Ctrl+C` in the first tab to stop the server.

---

## Step 4 — Push the updated code to GitHub

```bash
git add .
git commit -m "CIE: add Prometheus metrics, Kubernetes manifests, pipeline docs"
git push origin main
```

If push asks for credentials, use the Personal Access Token (not password).

---

## Step 5 — Reinstall Jenkins (we uninstalled it earlier)

```bash
brew install jenkins-lts
brew services start jenkins-lts
```

Wait ~30 seconds, then open `http://localhost:8080` in your browser.

Get the initial admin password:
```bash
cat ~/.jenkins/secrets/initialAdminPassword
```

Paste into the Jenkins unlock page. Click **"Install suggested plugins"**. Create your admin user (any username/password you'll remember tomorrow).

**Configure the Freestyle project exactly as before:**
1. New Item → name `Student-Task-Manager` → Freestyle project → OK
2. **Source Code Management** → Git → URL `https://github.com/Tanush-Mahale/devops-task-manager.git` → Branch `*/main`
3. **Build Steps** → Add build step → Execute shell → paste:
   ```
   export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin
   npm install
   npm run build
   ```
4. Save

Click **Build Now**. Wait ~30 seconds. The build should go green.

If it fails with `npm: command not found`, run `which npm` in a terminal and update the PATH in the build step to include that directory.

---

## Step 6 — Build the Docker image inside Minikube's Docker daemon

This is **critical**: Minikube has its own Docker daemon separate from Docker Desktop. The image must be built inside that daemon so Kubernetes can find it without needing a registry push.

```bash
eval $(minikube docker-env)
cd ~/devops-task-manager
docker build -t task-manager:2.0 .
docker images | grep task-manager
```

You should see `task-manager:2.0` in the list.

**Important:** every new terminal tab needs `eval $(minikube docker-env)` to talk to Minikube's Docker daemon. The current tab is now "pointed at Minikube" — don't close it until you're done with Kubernetes commands.

---

## Step 7 — Deploy to Kubernetes

Still in the same terminal tab:

```bash
cd ~/devops-task-manager

# Remove the old nginx deployment from Assignment 5 (clean slate)
kubectl delete deployment nginx-deployment --ignore-not-found
kubectl delete service nginx --ignore-not-found

# Deploy the task manager
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

Verify:
```bash
kubectl get deployments
kubectl get pods
kubectl get svc
```

You should see:
- Deployment `task-manager-deployment` with `3/3` READY
- 3 pods named `task-manager-deployment-xxxx` all `Running`
- Service `task-manager-service` of type `NodePort` on `80:30080/TCP`

Open the app in your browser via Minikube tunnel:
```bash
minikube service task-manager-service
```

A browser tab opens showing the Student Task Manager. Add a few tasks to prove it works. Note the URL — it's something like `http://127.0.0.1:XXXXX`.

**Also test the metrics endpoint on the same tunneled URL:** `http://127.0.0.1:XXXXX/metrics` — should show Prometheus-format metrics.

Keep this `minikube service` command running in a terminal tab for tomorrow (it holds the tunnel open).

---

## Step 8 — Point Prometheus at the task manager

The task manager runs on your Mac's Minikube on NodePort 30080. Prometheus runs inside the Ubuntu VM. The VM reaches the Mac host via a special hostname.

Get the Minikube IP:
```bash
minikube ip
```

Example output: `192.168.49.2`. **Write this down.**

Enter the Ubuntu VM:
```bash
orb -m k8s-master
```

Edit the Prometheus config:
```bash
sudo nano /etc/prometheus/prometheus.yml
```

Find the `scrape_configs:` section and **add** this block at the bottom (match indentation of the existing jobs):

```yaml
  - job_name: 'task-manager'
    scrape_interval: 5s
    metrics_path: /metrics
    static_configs:
      - targets: ['host.lima-internal:30080']
        labels:
          service: 'student-task-manager'
```

> **If `host.lima-internal` doesn't work** (Prometheus target shows DOWN), replace it with your Mac's local network IP. Get it on Mac with: `ipconfig getifaddr en0` (returns something like `192.168.1.7`). Then target becomes `'192.168.1.7:30080'`.

Save: `Ctrl+O`, Enter, `Ctrl+X`.

Reload Prometheus:
```bash
sudo systemctl restart prometheus
sudo systemctl status prometheus
```

Exit the VM:
```bash
exit
```

---

## Step 9 — Verify Prometheus is scraping the task manager

Open Prometheus in your browser: `http://192.168.139.88:9090` (use the IP from `orb list` if different).

- Click **Status → Targets**
- You should see **three** targets, all `UP`:
  - `prometheus` (localhost:9090)
  - `node_exporter` (localhost:9100)
  - `task-manager` (host.lima-internal:30080 or your Mac IP)

If `task-manager` shows **DOWN**, see troubleshooting at the end of this file.

Test a PromQL query. Click **Graph** and run:
```
task_manager_http_requests_total
```

You should see 3 rows (one per pod replica).

---

## Step 10 — Build the Grafana dashboard

Open Grafana: `http://192.168.139.88:3000` — login with your admin credentials.

Create a new dashboard with **4 panels**. For each panel, click Add visualization → prometheus data source → switch to **Code** mode → paste the query → set title → Apply.

**Panel 1: Total HTTP Requests**
- Query: `sum(task_manager_http_requests_total)`
- Title: `Total HTTP Requests`
- Visualization: Stat (big single number)

**Panel 2: HTTP Request Rate (per second)**
- Query: `sum(rate(task_manager_http_requests_total[1m]))`
- Title: `HTTP Request Rate`
- Visualization: Time series

**Panel 3: Requests by Endpoint**
- Query: `sum by (route) (rate(task_manager_http_requests_total[1m]))`
- Title: `Requests by Route`
- Visualization: Time series

**Panel 4: Memory Usage**
- Query: `process_resident_memory_bytes{app="student-task-manager"} / 1024 / 1024`
- Title: `Memory Usage (MB)`
- Visualization: Time series

Save the dashboard as `Student Task Manager Monitoring`.

**Test it:** keep the dashboard open, then in another browser tab hit the app's `/` endpoint 10 times fast (F5 spam). Within 5-10 seconds the Request Rate graph should spike. If it does — you are done.

---

## Step 11 — Final verification run

Do a dry run of the full pipeline:

1. Edit `public/index.html` on your Mac (change the `<h1>` text to anything)
2. `git add . && git commit -m "test change" && git push origin main`
3. In Jenkins, click **Build Now** on Student-Task-Manager → should go green
4. The pipeline would normally rebuild the Docker image and redeploy — for the demo we show the flow conceptually. (Full automated redeploy requires more Jenkins plugins we don't have time for.)
5. Open the app → confirm new heading appears
6. Spam F5 on the app → confirm Grafana graph spikes within 10 seconds

If all 6 steps pass, you are demo-ready.

---

## Troubleshooting during setup

**Jenkins build fails: `npm: command not found`**
→ The PATH in the build step is wrong. Run `which npm` on Mac, then update the Execute shell PATH line to include that directory.

**Pods stay in `ImagePullBackOff` or `ErrImagePull`**
→ You forgot `eval $(minikube docker-env)` before building. Repeat Step 6.

**Pods stay in `Pending`**
→ `kubectl describe pod <pod-name>` and read the Events section. Usually a resource request issue — not expected with our config.

**App opens in browser but Grafana shows no data**
→ Open Prometheus Targets page. If task-manager is DOWN, your Mac IP guess is wrong. Try the alternatives listed in Step 8.

**Prometheus target shows DOWN with "connection refused"**
→ Prometheus can't reach the Mac. From inside the Ubuntu VM run `curl http://host.lima-internal:30080/metrics` to test connectivity. If that fails, try `curl http://<MAC_LAN_IP>:30080/metrics`.

**Grafana dashboard shows "No data"**
→ Open the panel editor, click **Query inspector** to see the raw response. Usually the query is wrong — compare against the queries in Step 10.

---

Once everything in Step 11 passes, share the repo link with your groupmates and tell them to read `DEMO_GUIDE.md` and `VIVA_CHEATSHEET.md`. Then sleep.
