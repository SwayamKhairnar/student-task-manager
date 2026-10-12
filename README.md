# Student Task Manager — DevOps CIE Project

Group CIE-01 · TY B.Tech Information Technology · 50 marks · 10 minutes

This repo is the complete DevOps pipeline we are demonstrating in the CIE: a small Node.js web app that flows through **Git → Jenkins → Docker → Kubernetes → Prometheus → Grafana** and back out as a live dashboard the faculty can watch update in real time.

**If you only have 15 minutes to read before the demo, read these three files in order:**

1. this `README.md` — understand *what* we built and *why* every piece exists
2. `DEMO_GUIDE.md` — your script for the 10 minutes in the exam
3. `VIVA_CHEATSHEET.md` — the questions the faculty will ask you, with answers

---

## 1. What this project actually is

A Node.js + Express web application called **Student Task Manager**. The user types tasks into a text box and they appear in a list below. That's deliberately simple — the app is not the point of the CIE. The point is the **pipeline around the app**: everything that happens between a developer pushing code and that code showing up as live graphs in Grafana.

The entire pipeline runs on **one Mac laptop** (the demo machine). Prometheus and Grafana live inside an Ubuntu VM (OrbStack), and Jenkins + Docker + Kubernetes live natively on macOS. Together they look like this:

```
   Developer                    Mac host                              Ubuntu VM
   ─────────                    ────────                              ─────────
                                                                          
  (code change)                                                           
       │                                                                  
       ▼                                                                  
   ┌───────┐    git push    ┌────────────┐    webhook    ┌──────────┐    
   │  Git  │ ─────────────► │   GitHub   │ ────────────► │ Jenkins  │    
   └───────┘                └────────────┘               └────┬─────┘    
                                                              │          
                                                              ▼          
                                                        ┌──────────┐     
                                                        │  Docker  │     
                                                        │  (image) │     
                                                        └────┬─────┘     
                                                              │          
                                                              ▼          
                                                      ┌─────────────┐    
                                                      │  Kubernetes │    
                                                      │  (Minikube) │    
                                                      │   3 pods    │    
                                                      └──────┬──────┘    
                                                             │           
                                        NodePort 30080       │           
                                                             │ /metrics  
                                                             ▼           
                                                      ┌─────────────┐    scrape    ┌────────────┐
                                                      │ Student Task│ ◄─────────── │ Prometheus │
                                                      │   Manager   │              │  (port 9090)│
                                                      └─────────────┘              └──────┬─────┘
                                                                                           │
                                                                                           ▼
                                                                                     ┌─────────┐
                                                                                     │ Grafana │
                                                                                     │ (3000)  │
                                                                                     └─────────┘
```

Every single arrow in that diagram is **worth marks**. The faculty rubric gives 36 marks for showing each tool individually, and **14 marks for showing that these arrows all actually work in sequence** — that is the "end-to-end" integration score we cannot afford to lose.

---

## 2. Who demos what

| Student | Primary tool | What they are responsible for |
|---|---|---|
| Student 1 | **Git** | The repo, the commit, the push that triggers everything |
| Student 2 | **Jenkins** | The CI job that watches Git and runs the build |
| Student 3 | **Docker** | The Dockerfile and the image that comes out of the build |
| Student 4 | **Kubernetes** | The deployment, the service, the running pods |
| Rotating | **Prometheus + Grafana** | The monitoring half — one student takes both since they are a pair |

Rotating means one of the four students (whoever wants it) also handles the monitoring tools, so each student still only has one "primary tool" to defend in viva, but someone owns the Prometheus-Grafana story.

---

## 3. Files in this repo and what each one does

### Application code

| File | What it is | Why it exists |
|---|---|---|
| `app.js` | The Node.js + Express server | This is the Student Task Manager itself. It serves the HTML page, exposes a `/metrics` endpoint for Prometheus, and a `/health` endpoint for Kubernetes probes. |
| `build.js` | A tiny build-validation script | Jenkins runs `npm run build` which runs this file. It just checks that all required files (`app.js`, `package.json`, `public/index.html`) exist. If any are missing, it exits with an error — which makes Jenkins mark the build as failed. This is how we prove the Jenkins pipeline *can* fail. |
| `package.json` | Node.js project descriptor | Lists dependencies (`express`, `prom-client`) and defines the `start` and `build` scripts. |
| `public/index.html` | The web UI | Plain HTML+CSS+JS. Lets the user add and delete tasks. No framework — simple on purpose. |

### Containerisation

| File | What it is | Why it exists |
|---|---|---|
| `Dockerfile` | Instructions to build the Docker image | Starts from `node:20-alpine`, copies our app in, runs `npm install`, exposes port 3000, and runs `npm start`. Produces the `task-manager:2.0` image. |
| `.dockerignore` | Files to exclude from the image | Prevents `node_modules` and `.git` from being copied in (makes the image smaller and avoids OS-mismatch bugs). |

### Kubernetes manifests (in `k8s/`)

| File | What it is | Why it exists |
|---|---|---|
| `k8s/deployment.yaml` | Deployment definition for the app | Tells Kubernetes to run 3 copies (replicas) of the `task-manager:2.0` container. If one dies, Kubernetes starts a new one automatically — this is the "self-healing" demo. Each container also has `livenessProbe` and `readinessProbe` pointing at `/health` so Kubernetes can tell when a pod is unhealthy. |
| `k8s/service.yaml` | NodePort Service definition | Exposes the three pods on a fixed external port **30080** so that Prometheus (running in a different VM) can reliably reach the `/metrics` endpoint. Also lets us open the app in the browser. |

### Monitoring configs

| File | What it is | Why it exists |
|---|---|---|
| `prometheus/prometheus-scrape-addition.yml` | Snippet to paste into Prometheus config | This is **not** a standalone file. It is a block that goes inside `/etc/prometheus/prometheus.yml` on the Ubuntu VM. It tells Prometheus "every 5 seconds, go to the task-manager at `<MAC_IP>:30080/metrics` and collect the numbers". |
| `grafana/dashboard.json` | Pre-built Grafana dashboard | Imports as a ready-made dashboard with 4 panels: HTTP request rate, total requests by endpoint, process memory, and CPU usage. Saves you from building panels one by one during the demo. |

### CI/CD

| File | What it is | Why it exists |
|---|---|---|
| `Jenkinsfile` | Declarative pipeline as code | **Optional.** For the CIE we use a Jenkins Freestyle project (configured in the Jenkins UI) because it's easier to show visually. The `Jenkinsfile` is here in case the faculty asks "can you also do it as a pipeline?" — you can show it exists. |

### Documentation

| File | Who reads it | When |
|---|---|---|
| `README.md` | Everyone in the group | Tonight, before the demo |
| `SETUP.md` | Only Tanush (demo laptop owner) | Tonight, once, end to end |
| `DEMO_GUIDE.md` | All 4 students | Tonight to memorise, tomorrow to follow |
| `VIVA_CHEATSHEET.md` | All 4 students | Tonight to practice |

---

## 4. The six tools, in one sentence each

- **Git** — version control; records every code change and lets us push code to GitHub.
- **Jenkins** — automation server; watches our GitHub repo and runs the build steps whenever new code arrives.
- **Docker** — containerisation; packages our app plus its runtime into a single self-contained image that runs the same on any machine.
- **Kubernetes** — container orchestration; takes the Docker image and runs multiple copies of it across a cluster, restarts crashed ones, and routes traffic to the healthy ones.
- **Prometheus** — metrics collection; scrapes numerical data (request count, memory, CPU) from the app at regular intervals and stores it as time series.
- **Grafana** — visualisation; reads the data from Prometheus and draws it as live graphs on a dashboard.

If you can say each of those sentences in your own words without reading, you are already 50% viva-ready.

---

## 5. What makes this a "DevOps pipeline" and not just six separate tools

The key insight: **each tool's output is the next tool's input.** We never do any step manually that an upstream tool could have done.

- You never manually copy your code into Jenkins — Git does the handoff.
- You never manually tell Jenkins to run — the Git push triggers it.
- You never manually build an image — Jenkins calls Docker.
- You never manually scp an image to the cluster — Kubernetes pulls it.
- You never manually record metrics — Prometheus scrapes them.
- You never manually plot graphs — Grafana reads from Prometheus.

That chain of automation **is** DevOps. The faculty will be looking for whether you can describe this handoff pattern, not whether you know advanced features of any one tool.

---

## 6. The 8 troubleshooting scenarios the faculty might trigger

These are the exact scenarios printed on the CIE poster. For each one, know **which tool to look at first** and **what command to run**. Full answers are in `VIVA_CHEATSHEET.md`.

1. Git push does not trigger CI/CD → **Jenkins** → check webhook / poll SCM configuration
2. CI/CD build fails → **Jenkins Console Output** → read the last 20 lines of the failing stage
3. Docker container runs but application is inaccessible → **Docker** → `docker ps` for port mapping, `docker logs <id>` for app errors
4. Kubernetes Pod is `CrashLoopBackOff` → **Kubernetes** → `kubectl describe pod` and `kubectl logs`
5. Prometheus target is DOWN → **Prometheus** → `Status → Targets` page, check network path to the app
6. Grafana panel shows no data → **Grafana** → verify data source, verify PromQL query returns rows in Prometheus first

Each scenario has a step-by-step diagnostic flow in the cheat sheet. Memorise the first two steps for each at minimum.

---

## 7. What to do right now

1. Read sections 1–6 above (10 minutes).
2. Open `DEMO_GUIDE.md` and read **only your assigned tool's section** carefully.
3. Open `VIVA_CHEATSHEET.md` and read **your assigned tool's Q&A** three times.
4. If you want to go further, read the other students' sections too so you can help them during the demo.
5. Sleep. The person demoing anything at 3 AM is not the person who should be demoing at 10 AM.

Good luck.
