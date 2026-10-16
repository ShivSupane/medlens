# MedLens --- EC2 Deployment Guide

This guide documents the MedLens deployment workflow: pushing code from
your Windows/WSL development environment, connecting to EC2,
building/running the Docker Compose app, checking the live site, and
redeploying future changes.

## 1. Project and deployment details

-   **Local project folder (WSL):**
    `/mnt/c/Users/ROYAL/shiv_DOS/peroject/medchatbot/medicine-recommender-app`
-   **Git branch:** `main`
-   **Git remote:** `origin` (GitHub repository)
-   **EC2 instance name:** `medlens-serve`
-   **EC2 login user:** `ubuntu`
-   **EC2 public DNS:**
    `ec2-3-6-249-23.ap-south-1.compute.amazonaws.com`
-   **Public website:** <https://medlens.duckdns.org>
-   **Health endpoint:** <https://medlens.duckdns.org/api/health>
-   **Server project directory:** `~/medlens`
-   **Docker Compose service/container:** `medlens`
-   **App port:** `127.0.0.1:3000` on the EC2 host, proxied through
    Nginx
-   **TLS certificate:** managed by Certbot for `medlens.duckdns.org`

> Do not put API keys, passwords, `.env` contents, or your `.pem`
> private key in this document or commit them to Git. Keep `server/.env`
> private and ensure it is ignored by Git.

## 2. Which terminal should I use?

You will use two terminals:

-   **Local WSL terminal:** prompt usually looks like `shiv@SHIV:...$`.
    Use this for editing, Git add/commit/push, and SSH from your own
    computer.
-   **EC2 server terminal:** prompt usually looks like
    `ubuntu@ip-172-31-15-241:~/medlens$`. Use this for `git pull`,
    Docker Compose, and checking the deployed app.

Do not run local Git push commands in the EC2 terminal. Do not run
server Docker commands in the local project terminal unless you are
intentionally working on a local Docker setup.

## 3. One-time EC2 initialization (only if setting up a new instance)

Skip this section for the existing, already-working `medlens-serve`
server.

### 3.1 Create and configure the EC2 instance

In AWS Console:

1.  Open **EC2 → Instances → Launch instance**.
2.  Choose a supported Ubuntu Server image.
3.  Select an instance type suitable for your app and expected use.
4.  Create or select a key pair and download the `.pem` file. Keep it
    private; AWS cannot show you the private key again later.
5.  Configure the security group. Allow:
    -   **SSH TCP 22** from your current public IP only (`My IP`,
        normally shown as `/32`).
    -   **HTTP TCP 80** from `0.0.0.0/0` so HTTP can redirect to HTTPS
        and for certificate setup.
    -   **HTTPS TCP 443** from `0.0.0.0/0`.
6.  Launch the instance.
7.  Associate an Elastic IP if you need a stable public IPv4 address.
    Update the DNS record for `medlens.duckdns.org` to the instance's
    public IP.

Do not open SSH to `0.0.0.0/0` unless you have a carefully considered
alternative security design. If your home/network public IP changes,
update the SSH rule to your new IP.

### 3.2 Connect from WSL

If the key is in your Windows folder, copy it into WSL's Linux
filesystem so OpenSSH can enforce strict permissions.

Example using this machine's key location:

``` bash
sudo mkdir -p /home/shiv/.ssh
sudo chown -R shiv:shiv /home/shiv/.ssh
sudo chmod 700 /home/shiv/.ssh

cp "/mnt/c/Users/ROYAL/OneDrive - dypiu.ac.in/Desktop/keybhai/medlens-key.pem" /home/shiv/.ssh/medlens-key.pem
chmod 400 /home/shiv/.ssh/medlens-key.pem
```

If `cp` says `Permission denied`, inspect the directory ownership and
permissions:

``` bash
ls -ld /home/shiv /home/shiv/.ssh
ls -l /home/shiv/.ssh
```

If the key is already present at `/home/shiv/.ssh/medlens-key.pem`, you
do not need to copy it again.

Connect:

``` bash
ssh -o ConnectTimeout=10 -i /home/shiv/.ssh/medlens-key.pem ubuntu@ec2-3-6-249-23.ap-south-1.compute.amazonaws.com
```

If SSH times out, check that the instance is **Running**, its public
IP/DNS is current, and its security group's inbound SSH rule allows your
current public IP. To check your public IP from WSL:

``` bash
curl -4 https://checkip.amazonaws.com
```

If SSH returns `Permission denied (publickey)`, confirm that you are
using the private key matching the key pair assigned to the instance and
the correct login user (`ubuntu` for Ubuntu images). A key-permissions
warning is different: verify `chmod 400` and that the key is in the
Linux filesystem.

### 3.3 Install the app's server prerequisites

These are typical setup commands for a new Ubuntu EC2 instance. Review
your project's actual Dockerfile and deployment files before applying
them to a different server.

Update package lists:

``` bash
sudo apt update
sudo apt upgrade -y
```

Install Git and basic tools:

``` bash
sudo apt install -y git curl ca-certificates
```

Install Docker Engine and the Docker Compose plugin using Docker's
official Ubuntu installation instructions:
<https://docs.docker.com/engine/install/ubuntu/>

Verify:

``` bash
docker --version
docker compose version
git --version
```

The current MedLens server already has Docker, Docker Compose, Nginx,
and Certbot configured; do not repeat the initial setup on the existing
server without a reason.

### 3.4 Get the project onto EC2

The current server uses `~/medlens`:

``` bash
cd ~
git clone https://github.com/ShivSupane/medlens.git
cd ~/medlens
```

If the folder already exists, do **not** clone it again. Use:

``` bash
cd ~/medlens
git status
```

### 3.5 Configure environment variables safely

The app's private environment file is `server/.env`. Create or edit it
on the server using the variable names expected by the application:

``` bash
cd ~/medlens
nano server/.env
chmod 600 server/.env
```

Do not copy real API keys into chat, screenshots, Git commits, or this
guide. Check that `.env` is ignored by Git before pushing code:

``` bash
git check-ignore server/.env
git status --short
```

If the `.env` file is not ignored, stop and fix `.gitignore` before
committing. Never commit credentials.

### 3.6 Start the app with Docker Compose

The current deployment binds the app to localhost on the EC2 host
(`127.0.0.1:3000`) so external traffic goes through Nginx rather than
exposing the app port directly.

``` bash
cd ~/medlens
sudo docker compose up -d --build
sudo docker ps
curl -s http://127.0.0.1:3000/api/health
```

The container should show as running/healthy if a health check is
configured.

### 3.7 Nginx and HTTPS (initial setup only)

The current server uses Nginx to proxy requests to
`http://127.0.0.1:3000` and Certbot for HTTPS. On a new server,
configure Nginx for the domain and obtain a certificate using the
official Certbot instructions: <https://certbot.eff.org/>

Check Nginx:

``` bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl status nginx --no-pager
```

Check certificate renewal configuration:

``` bash
sudo certbot renew --dry-run
```

Do not copy a certificate or private TLS key from another machine; issue
a certificate for the new server/domain configuration.

## 4. Normal workflow: change code and push it to GitHub

Run these commands in **local WSL**, from the project folder:

``` bash
cd "/mnt/c/Users/ROYAL/shiv_DOS/peroject/medchatbot/medicine-recommender-app"
git status
```

Review the changed files. Stage only the files you intend to deploy.
Example:

``` bash
git add server/services/aiService.js
```

For another change, replace that path with the relevant file(s). Avoid
`git add .` if there are test outputs, logs, secrets, or other files you
do not want to publish.

Review the staged changes and whitespace:

``` bash
git diff --cached
git diff --cached --check
git status
```

Commit and push:

``` bash
git commit -m "Describe the change"
git push origin main
```

If Git says there is nothing to commit, check `git status`. If the push
is rejected because the remote has new commits, do not force-push;
inspect the message and reconcile the branch first.

### Example used for an AI service change

``` bash
git add server/services/aiService.js
git diff --cached --check
git commit -m "Update AI service"
git push origin main
```

Only add the file(s) you intentionally changed. Leave generated files
such as `test_error.txt` and `test_output.txt` out of the commit unless
they are deliberately part of the project.

## 5. Redeploy on the existing EC2 server (manual deployment)

After `git push origin main` succeeds, connect to EC2 from WSL:

``` bash
ssh -i /home/shiv/.ssh/medlens-key.pem ubuntu@ec2-3-6-249-23.ap-south-1.compute.amazonaws.com
```

Then run these commands in the **EC2 terminal**:

``` bash
cd ~/medlens
git status
git pull --ff-only origin main
sudo docker compose up -d --build
```

What each command does:

-   `git pull --ff-only origin main` fetches and applies the pushed
    `main` changes only if the server branch can fast-forward cleanly.
-   `sudo docker compose up -d --build` rebuilds the image with the
    latest code and recreates/restarts the service as needed.

If `git pull` reports local changes or refuses to fast-forward, stop and
inspect `git status`; do not overwrite server files blindly. The server
may intentionally have a local deployment-specific change in
`docker-compose.yml`, including the `127.0.0.1:3000:3000` port binding.
Preserve that binding unless you deliberately redesign the deployment.

## 6. Verify the deployment

On EC2:

``` bash
sudo docker ps
curl -s http://127.0.0.1:3000/api/health
curl -s https://medlens.duckdns.org/api/health
```

Expected health response:

``` json
{"status":"ok","app":"MedLens"}
```

Then open the site in a browser:

<https://medlens.duckdns.org>

Test the specific feature you changed, not just the health endpoint. A
healthy endpoint proves the app responds; it does not prove every
feature works.

Useful diagnostics if something fails:

``` bash
sudo docker compose logs --tail=100
sudo docker logs --tail=100 medlens
sudo nginx -t
sudo systemctl status nginx --no-pager
```

For recent logs while investigating a failure:

``` bash
sudo docker compose logs -f
```

Press `Ctrl+C` to stop following logs; this does not stop the container.

## 7. Common problems and fixes

### SSH says `UNPROTECTED PRIVATE KEY FILE`

The key permissions are too open. In WSL:

``` bash
chmod 400 /home/shiv/.ssh/medlens-key.pem
```

Use the key from `/home/shiv/.ssh/`, not directly from a Windows-mounted
folder.

### SSH says `Connection timed out`

This is normally a network/security-group path issue, not a key issue:

1.  Confirm EC2 state is **Running**.
2.  Confirm the public IP/DNS is current.
3.  Confirm the security group has TCP 22 from your current public IP
    with `/32`.
4.  Check that the instance's network route and public IP configuration
    are valid.

Test with:

``` bash
ssh -o ConnectTimeout=10 -vv -i /home/shiv/.ssh/medlens-key.pem ubuntu@ec2-3-6-249-23.ap-south-1.compute.amazonaws.com
```

### SSH says `Permission denied (publickey)`

The server was reached, but authentication failed. Confirm the correct
key pair and username. Do not send the private key to anyone.

### `git pull` fails on EC2

Run:

``` bash
cd ~/medlens
git status
git branch --show-current
git remote -v
```

The expected branch is `main`. If there are local changes, review them
before deciding how to proceed; do not use a destructive reset as a
shortcut.

### The site is down after a restart

Check the EC2 instance is **Running**, then connect and run:

``` bash
sudo docker ps -a
sudo docker compose ps
sudo docker compose logs --tail=100
sudo systemctl status nginx --no-pager
```

The current container has a Docker restart policy intended to restart it
when Docker starts, unless it was explicitly stopped. Nginx is enabled
to start with the system. Still verify the site after a restart rather
than assuming it worked.

### Site works, but the latest feature does not

1.  Confirm `git push origin main` succeeded locally.
2.  On EC2, run `git log -1 --oneline` and compare it with local
    `git log -1 --oneline`.
3.  Rebuild with `sudo docker compose up -d --build`.
4.  Inspect logs and test the feature in the browser.

## 8. Quick redeployment checklist

Every time you change code:

**Local WSL**

``` bash
cd "/mnt/c/Users/ROYAL/shiv_DOS/peroject/medchatbot/medicine-recommender-app"
git status
git add path/to/changed-file.js
git diff --cached --check
git commit -m "Describe the change"
git push origin main
```

**Connect to EC2**

``` bash
ssh -i /home/shiv/.ssh/medlens-key.pem ubuntu@ec2-3-6-249-23.ap-south-1.compute.amazonaws.com
```

**On EC2**

``` bash
cd ~/medlens
git pull --ff-only origin main
sudo docker compose up -d --build
sudo docker ps
curl -s https://medlens.duckdns.org/api/health
```

Finally, open <https://medlens.duckdns.org> and test the feature.

## 9. Automatic deployment note

A GitHub Actions deployment workflow exists, but it previously failed
with an SSH connection timeout. The manual procedure above is the
confirmed working deployment route. Do not assume a push automatically
deploys until the workflow completes successfully in the GitHub
**Actions** tab.

For a secure automated setup, consider AWS Systems Manager (SSM) or
another managed deployment approach. If using GitHub-hosted runners over
SSH, the runner's changing source IPs make a fixed IP allow-list
difficult; do not solve this by casually opening SSH to the entire
internet.

## 10. Security reminders

-   Never commit `.env`, API keys, SSH private keys, or TLS private
    keys.
-   Do not paste secrets into chat or logs.
-   Keep SSH restricted to trusted source IPs or use a managed access
    method such as SSM.
-   Keep HTTP/HTTPS open only as required for the public website.
-   Back up important configuration before changing Nginx, Docker
    Compose, or security-group rules.
-   Test the public site and the changed feature after every deployment.
