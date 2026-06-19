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
