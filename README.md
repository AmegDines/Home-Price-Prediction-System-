# Bengaluru Nest AI: Home Price Predictor & Seller Marketplace

A premium, high-fidelity real estate web application designed specifically for Bengaluru. The platform features an AI-powered home price valuation engine, a seller portal to list properties with real-time AI valuation guidance, and an interactive properties search board.

Built using a **Next.js (React) + FastAPI (Python)** dual-architecture stack, it is optimized to run fully serverless with client-side predictions (for **$0/month hosting**) or connect to a live Python FastAPI prediction server.

---

## 🚀 Key Features
1. **AI Price Predictor**: Estimates the price of a property in Bengaluru in Lakhs/Crores based on Location, Area (sqft), BHK size, and Bathroom count, trained on 7,400+ verified transaction records.
2. **Seller Hub ("List Your Home")**: Homeowners can list their properties. As they type, the system provides **real-time AI market valuations** and compares it to their custom asking price to label listings ("Below AI Value", "Fair Market Value", etc.).
3. **Interactive Listings Board**: Displays listed homes in real-time with comprehensive filters for location, BHK size, and budget ranges, persisted via local storage or backend service.
4. **Professional Light Theme Design System**: Built with modern, glassmorphic UI cards, responsive grids, sleek range sliders, and custom location selectors.

---

## 🛠️ Tech Stack & Language Selection
* **Data Science & ML (Python)**: `pandas`, `numpy`, `scikit-learn` used for loading the Kaggle dataset, cleaning nulls/ranges, filtering outliers (bathroom discrepancies, BHK pricing anomalies, sqft per room sizes), and fitting a highly optimized `LinearRegression` model.
* **Backend API (Python - FastAPI)**: High-performance endpoint services, enabling CORS and automatic OpenAPI documentation.
* **Frontend Web App (TypeScript / Next.js)**: Optimized using App Router, modern CSS Modules, searchable location select triggers, and fully interactive layouts.
* **Mathematical JS Predictor Engine**: An embedded browser-based engine executing the trained coefficients. Serves as a static-site prediction fallback, allowing zero-cost deployments!

---

## 📁 Workspace Directory Structure
```text
├── model_training/
│   ├── train.py                     # Downloads, cleans Kaggle data, trains model, exports assets
│   ├── Bengaluru_House_Data.csv      # (Generated) Raw data CSV
│   ├── bengaluru_house_prices_model.pkl # (Generated) Python model pickle file
│   └── columns.json                 # (Generated) Model features mapping
├── server/
│   ├── main.py                      # FastAPI application
│   ├── listings.json                # (Generated) Property listings database
│   └── requirements.txt             # Python API dependencies
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── app/                     # Page views & CSS global styles
│   │   ├── components/              # Searchable dropdown & listing cards
│   │   ├── data/                    # Model coefficients & location names
│   │   └── utils/                   # Predictor engine & listing local-storage manager
└── README.md                        # Documentation & deployment guide
```

---

## 🏃‍♂️ Quick Start Guide

### 1. Train the ML Model
First, run the Python script to train the Linear Regression model. This will automatically download the dataset, perform cleaning, and export the model files to both the Python backend and Next.js frontend:
```bash
# Install data science dependencies
pip install pandas numpy scikit-learn

# Run training
python model_training/train.py
```

### 2. Launch the Next.js Frontend
Start the Next.js development server to launch the marketplace dashboard locally:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser!

### 3. Launch the FastAPI Backend (Optional)
If you want to run the live Python backend server instead of client-side predictions:
```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
```
The interactive API documentation is available at **`http://127.0.0.1:8000/docs`**.

---

## ☁️ Step-by-Step Deployment Guide

### A. Frontend Deployment (100% Free Static Hosting)
Because this application is equipped with an embedded mathematical JS prediction engine, you can deploy the frontend completely statically for **$0/month**!

#### Deploying on Vercel:
1. Push your code to a GitHub repository.
2. Sign up on [Vercel](https://vercel.com) and link your GitHub account.
3. Click **"New Project"**, select your repository, and choose `frontend` as the **Root Directory**.
4. Leave all settings as default (Framework Preset: Next.js).
5. Click **"Deploy"**. Your site is live in 60 seconds with SSL and global CDN!

#### Deploying on Netlify:
1. Sign up on [Netlify](https://netlify.com) and click **"Import from Git"**.
2. Select your repository, set the **Base directory** to `frontend`, **Build command** to `npm run build`, and **Publish directory** to `frontend/.next` or `out`.
3. Click **"Deploy site"**.

---

### B. Backend API Server Deployment (Python FastAPI)
If you wish to host the live Python FastAPI server to store listings in a backend database or run advanced predictions:

#### Deploying on Render (Free Tier):
1. Sign up on [Render](https://render.com).
2. Click **"New Web Service"** and connect your GitHub repository.
3. Set the **Root Directory** to `server`.
4. Set the **Runtime** to `Python`.
5. Set the **Build Command** to `pip install -r requirements.txt`.
6. Set the **Start Command** to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
7. Click **"Deploy"**. Render will deploy your Python FastAPI service and give you a public URL (e.g. `https://my-bengaluru-api.onrender.com`).

#### Connect Frontend to Backend:
In `frontend/src/app/page.tsx` or env variables, update the API URL endpoints to point to your live Render backend URL, and listings will automatically synchronize across all users globally!
