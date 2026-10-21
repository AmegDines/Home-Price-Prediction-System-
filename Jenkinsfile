pipeline {
    agent any

    environment {
        FRONTEND_IMAGE  = "home-price-frontend:latest"
        BACKEND_IMAGE   = "home-price-backend:latest"
        REGISTRY        = "${env.DOCKER_REGISTRY ?: '111169963700.dkr.ecr.ap-south-1.amazonaws.com'}"
        PYTHON          = "python3"
    }

    options {
        // Fail fast: any stage failure aborts the entire pipeline
        timeout(time: 60, unit: 'MINUTES')
    }

    stages {

        /* ── 1. Install dependencies ────────────────────────────────────────── */
        stage('Install Dependencies') {
            steps {
                echo '── Installing Python & Node dependencies ──'
                sh '''
                    ${PYTHON} -m pip install --quiet --upgrade pip
                    ${PYTHON} -m pip install --quiet \
                        pandas numpy scikit-learn xgboost \
                        fastapi uvicorn pydantic pytest httpx
                '''
                dir('frontend') {
                    sh 'npm ci --prefer-offline'
                }
            }
        }

        /* ── 2. Run model_training tests ─────────────────────────────────────── */
        stage('Test: Data Pipeline') {
            steps {
                echo '── Running model_training/tests/ ──'
                sh '''
                    ${PYTHON} -m pytest model_training/tests/ \
                        -v --tb=short --no-header \
                        --junitxml=reports/pipeline_tests.xml
                '''
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'reports/pipeline_tests.xml'
                }
            }
        }

        /* ── 3. Train model (only if pipeline tests pass) ────────────────────── */
        stage('Train Model') {
            steps {
                echo '── Training ML model ──'
                sh '${PYTHON} model_training/pipeline.py'
                // Verify artefacts were produced
                sh '''
                    test -f server/model/home_price_model.pkl  || (echo "Model pkl missing!" && exit 1)
                    test -f server/model/location_encoder.pkl  || (echo "Encoder pkl missing!" && exit 1)
                    test -f model_training/metrics.json        || (echo "metrics.json missing!" && exit 1)
                    echo "Model artefacts verified OK."
                    cat model_training/metrics.json
                '''
            }
        }

        /* ── 4. Run server tests ─────────────────────────────────────────────── */
        stage('Test: FastAPI Server') {
            steps {
                echo '── Running server/tests/ ──'
                sh '''
                    ${PYTHON} -m pytest server/tests/ \
                        -v --tb=short --no-header \
                        --junitxml=reports/server_tests.xml
                '''
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'reports/server_tests.xml'
                }
            }
        }

        /* ── 5. Build Docker images ───────────────────────────────────────────── */
        stage('Build Docker Images') {
            steps {
                echo '── Building Docker images ──'
                dir('frontend') {
                    sh "docker build -t ${FRONTEND_IMAGE} ."
                }
                dir('server') {
                    sh "docker build -t ${BACKEND_IMAGE} ."
                }
            }
        }

        /* ── 6. Push to registry ─────────────────────────────────────────────── */
        stage('Push to Registry') {
            steps {
                echo '── Pushing images to container registry ──'
                sh """
                    docker tag ${FRONTEND_IMAGE} ${REGISTRY}/${FRONTEND_IMAGE}
                    docker push ${REGISTRY}/${FRONTEND_IMAGE}
                    docker tag ${BACKEND_IMAGE} ${REGISTRY}/${BACKEND_IMAGE}
                    docker push ${REGISTRY}/${BACKEND_IMAGE}
                """
            }
        }

        /* ── 7. Deploy to Kubernetes ─────────────────────────────────────────── */
        stage('Deploy to Kubernetes') {
            steps {
                echo '── Applying Kubernetes manifests ──'
                sh 'kubectl apply -k k8s/'
                sh 'kubectl rollout status deployment/home-price-backend  --timeout=120s'
                sh 'kubectl rollout status deployment/home-price-frontend --timeout=120s'
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline complete — images pushed and cluster updated.'
            sh 'docker image prune -f'
        }
        failure {
            echo '❌ Pipeline failed — see stage logs above.'
        }
    }
}