# VIVA_CHEATSHEET.md — Questions, answers, and troubleshooting

Read your assigned tool's section 3 times. Then skim the others once.

**Rule:** every answer should be **2–3 sentences max**. If you ramble, you expose gaps. Keep it tight.

---

## Section 1 — Git (Student 1)

### Q1. What is Git and why do we use it?
Git is a distributed version-control system. It tracks every change to our code, lets multiple people work on the same project without overwriting each other, and keeps a complete history we can roll back to at any point. We use it as the single source of truth for our source code.

### Q2. Difference between `git commit` and `git push`?
`git commit` saves a snapshot of the staged changes to the **local** repository on your machine. `git push` uploads those local commits to the **remote** repository on GitHub so others — and Jenkins — can see them.

### Q3. What is a branch and why would you create one?
A branch is an independent line of development. You create a branch when you want to work on a new feature or fix without disturbing the stable `main` branch. When done, you merge the branch back via a Pull Request.

### Q4. What is a `.gitignore` file?
A text file listing patterns of files Git should **not** track. For example, `node_modules/` is in our `.gitignore` because those dependencies are reinstalled from `package.json` and don't need to be in the repo.

### Q5. What is the difference between `git pull` and `git fetch`?
`git fetch` downloads the latest changes from the remote but doesn't apply them to your working directory. `git pull` is `git fetch` **plus** `git merge` — it downloads and then integrates the changes into your current branch.

### Q6. What is a merge conflict and how do you resolve it?
A merge conflict happens when two commits change the same line of the same file differently. Git stops the merge and marks the conflicting sections in the file with `<<<<<<<` and `>>>>>>>`. You edit the file to keep the correct version, remove the markers, then `git add` and `git commit`.

### Troubleshooting: "Git push does not trigger CI/CD"
1. Open Jenkins → the job → **Configure**
2. Scroll to **Build Triggers**. If "Poll SCM" is enabled, Jenkins checks GitHub on a schedule (e.g., `H/5 * * * *` = every 5 minutes). If "GitHub hook trigger" is checked, GitHub must send a webhook — check the GitHub repo's **Settings → Webhooks** page to see if the webhook delivered successfully.
3. For the demo, we trigger builds manually via **Build Now**, so this scenario is academic — explain that in production we'd use webhooks.

---

## Section 2 — Jenkins (Student 2)

### Q1. What is Jenkins and what problem does it solve?
Jenkins is an open-source automation server for Continuous Integration and Continuous Deployment. Without Jenkins, every developer would have to manually build and test code after every change. Jenkins watches the Git repository and runs these steps automatically, catching errors immediately.

### Q2. What is a Jenkins Freestyle project vs a Pipeline project?
A Freestyle project is configured through the Jenkins web UI with build steps you click together — easier for beginners. A Pipeline project is defined as code in a `Jenkinsfile` committed to the repo, giving better version control and reusability. We use a Freestyle project for this demo but also have a `Jenkinsfile` in the repo.

### Q3. What is a "build step"?
A build step is a single action Jenkins performs during the job — for example "run this shell command" or "invoke this Maven goal". Our Freestyle job has one Execute shell step that runs `npm install && npm run build`.

### Q4. What is the Jenkins Workspace?
A directory on the Jenkins server where the job checks out the code and runs the build. Each job has its own workspace. For us it's `~/.jenkins/workspace/Student-Task-Manager`.

### Q5. What does `Finished: SUCCESS` vs `Finished: FAILURE` mean?
Jenkins decides success or failure based on the **exit code** of the last build step. If any command in the shell step exits non-zero, Jenkins marks the build as FAILURE. Our `build.js` deliberately exits with code 1 if a required file is missing — this is how we prove the build can fail meaningfully.

### Q6. What is a webhook?
A webhook is a one-way HTTP POST that one system sends to another when an event happens. GitHub sends a webhook to Jenkins the moment a push occurs, so Jenkins can start building immediately instead of polling on a schedule.

### Troubleshooting: "CI/CD build fails"
1. Click into the failing build number → **Console Output**
2. Scroll to the **end** of the log — the actual error message is near the bottom, usually right above `Finished: FAILURE`
3. Common causes: a dependency failed to install (network issue), a required file is missing (our `build.js` catches this), or a shell command isn't on the PATH (fix by adding `export PATH=$PATH:/usr/local/bin` to the shell step)
4. Fix the underlying issue in the code, push to Git, re-run **Build Now**

---

## Section 3 — Docker (Student 3)

### Q1. What is Docker and why do we use containers?
Docker is a platform that packages an application together with its runtime, libraries, and OS-level dependencies into a single unit called a **container**. The container runs identically on any machine with Docker installed, eliminating the "it works on my machine" problem.

### Q2. What is a Docker Image vs a Docker Container?
An image is a **read-only template** that defines what goes into the container — like a class in programming. A container is a **running instance** of an image — like an object. You can run many containers from the same image.

### Q3. Walk me through our Dockerfile.
- `FROM node:20-alpine` — starts from a lightweight Linux base image with Node.js 20 pre-installed.
- `WORKDIR /app` — sets `/app` as the working directory inside the container.
- `COPY package*.json ./` — copies dependency manifests first (separate layer for Docker caching).
- `RUN npm install` — installs dependencies.
- `COPY . .` — copies the rest of the source code.
- `EXPOSE 3000` — documents that the container listens on port 3000.
- `CMD ["npm", "start"]` — the command that runs when the container starts.

### Q4. What is a `.dockerignore` file?
Same idea as `.gitignore` but for Docker. Files matching the patterns are not sent to the Docker daemon when building the image. We exclude `node_modules` and `.git` to make the build faster and the image smaller.

### Q5. Difference between `EXPOSE` and `-p` port mapping?
`EXPOSE` in the Dockerfile is **documentation** — it tells humans and tools what port the app listens on, but doesn't actually open any ports. The `-p 3000:3000` flag at `docker run` time is what **actually publishes** the container port to the host.

### Q6. What is a container registry?
A storage service for Docker images. Docker Hub is the public default. For enterprise use there's AWS ECR, Google GCR, GitHub Container Registry, or private Harbor instances. Jenkins typically pushes built images to a registry so Kubernetes can pull them.

### Troubleshooting: "Container runs but application is inaccessible"
1. `docker ps` — is the container actually running? Note the PORTS column — is there a `0.0.0.0:PORT->PORT/tcp` mapping?
2. If no port mapping: you forgot `-p PORT:PORT` in `docker run`
3. If port mapping exists but still can't connect: `docker logs <container-id>` — check if the app errored on startup
4. If the app says "listening on 127.0.0.1" instead of `0.0.0.0`: the app is only listening on the container's localhost, which host can't reach. Fix: in `app.js` use `app.listen(PORT, '0.0.0.0')`
5. In our setup, Kubernetes handles port exposure via the Service, so this scenario shows up when running `docker run` directly for testing

---

## Section 4 — Kubernetes (Student 4)

### Q1. What is Kubernetes and why do we need it on top of Docker?
Kubernetes (K8s) is a container orchestration platform. Docker alone can run a container, but if the container crashes nothing restarts it, you can't run multiple copies for load, and you have no built-in way to route traffic between them. Kubernetes manages all of this automatically across a cluster of machines.

### Q2. What is a Pod?
A Pod is the smallest deployable unit in Kubernetes. It wraps one container (usually) along with shared network and storage. Pods are considered disposable — if one dies, Kubernetes creates a new one.

### Q3. What is a Deployment?
A Deployment is a declaration of **desired state** — "I want 3 replicas of this image running at all times". Kubernetes compares the desired state to the actual state and takes corrective action to match them. If a pod crashes, the Deployment ensures a new one spawns.

### Q4. What is a Service and why do we need one?
Pods have ephemeral IP addresses that change every time they restart. A Service provides a stable IP address and DNS name that always routes to the healthy pods behind it. Clients talk to the Service, not individual pods.

### Q5. ClusterIP vs NodePort vs LoadBalancer?
- **ClusterIP** — accessible only from inside the cluster. Default.
- **NodePort** — exposes the Service on a specific port of every node in the cluster, reachable from outside. We use NodePort 30080 for our task manager.
- **LoadBalancer** — provisions a cloud load balancer (AWS ELB, GCP LB). Only works on managed clusters; not available in Minikube.

### Q6. What is `kubectl` and what does `kubectl apply -f file.yaml` do?
`kubectl` is the command-line client that talks to the Kubernetes API server. `kubectl apply -f file.yaml` sends the YAML manifest to the API server, which creates or updates the resource defined in the file. "Apply" is declarative — it brings the cluster to the state described in the file.

### Q7. What is self-healing? Can you demo it?
If I run `kubectl delete pod <name>`, Kubernetes immediately notices the Deployment now has only 2 of 3 desired pods and creates a replacement. The new pod gets a new name but serves the same traffic. The user never notices.

### Troubleshooting: "Pod stuck in CrashLoopBackOff"
`CrashLoopBackOff` means Kubernetes started the container, it crashed, Kubernetes restarted it, it crashed again, and now Kubernetes is backing off (waiting longer between restart attempts).
1. `kubectl get pods` — confirm the state
2. `kubectl describe pod <pod-name>` — look at the **Events** section at the bottom
3. `kubectl logs <pod-name>` — see the application's output just before it crashed. This is usually where the real error is: missing env var, bad config, port already in use, etc.
4. `kubectl logs <pod-name> --previous` — if the pod has already restarted, this shows logs from the previous failed instance

### Troubleshooting: "Pod stuck in ImagePullBackOff"
Kubernetes can't find or pull the Docker image.
1. `kubectl describe pod <pod-name>` — look for "Failed to pull image"
2. Check image name and tag in `deployment.yaml` — typos are common
3. If using a local image on Minikube: did you run `eval $(minikube docker-env)` before `docker build`? If not, Minikube can't see the image. Set `imagePullPolicy: Never` and rebuild inside Minikube's daemon.

---

## Section 5 — Prometheus (Prometheus/Grafana student)

### Q1. What is Prometheus?
An open-source time-series database and monitoring system. It periodically scrapes HTTP endpoints that expose metrics in a specific text format and stores every measurement with a timestamp. You can then query the data with PromQL to analyse trends or trigger alerts.

### Q2. What does "pull-based monitoring" mean?
Prometheus actively goes out and fetches ("pulls") metrics from the applications it's monitoring at regular intervals (every 5 seconds in our config). The alternative is "push-based" where the application sends metrics to the monitoring system (like StatsD). Pull is simpler to debug and scales well for cloud-native workloads.

### Q3. What is a `/metrics` endpoint?
An HTTP endpoint on the application that returns metrics in Prometheus's text exposition format — one metric per line, with its name, labels, and current value. Our Node.js app exposes `/metrics` using the `prom-client` library.

### Q4. What are the four metric types in Prometheus?
- **Counter** — only goes up (or resets to zero). Our `task_manager_http_requests_total` is a Counter.
- **Gauge** — goes up or down. Memory usage is a Gauge.
- **Histogram** — samples observations and groups them into configurable buckets. Used for request duration distributions.
- **Summary** — similar to Histogram but calculates quantiles on the client side.

### Q5. What is PromQL? Give me an example.
PromQL is Prometheus's query language. Example: `rate(task_manager_http_requests_total[1m])` returns the per-second rate of HTTP requests over the past 1 minute. We use this in Grafana to draw the live request-rate graph.

### Q6. What does `scrape_interval` mean?
How often Prometheus pulls metrics from each target. We configured ours to 5 seconds for the task-manager job so the dashboard updates quickly during the demo.

### Troubleshooting: "Prometheus target is DOWN"
1. Open Prometheus → **Status → Targets** page. Look at the error column.
2. **"connection refused"** → Prometheus reached the host but nothing is listening on that port. Verify the app is running: `kubectl get pods`, `kubectl get svc`.
3. **"no route to host"** → Networking issue. From inside the Ubuntu VM run `curl http://<target>/metrics` to test connectivity. In our setup we point Prometheus at `host.lima-internal:30080` — if that doesn't resolve, use the Mac's LAN IP instead.
4. **"404 not found"** → The URL path is wrong. Verify the app's `/metrics` endpoint works: `curl http://<app>/metrics` from Mac.
5. After any config change, run `sudo systemctl restart prometheus` on the Ubuntu VM.

---

## Section 6 — Grafana (same student as Prometheus)

### Q1. What is Grafana?
Grafana is an open-source visualisation tool. It connects to data sources like Prometheus, Loki, Elasticsearch, or SQL databases and displays the data as dashboards made up of panels (graphs, stats, tables, etc.).

### Q2. What's the difference between Prometheus and Grafana — don't they do the same thing?
Prometheus **collects and stores** metrics. Grafana **visualises** them. Prometheus's built-in UI is minimal (one chart at a time). Grafana lets you build rich multi-panel dashboards, overlay data from multiple sources, set up alerting with better routing, and share dashboards across teams.

### Q3. How did you add Prometheus as a data source in Grafana?
Through **Connections → Data sources → Add new data source → Prometheus**. We set the URL to `http://localhost:9090` (both are on the same Ubuntu VM) and clicked **Save & test**. Grafana confirmed "Successfully queried the Prometheus API".

### Q4. Walk me through one of your panels.
*(Point at the Request Rate panel.)* This panel uses the query `sum(rate(task_manager_http_requests_total[1m]))`. The inner `rate()` function calculates the per-second rate of requests over a 1-minute window. The outer `sum()` adds up the rates across all 3 pod replicas so we see total traffic as one line.

### Q5. What is a dashboard variable? (If asked — optional advanced question.)
A dashboard variable is a dropdown at the top of a dashboard that lets the viewer filter the data without editing panels. For example, you could add a `pod` variable and let the user pick which pod's metrics to display. We did not use variables in this dashboard to keep it simple.

### Troubleshooting: "Grafana panel shows no data"
1. First, verify the query works in **Prometheus** directly. Copy the exact query from the Grafana panel, paste it into Prometheus Graph tab, click Execute. If it returns no data, the problem is upstream (Prometheus isn't collecting the metric).
2. If Prometheus returns data but Grafana doesn't: open the Grafana panel in edit mode → **Query inspector** → check what Grafana actually sent and what came back.
3. Check the **time range** at the top-right of Grafana — "Last 5 minutes" won't show anything if the data was collected 10 minutes ago.
4. Verify the data source dropdown in the panel editor shows the correct Prometheus data source, not a stale one.

---

## Cross-cutting questions anyone might get

### Q. Explain the end-to-end flow of your project in one minute.
A developer pushes a code change to our GitHub repository. Jenkins is watching the repository and automatically pulls the new code, runs `npm install` and the build validation script. The code is packaged into a Docker image. The image is deployed to a Kubernetes cluster where three replicas run behind a NodePort service. The application exposes a `/metrics` endpoint that Prometheus scrapes every 5 seconds and stores as time series. Grafana reads from Prometheus and shows us a live dashboard with request rate, memory, and endpoint usage. The entire pipeline from commit to visible dashboard update takes under 30 seconds.

### Q. What is DevOps in your own words?
DevOps is a culture and set of practices where development and operations teams work together with heavy automation, so that software can be built, tested, deployed, and monitored continuously with minimal manual handoffs. Our pipeline demonstrates all four of those: build (Jenkins), test (build.js validation), deploy (Kubernetes), monitor (Prometheus + Grafana).

### Q. What is the difference between Continuous Integration and Continuous Deployment?
Continuous Integration is the practice of automatically building and testing every code change as it's committed — what Jenkins does for us. Continuous Deployment extends this by automatically releasing those tested changes to production. We have CI fully automated; our deployment to Kubernetes is manual in this demo but could be automated the same way.

### Q. Why didn't you use <some tool>? (e.g., "Why not GitHub Actions instead of Jenkins?")
Honest answer: because the CIE curriculum specifies these six tools, and they are the most widely adopted in industry. GitHub Actions and Jenkins solve the same problem; Jenkins is more flexible for self-hosted enterprise environments. Prometheus and Grafana are also the open-source standard — alternatives like Datadog or New Relic are SaaS and cost money.

### Q. What was the hardest part of this project?
Pick one honest answer:
- "Getting Prometheus to reach the application across the Mac-to-Ubuntu VM network boundary. We had to use `host.lima-internal` as the hostname."
- "Understanding that Minikube has its own Docker daemon separate from Docker Desktop, so images built outside wouldn't be visible to the cluster."
- "Writing meaningful Grafana queries — the raw counter is useless, you need `rate()` over a window to see traffic trends."

### Q. If you had more time, what would you add?
- A real GitHub webhook triggering Jenkins (instead of manual Build Now)
- Automated Docker image push + Kubernetes rollout from Jenkins
- Grafana alerting via Slack when request rate drops to zero
- Horizontal Pod Autoscaler in Kubernetes to add pods when CPU is high

---

Final rule: **when in doubt, pause for one second and think, then answer.** Faculty prefer "let me think... [pause] ... the answer is X" over a confident wrong answer blurted out immediately.

Everyone wins marks for calmness. Nobody loses marks for a 2-second pause.
