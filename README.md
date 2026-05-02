# 🎓 Mira Attendance

> **v4.1.3** — AI-powered attendance management web app built with React, TypeScript, and Vite, deployed on Vercel.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://mira-attendance-4-1-3.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-98%25-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite)](https://vitejs.dev/)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini-4285F4?logo=google)](https://ai.google.dev/)

---

## ✨ Features

- **AI-Powered Insights** — Integrates Google Gemini API to provide smart attendance analysis and summaries
- **Attendance Tracking** — Mark, view, and manage attendance records for students or team members
- **PWA Support** — Installable as a Progressive Web App on desktop and mobile
- **Responsive UI** — Clean, mobile-friendly interface built with React and TypeScript
- **Fast Build** — Powered by Vite for lightning-fast dev and production builds
- **Vercel Deployment** — Seamlessly deployed and hosted on Vercel

---

## 🚀 Live Demo

👉 [mira-attendance-4-1-3.vercel.app](https://mira-attendance-4-1-3.vercel.app)

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React + TypeScript | Frontend UI |
| Vite | Build tool & dev server |
| Google Gemini API | AI-powered features |
| Vercel | Hosting & deployment |

---

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API key](https://ai.google.dev/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bhanu99517/mira-attendance-4.1.3.git
   cd mira-attendance-4.1.3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root of the project:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

   > ⚠️ **Important:** Never commit your API key to version control. The `.env.local` file is already listed in `.gitignore`.

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

---

## 🏗️ Project Structure

```
mira-attendance-4.1.3/
├── components/          # Reusable UI components
├── src/                 # Core source files
├── scripts/             # Utility scripts
├── migrated_prompt_history/  # AI prompt history (migration records)
├── App.tsx              # Root application component
├── components.tsx       # Additional component definitions
├── constants.tsx        # App-wide constants
├── geminiClient.ts      # Gemini API client setup
├── services.ts          # Business logic & API services
├── types.ts             # TypeScript type definitions
├── index.tsx            # App entry point
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

---

## ☁️ Deploying to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add the following environment variable in Vercel's project settings:
   - **Key:** `VITE_GEMINI_API_KEY`
   - **Value:** your Gemini API key
4. Deploy — Vercel will automatically build and host your app

> ⚠️ The `VITE_GEMINI_API_KEY` **must** be set in Vercel's Environment Variables dashboard for AI features to work at runtime. Setting it only in `.env.local` is not sufficient for production.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key for AI features |

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source. See the repository for details.

---

## 👤 Author

**Bhanu** — [@Bhanu99517](https://github.com/Bhanu99517)

---

*Built with ❤️ using React, TypeScript, and Vite*

