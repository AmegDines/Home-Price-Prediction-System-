// =============================================================================
// Jenkinsfile — Home Price Prediction CI/CD Pipeline
// (Unit IV — CI/CD Pipeline Fundamentals, Jenkins, Cloud Integration)
//
// Pipeline Stages:
//   1. Checkout          — pull source code from GitHub
//   2. Lint & Test       — run pytest (backend) + next lint (frontend)
//   3. Security Scan     — Trivy vulnerability scan on built images (Unit V)
//   4. Build Images      — docker build backend + frontend
//   5. Push to ECR       — push tagged images to ECR Public
//   6. Deploy to k3s     — kubectl apply all k8s manifests
//   7. Smoke Test        — verify /api/health returns 200
//
// Prerequisites in Jenkins:
//   - Credential "aws-credentials"      → AWS Access Key ID + Secret (kind: AWS)
//   - Credential "k3s-kubeconfig"       → kubeconfig file from app server
//   - Credential "ecr-public-uri-backend"  → ECR backend image URI (Secret text)
//   - Credential "ecr-public-uri-frontend" → ECR frontend image URI (Secret text)
//   - Credential "app-server-ip"        → Public IP of app EC2 (Secret text)
// =============================================================================

pipeline {
    agent any

    environment {
        AWS_REGION          = 'ap-south-1'
        ECR_REGION          = 'us-east-1'          // ECR Public API region
        APP_NAME            = 'home-price'
        BACKEND_IMAGE_NAME  = 'home-price-backend'
        FRONTEND_IMAGE_NAME = 'home-price-frontend'
        K8S_NAMESPACE       = 'home-price'
        PYTHON_VERSION      = '3.12'
    }

    options {
        // Keep only last 10 builds to save disk space on t3.small
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Fail the pipeline if it runs longer than 30 minutes
        timeout(time: 30, unit: 'MINUTES')
        // Don't allow concurrent builds — prevents deploy race conditions
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        // =====================================================================
        // Stage 1 — Checkout
        // =====================================================================
        stage('Checkout') {
            steps {
                echo '📥 Checking out source code...'
                checkout scm
                script {
                    // Tag image with git short SHA for traceability
                    env.GIT_SHORT_SHA = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.IMAGE_TAG = "${env.GIT_SHORT_SHA}-${env.BUILD_NUMBER}"
                    echo "Image tag: ${env.IMAGE_TAG}"
                }
            }
        }

        // =====================================================================
        // Stage 2 — Lint & Test
        // =====================================================================
        stage('Lint and Test') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        echo '🧪 Running backend tests with pytest...'
                        sh '''
                            cd server
                            python${PYTHON_VERSION} -m venv .ci-venv
                            . .ci-venv/bin/activate
                            pip install --upgrade pip -q
                            pip install -r requirements.txt pytest -q
                            python -m pytest tests/ -v --tb=short --junit-xml=test-results-backend.xml
                        '''
                    }
                    post {
                        always {
                            junit 'server/test-results-backend.xml'
                        }
                    }
                }

                stage('Frontend Lint') {
                    steps {
                        echo '🔍 Running Next.js lint...'
                        sh '''
                            cd frontend
                            npm ci --omit=dev -q
                            npm run lint -- --max-warnings 0
                        '''
                    }
                }
            }
        }

        // =====================================================================
        // Stage 3 — Build Docker Images
        // Build before scanning so Trivy scans the actual image that ships.
        // =====================================================================
        stage('Build Docker Images') {
            steps {
                echo '🐳 Building Docker images...'
                withCredentials([
                    string(credentialsId: 'ecr-public-uri-backend',  variable: 'BACKEND_URI'),
                    string(credentialsId: 'ecr-public-uri-frontend', variable: 'FRONTEND_URI'),
                    string(credentialsId: 'app-server-ip',           variable: 'APP_SERVER_IP')
                ]) {
                    sh '''
                        # Build backend image (multi-stage — builder + runtime)
                        docker build \
                            -t ${BACKEND_IMAGE_NAME}:${IMAGE_TAG} \
                            -t ${BACKEND_IMAGE_NAME}:latest \
                            ./server

                        # Build frontend image with build-arg for API URL
                        docker build \
                            --build-arg NEXT_PUBLIC_API_BASE_URL=http://${APP_SERVER_IP}:8000 \
                            -t ${FRONTEND_IMAGE_NAME}:${IMAGE_TAG} \
                            -t ${FRONTEND_IMAGE_NAME}:latest \
                            ./frontend
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 4 — Security Scan with Trivy
        // (Unit V — DevSecOps, securing CI/CD pipelines)
        // Scans built images for CVEs. Fails on CRITICAL vulnerabilities.
        // =====================================================================
        stage('Security Scan (Trivy)') {
            steps {
                echo '🔒 Running Trivy vulnerability scan...'
                sh '''
                    # Scan backend image — fail on CRITICAL CVEs
                    trivy image \
                        --severity CRITICAL,HIGH \
                        --exit-code 1 \
                        --format table \
                        --no-progress \
                        --ignore-unfixed \
                        ${BACKEND_IMAGE_NAME}:${IMAGE_TAG}

                    # Scan frontend image
                    trivy image \
                        --severity CRITICAL,HIGH \
                        --exit-code 1 \
                        --format table \
                        --no-progress \
                        --ignore-unfixed \
                        ${FRONTEND_IMAGE_NAME}:${IMAGE_TAG}
                '''
            }
        }

        // =====================================================================
        // Stage 5 — Push to ECR Public
        // (Unit II — Containerization lifecycle: build → tag → push → pull)
        // =====================================================================
        stage('Push to ECR') {
            steps {
                echo '📤 Pushing images to ECR Public...'
                withCredentials([
                    [
                        $class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: 'aws-credentials',
                        accessKeyVariable: 'AWS_ACCESS_KEY_ID',
                        secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'
                    ],
                    string(credentialsId: 'ecr-public-uri-backend',  variable: 'BACKEND_URI'),
                    string(credentialsId: 'ecr-public-uri-frontend', variable: 'FRONTEND_URI')
                ]) {
                    sh '''
                        # Authenticate with ECR Public (must use us-east-1)
                        aws ecr-public get-login-password --region ${ECR_REGION} \
                            | docker login --username AWS --password-stdin public.ecr.aws

                        # Tag and push backend
                        docker tag ${BACKEND_IMAGE_NAME}:${IMAGE_TAG} ${BACKEND_URI}:${IMAGE_TAG}
                        docker tag ${BACKEND_IMAGE_NAME}:latest        ${BACKEND_URI}:latest
                        docker push ${BACKEND_URI}:${IMAGE_TAG}
                        docker push ${BACKEND_URI}:latest

                        # Tag and push frontend
                        docker tag ${FRONTEND_IMAGE_NAME}:${IMAGE_TAG} ${FRONTEND_URI}:${IMAGE_TAG}
                        docker tag ${FRONTEND_IMAGE_NAME}:latest        ${FRONTEND_URI}:latest
                        docker push ${FRONTEND_URI}:${IMAGE_TAG}
                        docker push ${FRONTEND_URI}:latest
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 6 — Deploy to k3s
        // (Unit II — Kubernetes; Unit IV — Integrating with Cloud Infrastructure)
        // Uses kubectl with the kubeconfig from the k3s app server.
        // =====================================================================
        stage('Deploy to k3s') {
            steps {
                echo '🚀 Deploying to k3s cluster...'
                withCredentials([
                    file(credentialsId: 'k3s-kubeconfig', variable: 'KUBECONFIG'),
                    string(credentialsId: 'ecr-public-uri-backend',  variable: 'BACKEND_URI'),
                    string(credentialsId: 'ecr-public-uri-frontend', variable: 'FRONTEND_URI')
                ]) {
                    sh '''
                        export KUBECONFIG=${KUBECONFIG}

                        # Apply namespace first (idempotent)
                        kubectl apply -f k8s/namespace.yaml

                        # Update image tags in manifests with the current build tag
                        sed -i "s|public.ecr.aws/YOUR_ALIAS/home-price-backend:latest|${BACKEND_URI}:${IMAGE_TAG}|g" \
                            k8s/backend/deployment.yaml
                        sed -i "s|public.ecr.aws/YOUR_ALIAS/home-price-frontend:latest|${FRONTEND_URI}:${IMAGE_TAG}|g" \
                            k8s/frontend/deployment.yaml

                        # Apply all backend manifests
                        kubectl apply -f k8s/backend/secret.yaml     -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/backend/deployment.yaml  -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/backend/service.yaml     -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/backend/hpa.yaml         -n ${K8S_NAMESPACE}

                        # Apply all frontend manifests
                        kubectl apply -f k8s/frontend/configmap.yaml  -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/frontend/deployment.yaml -n ${K8S_NAMESPACE}
                        kubectl apply -f k8s/frontend/service.yaml    -n ${K8S_NAMESPACE}

                        # Apply ingress
                        kubectl apply -f k8s/ingress/ingress.yaml     -n ${K8S_NAMESPACE}

                        # Apply monitoring (ServiceMonitor + AlertRules)
                        kubectl apply -f k8s/monitoring/servicemonitor.yaml
                        kubectl apply -f k8s/monitoring/alerting-rules.yaml

                        # Wait for rollout to complete (timeout 5 minutes)
                        kubectl rollout status deployment/home-price-backend \
                            -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/home-price-frontend \
                            -n ${K8S_NAMESPACE} --timeout=300s
                    '''
                }
            }
        }

        // =====================================================================
        // Stage 7 — Smoke Test
        // (Unit IV — Automated testing integrated with cloud deployments)
        // =====================================================================
        stage('Smoke Test') {
            steps {
                echo '✅ Running smoke test against deployed API...'
                withCredentials([
                    string(credentialsId: 'app-server-ip', variable: 'APP_SERVER_IP')
                ]) {
                    sh '''
                        # Wait for the service to be ready
                        sleep 10

                        # Health check
                        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
                            http://${APP_SERVER_IP}:8000/api/health)

                        if [ "$HTTP_STATUS" != "200" ]; then
                            echo "❌ Health check FAILED — HTTP status: $HTTP_STATUS"
                            exit 1
                        fi
                        echo "✅ Health check PASSED — HTTP status: $HTTP_STATUS"

                        # Test prediction endpoint
                        PREDICT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
                            -X POST http://${APP_SERVER_IP}:8000/api/predict \
                            -H "Content-Type: application/json" \
                            -d \'{"location":"whitefield","sqft":1200,"bhk":3,"bath":2}\')

                        if [ "$PREDICT_STATUS" != "200" ]; then
                            echo "❌ Prediction endpoint FAILED — HTTP status: $PREDICT_STATUS"
                            exit 1
                        fi
                        echo "✅ Prediction endpoint PASSED — HTTP status: $PREDICT_STATUS"
                    '''
                }
            }
        }
    }

    // =========================================================================
    // Post-build actions
    // =========================================================================
    post {
        success {
            echo """
            ============================================
            ✅ DEPLOYMENT SUCCESSFUL
            Build:  #${env.BUILD_NUMBER}
            Commit: ${env.GIT_SHORT_SHA}
            Tag:    ${env.IMAGE_TAG}
            ============================================
            """
        }
        failure {
            echo """
            ============================================
            ❌ DEPLOYMENT FAILED
            Build:  #${env.BUILD_NUMBER}
            Check the stage logs above for details.
            ============================================
            """
        }
        always {
            // Clean up local Docker images to save disk space on t3.small
            sh '''
                docker rmi ${BACKEND_IMAGE_NAME}:${IMAGE_TAG}  || true
                docker rmi ${FRONTEND_IMAGE_NAME}:${IMAGE_TAG} || true
                docker rmi ${BACKEND_IMAGE_NAME}:latest        || true
                docker rmi ${FRONTEND_IMAGE_NAME}:latest       || true
            '''
            cleanWs()
        }
    }
}
