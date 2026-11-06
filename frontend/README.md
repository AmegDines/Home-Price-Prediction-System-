# Frontend

This is the Next.js and React user interface for the Bengaluru Home Price Prediction System.

## Local development

From this folder, install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The UI calls the FastAPI service at `http://localhost:8000` by default. Start that service from the repository root as described in the root README.

## Code layout

- `src/app/`: application routes, layout, and page styles.
- `src/components/`: listing cards and shared form controls.
- `src/data/`: frontend location metadata.
- `src/utils/`: API clients for predictions and listings.
