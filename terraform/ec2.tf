# =============================================================================
# terraform/ec2.tf
# Two EC2 t3.small instances:
#   1. app_server  — runs k3s (Kubernetes) with backend + frontend pods
#   2. jenkins_server — runs Jenkins inside Docker
#
# Both use Ubuntu 22.04 LTS.  user_data scripts bootstrap the software
# automatically on first boot so no manual SSH setup is required.
# =============================================================================

# ---------------------------------------------------------------------------
# Data source — latest Ubuntu 22.04 LTS AMI (fallback if variable not set)
# ---------------------------------------------------------------------------
data "aws_ami" "ubuntu_22" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  ami = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu_22.id
}

# ---------------------------------------------------------------------------
# Security Group — App server (k3s node)
# ---------------------------------------------------------------------------
resource "aws_security_group" "app_server" {
  name        = "${var.app_name}-app-sg"
  description = "Allow HTTP traffic to the app and SSH for management"

  # SSH
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # Next.js frontend
  ingress {
    description = "Next.js frontend"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # FastAPI backend
  ingress {
    description = "FastAPI backend"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Grafana NodePort
  ingress {
    description = "Grafana"
    from_port   = 3100
    to_port     = 3100
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Prometheus NodePort
  ingress {
    description = "Prometheus"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # k3s API server (kubectl access from Jenkins)
  ingress {
    description = "k3s API"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Jenkins UI
  ingress {
    description = "Jenkins Web UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Kubernetes NodePort range (30000-32767)
  ingress {
    description = "Kubernetes NodePorts"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic allowed
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-app-sg"
  }
}

# ---------------------------------------------------------------------------
# Security Group — Jenkins server
# ---------------------------------------------------------------------------
resource "aws_security_group" "jenkins_server" {
  count       = var.enable_separate_jenkins ? 1 : 0
  name        = "${var.app_name}-jenkins-sg"
  description = "Allow Jenkins UI access and SSH"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "Jenkins Web UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-jenkins-sg"
  }
}

# ---------------------------------------------------------------------------
# IAM Instance Profile — lets the app EC2 talk to DynamoDB without keys
# ---------------------------------------------------------------------------
resource "aws_iam_instance_profile" "app_server" {
  count = var.enable_dynamodb ? 1 : 0
  name  = "${var.app_name}-app-instance-profile"
  role  = aws_iam_role.app_ec2_role[0].name
}

# ---------------------------------------------------------------------------
# user_data — App server bootstrap (k3s + Docker + Helm)
# Runs once on first boot.  Takes ~5 minutes to complete.
# ---------------------------------------------------------------------------
locals {
  app_user_data = <<-BASH
    #!/bin/bash
    set -euxo pipefail
    export DEBIAN_FRONTEND=noninteractive

    # --- System update ---
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget git unzip awscli

    # --- Install Docker (needed for Helm + image management) ---
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu
    systemctl enable docker
    systemctl start docker

    # --- Determine Public IP dynamically for k3s TLS SAN & kubeconfig ---
    PUBLIC_IP=$(curl -s https://ifconfig.me || curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "127.0.0.1")

    # --- Install k3s (lightweight certified Kubernetes) ---
    # Disable traefik — we'll use Nginx ingress instead; add tls-san for remote kubectl
    curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --tls-san $PUBLIC_IP" sh -
    systemctl enable k3s

    # Allow ubuntu user to use kubectl without sudo
    mkdir -p /home/ubuntu/.kube
    cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
    sed -i "s/127.0.0.1/$PUBLIC_IP/g" /home/ubuntu/.kube/config
    chown -R ubuntu:ubuntu /home/ubuntu/.kube

    # --- Install Helm ---
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

    # --- Install kubectl (standalone, matches k3s version) ---
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

    # --- Signal completion ---
    echo "Bootstrap complete at $(date)" >> /var/log/bootstrap.log
  BASH

  jenkins_user_data = <<-BASH
    #!/bin/bash
    set -euxo pipefail
    export DEBIAN_FRONTEND=noninteractive

    # --- System update ---
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y curl wget git unzip awscli

    # --- Install Docker ---
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu
    systemctl enable docker
    systemctl start docker

    # --- Install kubectl (to deploy to k3s from Jenkins) ---
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

    # --- Install Trivy (container vulnerability scanner — Unit V) ---
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -
    echo "deb https://aquasecurity.github.io/trivy-repo/deb generic main" \
        > /etc/apt/sources.list.d/trivy.list
    apt-get update -y
    apt-get install -y trivy

    # --- Run Jenkins as a Docker container ---
    docker run -d \
      --name jenkins \
      --restart unless-stopped \
      -p 8080:8080 \
      -p 50000:50000 \
      -v jenkins_home:/var/jenkins_home \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v $(which docker):/usr/bin/docker \
      jenkins/jenkins:lts-jdk17

    echo "Jenkins bootstrap complete at $(date)" >> /var/log/bootstrap.log
  BASH
}

# ---------------------------------------------------------------------------
# EC2 Instance — App Server (k3s)
# ---------------------------------------------------------------------------
resource "aws_instance" "app_server" {
  ami                    = local.ami
  instance_type          = var.app_instance_type   # t3.small
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.app_server.id]
  iam_instance_profile   = var.enable_dynamodb ? aws_iam_instance_profile.app_server[0].name : null

  user_data = local.app_user_data

  # 20 GB gp3 root volume (free tier gives 30 GB EBS)
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
    encrypted             = true
  }

  tags = {
    Name = "${var.app_name}-app-server"
    Role = "k3s-node"
  }
}

# ---------------------------------------------------------------------------
# EC2 Instance — Jenkins Server (Optional: set enable_separate_jenkins = true)
# ---------------------------------------------------------------------------
resource "aws_instance" "jenkins_server" {
  count                  = var.enable_separate_jenkins ? 1 : 0
  ami                    = local.ami
  instance_type          = var.jenkins_instance_type   # t3.small
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.jenkins_server[0].id]

  user_data = local.jenkins_user_data

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
    encrypted             = true
  }

  tags = {
    Name = "${var.app_name}-jenkins-server"
    Role = "ci-cd"
  }
}

# ---------------------------------------------------------------------------
# Elastic IP — keeps the app server IP stable across stop/start
# ---------------------------------------------------------------------------
resource "aws_eip" "app_server" {
  instance = aws_instance.app_server.id
  domain   = "vpc"

  tags = {
    Name = "${var.app_name}-app-eip"
  }
}

resource "aws_eip" "jenkins_server" {
  count    = var.enable_separate_jenkins ? 1 : 0
  instance = aws_instance.jenkins_server[0].id
  domain   = "vpc"

  tags = {
    Name = "${var.app_name}-jenkins-eip"
  }
}
