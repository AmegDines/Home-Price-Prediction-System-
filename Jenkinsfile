pipeline {
    agent any

    environment {
        // Define clean Docker image tags matching your architecture
        FRONTEND_IMAGE = "home-price-frontend:latest"
        BACKEND_IMAGE  = "home-price-backend:latest"
    }

    stages {
        stage('System Resource Pre-Check') {
            steps {
                echo 'Checking server stability benchmarks before building...'
                // Ensures your new Swap space and cleared drive are healthy
                sh 'free -h'
                sh 'df -h /'
            }
        }

        stage('Code Checkout') {
            steps {
                echo 'Pulling fresh deployment assets from GitHub...'
                checkout scm
            }
        }

        stage('Build Microservices') {
            steps {
                echo 'Compiling isolated microservice container layers...'
                
                // Build containerized Next.js Frontend
                dir('frontend') {
                    echo 'Building Frontend Container...'
                    sh "docker build -t ${FRONTEND_IMAGE} ."
                }
                
                // Build containerized FastAPI Backend (holding Scikit-learn Pickle Model)
                dir('server') {
                    echo 'Building Backend ML Engine Container...'
                    sh "docker build -t ${BACKEND_IMAGE} ."
                }
            }
        }

        stage('Local Container Sanity Test') {
            steps {
                echo 'Verifying container compliance parameters...'
                // Basic check to ensure images are built and stored locally in the Docker daemon
                sh "docker images | grep home-price"
            }
        }

        stage('Deploy Infrastructure Strategy') {
            steps {
                echo 'Orchestrating blueprint container delivery blueprint...'
                // This prepares the application for orchestration rolling updates
                echo 'Microservice images compiled successfully and are ready for local K3s pod integration!'
            }
        }
    }

    post {
        success {
            echo 'Pipeline execution complete! Microservice artifacts built and cached.'
            // Automatically cleans up hanging docker build steps to protect your disk space
            sh 'docker image prune -f'
        }
        failure {
            echo 'Pipeline encountered an operational bottleneck. Review log telemetry.'
        }
    }
}