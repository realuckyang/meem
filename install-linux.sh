#!/usr/bin/env bash
set -euo pipefail

APP_NAME="meem"
REPO_URL="${MEEM_REPO:-https://github.com/realuckyang/meem.git}"
REPO_BRANCH="${MEEM_BRANCH:-main}"
APP_DIR="${MEEM_DIR:-/opt/meem}"
APP_USER="${MEEM_USER:-meem}"
MAIN_PORT="${MEEM_MAIN_PORT:-9507}"
APPS_PORT="${MEEM_APPS_PORT:-9508}"
SERVER_NAME="${MEEM_SERVER_NAME:-_}"
NODE_MAJOR="${MEEM_NODE_MAJOR:-22}"
SKIP_NGINX="${MEEM_SKIP_NGINX:-0}"
NGINX_DEFAULT_SERVER="${MEEM_NGINX_DEFAULT_SERVER:-}"

log() {
  printf '\033[1;32m==> %s\033[0m\n' "$*"
}

warn() {
  printf '\033[1;33mWARN: %s\033[0m\n' "$*" >&2
}

fail() {
  printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2
  exit 1
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "Run this installer as root, for example: curl -fsSL https://raw.githubusercontent.com/realuckyang/meem/main/install-linux.sh | sudo bash"
  fi
}

require_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    fail "This installer currently supports Debian/Ubuntu systems with apt-get."
  fi
}

install_base_packages() {
  log "Installing system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    git \
    rsync \
    build-essential \
    python3 \
    make \
    g++

  if [ "$SKIP_NGINX" != "1" ]; then
    apt-get install -y nginx
  fi
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi
  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0
}

install_node() {
  local current_major
  current_major="$(node_major_version)"
  if [ "$current_major" -ge "$NODE_MAJOR" ]; then
    log "Node.js $(node -v) is already installed"
    return
  fi

  log "Installing Node.js ${NODE_MAJOR}.x"
  install -d -m 0755 /etc/apt/keyrings
  rm -f /etc/apt/keyrings/nodesource.gpg
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' "$NODE_MAJOR" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

ensure_user() {
  if id "$APP_USER" >/dev/null 2>&1; then
    log "User $APP_USER already exists"
    return
  fi

  log "Creating system user $APP_USER"
  useradd --system --create-home --home-dir "/var/lib/$APP_NAME" --shell /bin/bash "$APP_USER"
}

deploy_source() {
  log "Fetching $REPO_URL#$REPO_BRANCH"

  (
    local tmp_dir
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT

    git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$tmp_dir/repo"

    mkdir -p "$APP_DIR/database" "$APP_DIR/files"
    rsync -a --delete \
      --exclude '/database' \
      --exclude '/files' \
      "$tmp_dir/repo/" "$APP_DIR/"

    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  )
}

build_app() {
  log "Installing npm dependencies"
  cd "$APP_DIR"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi

  log "Building frontend"
  npm run build

  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

write_systemd_service() {
  local npm_bin
  npm_bin="$(command -v npm)"

  log "Writing systemd service"
  cat > /etc/systemd/system/meem.service <<SERVICE
[Unit]
Description=meem personal knowledge base
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=MEEM_MAIN_PORT=$MAIN_PORT
Environment=MEEM_APPS_PORT=$APPS_PORT
Environment=MEEM_SERVE_GUI=1
Environment=MEEM_FILES_DIR=$APP_DIR/files
ExecStart=$npm_bin run start
Restart=always
RestartSec=3
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable meem
}

write_nginx_site() {
  if [ "$SKIP_NGINX" = "1" ]; then
    warn "Skipping nginx configuration because MEEM_SKIP_NGINX=1"
    return
  fi

  local listen_suffix=""
  if [ -z "$NGINX_DEFAULT_SERVER" ]; then
    if [ "$SERVER_NAME" = "_" ]; then
      NGINX_DEFAULT_SERVER="1"
    else
      NGINX_DEFAULT_SERVER="0"
    fi
  fi

  if [ "$NGINX_DEFAULT_SERVER" = "1" ]; then
    listen_suffix=" default_server"
    rm -f /etc/nginx/sites-enabled/default
  fi

  log "Writing nginx site"
  cat > /etc/nginx/sites-available/meem <<'NGINX'
map $http_upgrade $meem_connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80__LISTEN_SUFFIX__;
  listen [::]:80__LISTEN_SUFFIX__;
  server_name __SERVER_NAME__;

  client_max_body_size 50m;

  location / {
    proxy_pass http://127.0.0.1:__MAIN_PORT__;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $meem_connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
NGINX

  sed -i \
    -e "s#__MAIN_PORT__#$MAIN_PORT#g" \
    -e "s#__SERVER_NAME__#$SERVER_NAME#g" \
    -e "s#__LISTEN_SUFFIX__#$listen_suffix#g" \
    /etc/nginx/sites-available/meem

  ln -sf /etc/nginx/sites-available/meem /etc/nginx/sites-enabled/meem
  nginx -t
  systemctl enable nginx
}

allow_firewall() {
  if [ "$SKIP_NGINX" = "1" ]; then
    return
  fi
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
    log "Opening HTTP in ufw"
    ufw allow 'Nginx HTTP' || ufw allow 80/tcp || true
  fi
}

restart_services() {
  log "Starting meem"
  systemctl restart meem

  if [ "$SKIP_NGINX" != "1" ]; then
    log "Starting nginx"
    systemctl restart nginx
  fi
}

wait_for_meem() {
  log "Checking meem health"
  local ok=0
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$MAIN_PORT/api/health" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 1
  done

  if [ "$ok" != "1" ]; then
    journalctl -u meem --no-pager -n 80 || true
    fail "meem did not become healthy on 127.0.0.1:$MAIN_PORT"
  fi
}

public_host() {
  if [ "$SERVER_NAME" != "_" ]; then
    echo "$SERVER_NAME"
    return
  fi

  curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "your-server-ip"
}

print_summary() {
  local url
  if [ "$SKIP_NGINX" = "1" ]; then
    url="http://$(public_host):$MAIN_PORT"
  else
    url="http://$(public_host)"
  fi

  cat <<SUMMARY

meem is installed.

URL: $url
App directory: $APP_DIR
Service: systemctl status meem
Logs: journalctl -u meem -f

SUMMARY
}

main() {
  require_root
  require_apt
  install_base_packages
  install_node
  ensure_user
  deploy_source
  build_app
  write_systemd_service
  write_nginx_site
  allow_firewall
  restart_services
  wait_for_meem
  print_summary
}

main "$@"
