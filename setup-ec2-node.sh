#!/bin/bash
# =============================================================================
# setup-ec2-node.sh — One-click setup for k3s, kubectl, and Helm
# =============================================================================
set -e

echo "====================================================="
echo "  🚀 Bootstrapping Kubernetes (k3s) & Helm"
echo "====================================================="

# 1. Install k3s
echo "[1/4] Installing k3s..."
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -
sudo systemctl enable k3s
sudo systemctl start k3s

# 2. Configure kubeconfig for the ubuntu user
echo "[2/4] Setting up kubectl access for $USER..."
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown -R $USER:$USER ~/.kube
sudo chmod 600 ~/.kube/config

# 3. Ensure kubectl and k3s commands are in PATH
echo "[3/4] Linking kubectl in /usr/local/bin..."
sudo ln -sf /usr/local/bin/k3s /usr/local/bin/kubectl 2>/dev/null || true

# 4. Install Helm
echo "[4/4] Installing Helm..."
if ! command -v helm &>/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo ""
echo "====================================================="
echo "  🎉 Kubernetes Node is Online!"
echo "====================================================="
kubectl get nodes
