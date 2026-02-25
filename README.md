# 🎨 UI Designer

An interactive, gamified platform for learning and mastering CSS, HTML, and modern UI design patterns. Build beautiful interfaces through hands-on challenges, real-time feedback, and AI-powered assistance.

![UI Designer Preview](https://img.shields.io/badge/Next.js-16.0.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC)

## ✨ Features

### 🎯 Interactive Learning Experience
- **Progressive Levels**: Start with basic layouts and advance to complex responsive designs
- **Gamified Learning**: Earn points, track progress, and unlock new challenges
- **Real-time Feedback**: Instant visual comparison between your designs and target layouts
- **Multiple Difficulty Levels**: From beginner-friendly to expert challenges

### 🛠️ Powerful Design Tools
- **Live Code Editors**: CodeMirror-powered editors with syntax highlighting and themes
- **Visual Artboards**: Interactive drawing and design canvases
- **CSS Generators**: AI-powered code generation for layouts, forms, and components
- **Component Library**: Pre-built UI components for rapid prototyping

### 🤖 AI-Powered Assistance
- **Smart Code Generation**: Get help with CSS layouts, flexbox, grid, and more
- **Contextual Hints**: Receive intelligent suggestions based on your current challenge
- **Code Optimization**: Improve your CSS with AI recommendations

### 🎮 Game Mechanics
- **Point System**: Earn points for completing challenges and accuracy
- **Progress Tracking**: Monitor your improvement across different skill areas
- **Achievement System**: Unlock badges and special challenges
- **Leaderboards**: Compare your progress with other designers

## 🚀 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4.0, Radix UI components
- **State Management**: Redux Toolkit
- **Database**: SQLite with Sequelize ORM
- **Code Editing**: CodeMirror with multiple themes
- **Visualization**: D3.js for charts and word clouds
- **AI Integration**: OpenAI API
- **Real-time Collaboration**: Hocuspocus

## 🏃 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- pnpm, npm, or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jalez/ui-designer.git
   cd ui-designer
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   # or
   yarn install
   ```

3. **Set up the database**
   ```bash
   # The SQLite database is included in the repo
   # Migrations will run automatically on first startup
   ```

4. **Start the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🐳 Running with Docker

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A `.env.local` file in the project root (copy from `.env.local.example` and fill in your values)

```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### Start the app

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

The first run takes a few minutes as it installs dependencies and builds the Next.js app inside the container.

### Common commands

```bash
# Start without rebuilding (if images already exist)
docker compose up

# Run in the background
docker compose up --build -d

# Stop everything
docker compose down

# Stop and wipe the database volume
docker compose down -v
```

### Services

| Service   | Port | Description                     |
|-----------|------|---------------------------------|
| app       | 3000 | Next.js application             |
| ws-server | 3100 | WebSocket collaboration server  |
| db        | 5433 | PostgreSQL database             |

> **Note:** The container loads variables from `.env.local` automatically. The database connection is overridden internally to point to the Docker `db` service — you do not need to change `DATABASE_URL` in `.env.local` for Docker.

## 📁 Project Structure

```
ui-designer/
├── app/                    # Next.js app directory
│   ├── api/               # Backend API routes
│   ├── drawboard/         # Main drawing interface
│   └── help/              # Help and documentation
├── components/            # React components
│   ├── ArtBoards/         # Design canvas components
│   ├── Editors/           # Code editors
│   ├── InfoBoard/         # Progress and info panels
│   └── ui/                # Reusable UI components
├── lib/                   # Utility functions
│   ├── generators/        # CSS/HTML generators
│   ├── utils/            # Helper functions
│   └── models/           # Database models
├── store/                # Redux store configuration
├── types.ts              # TypeScript definitions
└── db/                   # SQLite database
```

## 🎯 How It Works

1. **Choose a Challenge**: Select from various design challenges (forms, layouts, navigation, etc.)
2. **Code Your Solution**: Write HTML and CSS in the live editors
3. **See Real-time Results**: Watch your design appear instantly in the artboard
4. **Get Feedback**: Compare your work with the target design
5. **Earn Points**: Improve accuracy and unlock new challenges

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing component patterns
- Add tests for new features
- Update documentation as needed
- Keep commits focused and descriptive

## 📝 Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Database
pnpm db:migrate   # Run database migrations
pnpm db:seed      # Seed database with sample data
```

## 🎨 Challenge Types

- **Layout Challenges**: Flexbox, CSS Grid, positioning
- **Form Design**: Input styling, validation, accessibility
- **Navigation**: Menus, breadcrumbs, responsive navbars
- **Component Design**: Buttons, cards, modals, tabs
- **Responsive Design**: Mobile-first, breakpoints, media queries
- **Animation**: CSS transitions, transforms, keyframes

## 📊 Progress Tracking

Track your learning journey with:
- Skill level progression
- Challenge completion rates
- Code accuracy metrics
- Time spent on challenges
- Personal best scores

## 🔧 Configuration

The app can be configured through `config/config.json`:
- Challenge difficulty settings
- AI model parameters
- UI theme preferences
- Database connection settings

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## ☕ Support the Project

If you find UI Designer helpful for your learning journey, consider supporting the project:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%23FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/jalez)

Your support helps maintain and improve the platform!

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Code editing powered by [CodeMirror](https://codemirror.net/)
- Icons from [Lucide React](https://lucide.dev/)

---

**Happy designing! 🎨** Turn your CSS skills into masterpieces with UI Designer.
