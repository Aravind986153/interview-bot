#!/bin/bash
# Interview-Bot Deployment Script (Render.com + Netlify)
# Run this after cleanup.sh

# =================================================================
# STEP 1: Initial Setup
# =================================================================
echo "🚀 STEP 1: Initializing deployment..."

# Verify we're in the right directory
if [ ! -f "backend/app/main.py" ] || [ ! -f "frontend/static/js/app.js" ]; then
  echo "❌ Error: Run this from your project root after cleanup.sh"
  exit 1
fi

# =================================================================
# STEP 2: Configuration
# =================================================================
echo "🔧 STEP 2: Configure these variables in the script:"
cat << EOF
# REQUIRED CONFIGURATION (edit these values)
FRONTEND_URL="https://your-bot-name.netlify.app"  # Will be created later
OPENAI_API_KEY="sk-your-key-here"                # From OpenAI dashboard
GITHUB_REPO="yourusername/repo-name"             # Format: username/repo
RENDER_SERVICE_NAME="interview-bot-backend"      # Name for Render service
RENDER_DB_NAME="interview-bot-db"                # Render PostgreSQL name
EOF

read -p "Have you updated these values? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "🛑 Please edit the script variables first!"
  exit 1
fi

# =================================================================
# STEP 3: Prepare Render Configuration
# =================================================================
echo "📝 STEP 3: Creating render.yaml..."

cat << EOF > render.yaml
services:
  - type: web
    name: $RENDER_SERVICE_NAME
    runtime: python
    buildCommand: |
      pip install -r requirements.txt
      python -c "from backend.app.database import create_db; create_db()"
    startCommand: uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
    envVars:
      - key: DATABASE_URL
        value: postgres://user:pass@host/db  # Auto-replaced by Render
      - key: OPENAI_API_KEY
        value: $OPENAI_API_KEY
      - key: ALLOWED_ORIGINS
        value: $FRONTEND_URL
      - key: FRONTEND_URL
        value: $FRONTEND_URL
EOF

echo "✅ Created render.yaml with your configuration"

# =================================================================
# STEP 4: Set Up Git Repository
# =================================================================
echo "🔄 STEP 4: Initializing Git repository..."

git init
git add .
git commit -m "Initial deployment-ready version"

# =================================================================
# STEP 5: Create GitHub Repository
# =================================================================
echo "🐙 STEP 5: Creating GitHub repository..."

if ! command -v gh &> /dev/null; then
  echo "ℹ️ GitHub CLI not found. Please install it or create repo manually:"
  echo "1. Go to https://github.com/new"
  echo "2. Create repository named '${GITHUB_REPO#*/}'"
  echo "3. Run these commands:"
  echo "   git remote add origin https://github.com/$GITHUB_REPO.git"
  echo "   git push -u origin main"
  read -p "Press Enter after you've created the repo..."
else
  gh repo create $GITHUB_REPO --public --push --source .
fi

# =================================================================
# STEP 6: Deploy Backend to Render.com
# =================================================================
echo "☁️ STEP 6: Deploying backend to Render.com..."

# Check for Render API key
if [ -z "$RENDER_API_KEY" ]; then
  echo "🔑 Get your Render API key from:"
  echo "https://dashboard.render.com/account/api-keys"
  read -s -p "Paste your Render API key: " RENDER_API_KEY
  export RENDER_API_KEY
  echo
fi

echo "🛢️ Creating PostgreSQL database..."
DB_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'$RENDER_DB_NAME'",
    "database_name": "interview_db",
    "user": "interview_user",
    "plan": "free"
  }' \
  https://api.render.com/v1/databases)

DB_URL=$(echo $DB_RESPONSE | jq -r '.connectionString')
if [ -z "$DB_URL" ]; then
  echo "❌ Database creation failed:"
  echo $DB_RESPONSE | jq
  exit 1
fi
echo "✅ Database created: ${DB_URL//:*@/://***@}"

# =================================================================
# STEP 7: Deploy Web Service
# =================================================================
echo "⚡ Deploying backend service..."
SERVICE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'$RENDER_SERVICE_NAME'",
    "type": "web_service",
    "repo": "https://github.com/'$GITHUB_REPO'",
    "autoDeploy": true,
    "envVars": [
      {"key": "DATABASE_URL", "value": "'$DB_URL'"},
      {"key": "OPENAI_API_KEY", "value": "'$OPENAI_API_KEY'"},
      {"key": "ALLOWED_ORIGINS", "value": "'$FRONTEND_URL'"},
      {"key": "FRONTEND_URL", "value": "'$FRONTEND_URL'"}
    ]
  }' \
  https://api.render.com/v1/services)

SERVICE_ID=$(echo $SERVICE_RESPONSE | jq -r '.id')
if [ -z "$SERVICE_ID" ]; then
  echo "❌ Service creation failed:"
  echo $SERVICE_RESPONSE | jq
  exit 1
fi

# =================================================================
# STEP 8: Wait for Deployment
# =================================================================
echo "⏳ Waiting for deployment to complete (this may take 5-10 minutes)..."
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    https://api.render.com/v1/services/$SERVICE_ID | jq -r '.service.deploy.status')
  
  case $STATUS in
    "live")
      SERVICE_URL=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
        https://api.render.com/v1/services/$SERVICE_ID | jq -r '.service.serviceDetails.url')
      echo "✅ Backend deployed successfully!"
      echo "🌐 Backend URL: $SERVICE_URL"
      break
      ;;
    "failed")
      echo "❌ Deployment failed! Check logs:"
      echo "https://dashboard.render.com/services/$SERVICE_ID"
      exit 1
      ;;
    *)
      echo "⏳ Status: $STATUS (checking again in 30 seconds...)"
      sleep 30
      ;;
  esac
done

# =================================================================
# STEP 9: Deploy Frontend to Netlify
# =================================================================
echo "🎨 STEP 9: Deploying frontend to Netlify..."

# Install Netlify CLI if needed
if ! command -v netlify &> /dev/null; then
  echo "Installing Netlify CLI..."
  npm install -g netlify-cli
fi

# Login if not already
if ! netlify whoami &> /dev/null; then
  echo "🔑 Logging in to Netlify..."
  netlify login
fi

# Update frontend URLs
echo "🔄 Updating frontend configuration..."
sed -i.bak "s|const API_URL = .*|const API_URL = \"$SERVICE_URL\";|" frontend/static/js/app.js
sed -i.bak "s|const WS_URL = .*|const WS_URL = \"wss://${SERVICE_URL#https://}/ws\";|" frontend/static/js/app.js

# Deploy
echo "🚀 Publishing frontend..."
cd frontend/static
NETLIFY_SITE_URL=$(netlify deploy --prod --json | jq -r '.deploy_url')
cd ../..

# =================================================================
# STEP 10: Final Configuration
# =================================================================
echo "⚙️ STEP 10: Updating CORS settings..."

curl -X PATCH \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "envVars": [
      {"key": "ALLOWED_ORIGINS", "value": "'$NETLIFY_SITE_URL'"},
      {"key": "FRONTEND_URL", "value": "'$NETLIFY_SITE_URL'"}
    ]
  }' \
  https://api.render.com/v1/services/$SERVICE_ID

# =================================================================
# STEP 11: Verification
# =================================================================
echo "🔍 STEP 11: Verifying deployment..."

echo "📡 Testing WebSocket connection..."
wscat -c wss://${SERVICE_URL#https://}/ws <<EOF
Test message
EOF

echo "🌐 Testing frontend: $NETLIFY_SITE_URL"

# =================================================================
# STEP 12: Completion
# =================================================================
echo "🎉 Deployment complete!"
echo "👉 Frontend URL: $NETLIFY_SITE_URL"
echo "👉 Backend URL: $SERVICE_URL"
echo "👉 WebSocket URL: wss://${SERVICE_URL#https://}/ws"
echo "👉 Render Dashboard: https://dashboard.render.com/services/$SERVICE_ID"
