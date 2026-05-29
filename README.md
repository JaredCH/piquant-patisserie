# The Piquant Patisserie - Client Mockup Website

A high-fidelity, interactive, and responsive web mockup for **The Piquant Patisserie**. This mockup showcases the artisan, French-inspired dessert truck’s full live menu, pricing, real descriptions, and actual GoDaddy CDN assets in a premium single-page application.

This repository is pre-configured with a lightweight Node.js/Express server designed specifically for instant, zero-configuration deployment to **Railway** or any other cloud provider (e.g., Heroku, Render).

---

## Key Mockup Features Included

1. **Lightweight Node/Express Backend**: Out-of-the-box static server that builds instantly in cloud hosting environments.
2. **100% Complete Scraped Menu**: Features all 26 signature creations (Cake Jars, Petit Brownie Pans, Macarons, Crème Brûlées, and Artisan Cookies) with their exact prices and copy.
3. **High-Definition CDN Imagery**: Injects the client's actual photography (food truck, catering tables, cake jars, macarons) directly from GoDaddy, saving repository space and keeping it performant.
4. **Interactive Filters**: Instant category filtering with fade-in grid layouts using vanilla JS.
5. **Interactive Shopping Cart Engine**:
   - Dynamic slide-out e-commerce cart drawer.
   - **Automated Bulk Discount Engine**: Automatically detects bulk quantities per category and applies discounts in real-time (e.g. groups of 4 cake jars priced at the bulk package rate of $40 instead of $48!).
6. **Live Food Truck Tracker**: Schedule dynamically marks the active location and time based on the local day of the week with pulsing GPS radar indicators.
7. **High-Fidelity Feedback Modals**: Fully validated catering quote and contact forms that output summaries into clean glassmorphism overlay dialogs on submit.

---

## How to Run Locally

To test or run the mockup server on your local machine, ensure you have **Node.js** installed, then run:

1. Open your terminal in this directory:
   ```bash
   cd piquant-patisserie
   ```
2. Install the lightweight Express dependency:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to:
   **`http://localhost:3000`**

---

## How to Host on Railway (Client Presentation)

This repository is optimized for **Railway** standard Node.js hosting. You can host this in under 2 minutes:

### Option A: Railway CLI (Fastest for local folders)
If you have the Railway CLI installed on your machine:
1. Log in to your Railway account:
   ```bash
   railway login
   ```
2. Initialize a new Railway project:
   ```bash
   railway init
   ```
3. Deploy the current folder directly:
   ```bash
   railway up
   ```
Railway will automatically detect `package.json`, install the Express dependency, run `node server.js`, and provide you with a live `xxx.up.railway.app` URL to send to your client!

### Option B: Deploy from GitHub (Continuous Integration)
1. Initialize git in this directory and commit your changes:
   ```bash
   git init
   git add .
   git commit -m "feat: initial patisserie client mockup"
   ```
2. Push this repository to your personal GitHub account.
3. Go to [Railway.app](https://railway.app) and create a new project.
4. Select **Deploy from GitHub repository** and select your patisserie repo.
5. Railway will deploy it automatically. Any future commits pushed to GitHub will instantly update the live client mockup URL!
