pipeline {
    agent any

    environment {
        // Define your Docker Image tagging details
        DOCKER_IMAGE = "home-price-predictor"
        DOCKER_TAG   = "${BUILD_NUMBER}"
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                // Pulls the latest code directly from your configured GitHub repo
                checkout scm
            }
        }

        stage('2. Docker Build & Tag') {
            steps {
                echo "Building Docker image: ${DOCKER_IMAGE}:${DOCKER_TAG}..."
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
            }
        }

        stage('3. Deploy to K3s Cluster') {
            steps {
                echo "Deploying application to local K3s cluster..."
                // Tells K3s to roll out the newly built local image directly
                sh "kubectl rollout restart deployment/home-price-deployment || kubectl apply -f k8s/"
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully! Automation deployed to K3s."
        }
        failure {
            echo "Pipeline failed. Check the logs above to see where the build broke."
        }
    }
}