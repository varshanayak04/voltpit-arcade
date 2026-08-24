<p align="center">
  <h1 align="center">⚡ VOLTPIT Arcade</h1>
</p>

<p align="center">
  A modern browser-based arcade platform featuring multiple interactive games, responsive UI, animations, sound effects, and Progressive Web App support.
</p>

<p align="center">
  <a href="https://voltpit-arcade.onrender.com"><img src="https://img.shields.io/badge/demo-live-brightgreen" alt="Live Demo"></a>
  <a href="https://github.com/varshanayak04/voltpit-arcade"><img src="https://img.shields.io/badge/github-repo-blue" alt="GitHub Repo"></a>
  <a href="#-license"><img src="https://img.shields.io/badge/license-MIT-yellow" alt="License"></a>
</p>

---

## 🎮 Live Demo

**⚡ Play VOLTPIT Arcade**

🔗 **Live Website:** [https://voltpit-arcade.onrender.com](https://voltpit-arcade.onrender.com)

The application is deployed as a static website and can be accessed directly from any modern web browser.

---

## 📌 Overview

VOLTPIT Arcade is a browser-based gaming platform designed to bring multiple lightweight arcade experiences together in a single polished interface.

The project focuses on creating an engaging arcade environment with:

- 🎮 Multiple playable games
- ⚡ Fast browser-based gameplay
- 🕹️ Arcade-inspired visual design
- ✨ Smooth animations and transitions
- 🔊 Interactive sound effects
- 📱 Responsive design
- 💾 Local game state and score persistence
- 📲 Progressive Web App support
- 🌐 No backend required for core gameplay

VOLTPIT Arcade is built using standard web technologies while maintaining a modular JavaScript architecture that makes individual games easy to maintain and extend.

---

## ✨ Features

### 🎮 Multiple Games

VOLTPIT Arcade currently includes several mini-games:

| Game | Description |
|---|---|
| 🐍 Snake | Classic snake gameplay with increasing difficulty |
| 🧱 Breaker | Break blocks using a controllable paddle and ball |
| 🧠 Recall | Test your memory and pattern recognition |
| ⚡ Reflex | Test reaction speed and response time |
| 🔢 Merge | Combine matching elements and build higher values |

Each game is implemented as an independent JavaScript module.

### 🏆 Arcade Experience

The platform provides an arcade-style experience rather than presenting games as isolated web pages.

Key elements include:

- Arcade cabinet-inspired interface
- Game selection system
- Interactive cards
- Attract-mode animations
- Game statistics
- Score tracking
- Dynamic UI updates
- Visual feedback
- Game-specific controls

### 🎨 Modern UI

The interface is designed around an arcade-inspired visual identity with:

- Responsive layouts
- Animated components
- Interactive buttons
- Game cards
- Smooth transitions
- Visual feedback
- Mobile-friendly layouts
- Desktop arcade experience

### 🔊 Audio System

VOLTPIT Arcade includes a dedicated audio module for handling interactive sound effects.

Audio feedback can be used for:

- Button interactions
- Game events
- Score updates
- Player actions
- Game completion
- Arcade interactions

### 💾 Local Storage

The application uses browser-side storage where appropriate to preserve user-related game data.

This allows the application to maintain information such as:

- High scores
- Game progress
- User preferences
- Arcade state

No account or backend database is required for the core experience.

### 📱 Progressive Web App

VOLTPIT Arcade includes Progressive Web App functionality.

The project includes:

- `manifest.webmanifest`
- Service worker
- Application icons
- Offline-oriented caching
- Installable web app support

This allows supported browsers to install VOLTPIT Arcade like an application.

---

## 🛠️ Tech Stack

**Frontend**
- HTML5
- CSS3
- JavaScript (ES6+)
- SVG
- Web APIs

**Browser Technologies**
- Canvas / DOM APIs
- Local Storage
- Service Workers
- Web App Manifest
- Browser Audio APIs

**Development**
- Git
- GitHub
- Python HTTP Server
- Render

---

## 🏗️ Project Architecture

The project follows a modular frontend architecture.

```
voltpit-arcade/
│
├── assets/
│   ├── art/
│   │   ├── cab-01.svg
│   │   ├── cab-02.svg
│   │   ├── ...
│   │   └── cab-21.svg
│   │
│   ├── css/
│   │   └── style.css
│   │
│   ├── icons/
│   │   ├── favicon.svg
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── maskable-512.png
│   │   └── apple-touch-icon.png
│   │
│   └── js/
│       ├── main.js
│       ├── arcade.js
│       ├── attract.js
│       ├── audio.js
│       ├── motion.js
│       ├── store.js
│       │
│       └── games/
│           ├── base.js
│           ├── snake.js
│           ├── breaker.js
│           ├── recall.js
│           ├── reflex.js
│           └── merge.js
│
├── tools/
│
├── index.html
├── manifest.webmanifest
├── robots.txt
├── sw.js
├── render.yaml
├── AGENTS.md
├── .gitignore
└── README.md
```

---

## 🧩 Application Modules

The application uses a modular JavaScript architecture where each core feature is separated into its own module.

### Core Modules

#### `main.js`
Responsible for core application initialization and global UI behavior.

#### `arcade.js`
Handles arcade navigation and game selection functionality.

#### `attract.js`
Controls the arcade attract-mode experience and automated visual interactions.

#### `audio.js`
Provides centralized audio functionality for interactive feedback and game sounds.

#### `motion.js`
Handles animation and motion-related UI behavior.

#### `store.js`
Manages client-side application state and persistent browser data.

### Game Engine

#### `games/base.js`
Provides shared functionality and common game behavior used by individual games.

### Individual Games

Each game has its own module:

- `snake.js`
- `breaker.js`
- `recall.js`
- `reflex.js`
- `merge.js`

This modular approach makes it easier to add additional games without modifying the entire application.

---

## 🚀 Getting Started

You can run VOLTPIT Arcade locally without installing a frontend framework or package manager.

### 1. Clone the repository

```bash
git clone https://github.com/varshanayak04/voltpit-arcade.git
```

### 2. Enter the project directory

```bash
cd voltpit-arcade
```

### 3. Start a local HTTP server

Using Python:

```bash
python3 -m http.server 8000
```

### 4. Open the application

Visit:

```
http://localhost:8000
```

You can also use any other static HTTP server.

---

## 🌐 Deployment

VOLTPIT Arcade is deployed using **Render Static Sites**.

### Deployment Configuration

Because the project is a static website, no build process is required.

Recommended Render configuration:

| Setting | Value |
|---|---|
| Service Type | Static Site |
| Branch | `main` |
| Root Directory | `.` |
| Build Command | *(leave empty)* |
| Publish Directory | `.` |

### Live Deployment

🔗 [https://voltpit-arcade.onrender.com](https://voltpit-arcade.onrender.com)

Every update pushed to the `main` branch can be configured to trigger a new deployment on Render.

---

## 🔄 Development Workflow

The project follows a simple Git-based workflow.

```bash
git clone https://github.com/varshanayak04/voltpit-arcade.git
cd voltpit-arcade

# Make changes

git add -A
git commit -m "Update VOLTPIT Arcade"
git push origin main
```

---

## 🧪 Testing

Since VOLTPIT Arcade is a client-side web application, testing can primarily be performed directly in a modern browser.

### Recommended Browsers

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari

### Basic Testing Checklist

- [ ] Application loads successfully
- [ ] Game selection works
- [ ] Each game starts correctly
- [ ] Keyboard controls work
- [ ] Touch interactions work where supported
- [ ] Scores update correctly
- [ ] Audio interactions work
- [ ] Animations render correctly
- [ ] Responsive layout works
- [ ] PWA installation works where supported
- [ ] Service worker registers successfully

---

## 📱 Responsive Design

VOLTPIT Arcade is designed to work across different screen sizes.

### Supported Layouts

- 🖥️ Desktop
- 💻 Laptop
- 📱 Mobile
- 📟 Tablet

The interface adapts to different viewport sizes while maintaining the arcade-style experience.

---

## 🔐 Privacy

VOLTPIT Arcade does not require users to create an account for the core gaming experience.

The application is primarily client-side and does not require a traditional backend database.

Any locally stored game-related information remains within the user's browser storage.

---

## ⚡ Performance

The application is intentionally lightweight and uses vanilla web technologies to minimize unnecessary dependencies.

Performance-focused characteristics include:

- No large frontend framework
- Minimal external dependencies
- Static asset delivery
- Modular JavaScript
- Browser-native APIs
- Client-side gameplay
- Static deployment architecture

---

## 🔮 Future Improvements

Possible future enhancements include:

- [ ] Online leaderboards
- [ ] User accounts
- [ ] Multiplayer games
- [ ] More arcade games
- [ ] Achievement system
- [ ] Global scoring
- [ ] Game difficulty selection
- [ ] Advanced statistics
- [ ] Tournament mode
- [ ] Controller support
- [ ] Improved mobile controls
- [ ] Additional soundtracks
- [ ] More arcade themes
- [ ] Cloud save support

---

## 🎯 Learning Objectives

This project demonstrates practical experience with:

- Frontend web development
- JavaScript application architecture
- Modular JavaScript
- DOM manipulation
- Browser APIs
- Game development fundamentals
- State management
- Local storage
- Service workers
- Progressive Web Apps
- Responsive UI development
- Git and GitHub
- Static website deployment
- Render deployment

---

## 💡 Why VOLTPIT Arcade?

The goal of VOLTPIT Arcade is not simply to create individual browser games.

The project explores how multiple interactive experiences can be combined into a single cohesive web application with:

> A unified interface + modular game architecture + responsive design + interactive feedback + PWA capabilities.

This makes the project both a playable arcade platform and a demonstration of modern client-side web development.

---

## 👨‍💻 Author

**K. Varsha Nayak**
Computer Science Engineering Student
India

GitHub: [@varshanayak04](https://github.com/varshanayak04)

---

## 🔗 Project Links

| Resource | Link |
|---|---|
| 🎮 Live Demo | [https://voltpit-arcade.onrender.com](https://voltpit-arcade.onrender.com) |
| 💻 GitHub Repository | [https://github.com/varshanayak04/voltpit-arcade](https://github.com/varshanayak04/voltpit-arcade) |

---

## 📄 License

This project is licensed under the **MIT License**.

You are free to use, modify, and distribute the project according to the terms of the license.

---

## ⭐ Support

If you like the project:

- ⭐ Star the repository on GitHub
- 🎮 Try the live arcade
- 🐛 Report issues
- 💡 Suggest new games
- 🔧 Contribute improvements

---

<p align="center">
  <b>⚡ VOLTPIT Arcade</b><br>
  <i>Play. Compete. Repeat.</i><br><br>
  Built with ❤️ using HTML, CSS and JavaScript.
</p>
