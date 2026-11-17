#!/bin/bash
# =============================================================================
# deploy-monitoring.sh — Deploy Prometheus, Grafana & Alertmanager Stack
# =============================================================================
set -euo pipefail

echo "====================================================="
echo "  📊 Deploying Prometheus & Grafana Monitoring Stack"
echo "====================================================="

# 1. Add Helm repository
echo "[1/4] Adding Prometheus Community Helm repository..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. Install or upgrade kube-prometheus-stack
echo "[2/4] Installing kube-prometheus-stack in 'monitoring' namespace..."
helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f k8s/monitoring/prometheus-values.yaml

# 3. Apply ServiceMonitor and Alerting Rules
echo "[3/4] Applying custom ServiceMonitor and alerting rules..."
kubectl apply -f k8s/monitoring/servicemonitor.yaml
kubectl apply -f k8s/monitoring/alerting-rules.yaml

# 4. Wait for Grafana and Prometheus pods to be ready
echo "[4/4] Verifying monitoring pods..."
kubectl rollout status deployment/kube-prom-grafana -n monitoring --timeout=180s || true

echo ""
echo "====================================================="
echo "  🎉 Monitoring Stack Deployed!"
echo "====================================================="
PUBLIC_IP=$(curl -s ifconfig.me || echo "<APP_SERVER_IP>")
echo "Prometheus: http://${PUBLIC_IP}:30090"
echo "Grafana:    http://${PUBLIC_IP}:30100 (admin / HomePriceGrafana2024!)"
