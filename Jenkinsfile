// -----------------------------------------------------------------------------
// Jenkins Declarative Pipeline for the Student Task Manager
// -----------------------------------------------------------------------------
// This file lets Jenkins pick up the full build pipeline directly from Git.
// For the CIE Freestyle project we use the Build Steps UI instead (see
// DEMO_GUIDE.md step 2). This file is OPTIONAL — only use it if you also
// want to show a "Pipeline" style Jenkins job.
// -----------------------------------------------------------------------------

pipeline {
    agent any

    environment {
        IMAGE_NAME = 'task-manager'
        IMAGE_TAG  = '2.0'
        PATH       = "/usr/local/bin:${env.PATH}"   // Mac: npm, docker in /usr/local/bin
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Pulling latest code from GitHub...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Running npm install...'
                sh 'npm install'
            }
        }

        stage('Build') {
            steps {
                echo 'Validating application build...'
                sh 'npm run build'
            }
        }

        stage('Dockerize') {
            steps {
                echo 'Building Docker image...'
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ."
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully. Ready for Kubernetes deployment.'
        }
        failure {
            echo 'Pipeline FAILED. Check console output for the failing stage.'
        }
    }
}
