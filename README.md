# Kingdom Impact Social (KIS) — README

## Overview

Kingdom Impact Social (KIS) is a modern, faith‑driven social platform designed to empower communities with real‑time communication, creative expression, and safe interactions. The app supports messaging, multimedia sharing, stickers, themed UI, and cross‑platform extensibility.

This README provides:

* Project summary
* Architecture overview
* Tech stack
* Folder structure
* Setup & installation
* Development scripts
* Key features
* Future roadmap

---

## ✨ Key Features

* **Real‑time Chat System** powered by NestJS + Fastify (backend) and React Native (mobile client).
* **Socket.IO WebSocket Gateway** under `/ws` for real‑time messaging.
* **Advanced Chat Composer**

  * Emoji picker
  * Avatar color picker
  * Custom text-background messages
  * Full sticker system
  * Local sticker editor with image upload, draggable text, compression, and optional background removal.
* **Stickers Library** saved locally via AsyncStorage using `KIS_STICKER_LIBRARY_V1`.
* **Swipe to Reply**, message selection mode, forwarding, reply preview, action menus.
* **Static File Uploads** served from `/uploads` on backend.
* **React Native Theme System** using `useTheme.ts` and `constants.ts` defining `KIS_COLORS`.
* **Modular Frontend Architecture** ready for React and React Native expansions.

---

## 🏛 Architecture

### Backend (NestJS + Fastify)

* REST API for authentication and user operations.
* WebSockets using Socket.IO under `/ws`.
* Static file hosting for uploads.
* Modular architecture suitable for microservice separation.

### Frontend

* **React Native mobile app** using:

  * Expo or bare RN workflow
  * Advanced chat components
  * AsyncStorage for local persistence
  * ViewShot + ImageResizer for sticker generation
* **Future web client** planned using React.js.

---

## 📁 Project Structure

```
kis/
├── backend/               # NestJS backend
│   ├── src/
│   └── uploads/           # Static user uploads
│
├── mobile/                # React Native app
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── theme/
│   │   │   ├── useTheme.ts
│   │   │   └── constants.ts
│   │   ├── chat/
│   │   │   ├── composer/
│   │   │   ├── stickers/
│   │   │   ├── emoji/
│   │   │   └── actions/
│   └── assets/
└── README.md
```

---

## 🛠 Tech Stack

### Backend

* **NestJS + Fastify** (REST + WebSockets)
* **Socket.IO**
* **TypeScript**
* **Multer** (file uploads)

### Mobile App

* **React Native**
* **AsyncStorage**
* **ViewShot** (sticker rendering)
* **ImageResizer**
* **React Navigation**
* **React Native Reanimated**

---

## 🚀 Getting Started

### Requirements

* Node.js 18+
* pnpm
* Java JDK 17 (for Android)
* Android Studio / Xcode (depending on platform)

---

## 📦 Installation

### Clone the project:

```bash
git clone https://github.com/your-org/kis.git
cd kis
```

### Install dependencies

#### Backend

```bash
cd backend
pnpm install
```

#### Mobile

```bash
cd mobile
pnpm install
```

---

## ▶️ Running the App

### Backend

```bash
cd backend
pnpm start:dev
```

This starts:

* Fastify REST server on `http://localhost:3000`
* WebSocket gateway at `ws://localhost:3000/ws`

### Mobile App

```bash
cd mobile
pnpm run android   # or ios
```

Ensure emulator/device is running.

---

## 🎨 Theme System

The theme is defined in:

```
mobile/src/theme/useTheme.ts
mobile/src/theme/constants.ts
```

* `KIS_COLORS`
* Typography tokens
* Shadows, border radii, spacing system

Used throughout screens and components.

---

## 🧩 Stickers System

* Created using **StickerEditor** component.
* Saved as compressed PNG + `.kisstk` metadata file.
* Indexed in AsyncStorage under:

```
KIS_STICKER_LIBRARY_V1
```

* Loaded in MessageComposer under the **Stickers Tab**.

---

## 🛣 Roadmap

* Voice messages (record + playback)
* Video calls
* Channels & Groups
* Improved search
* Cloud sync for stickers
* User profile customization
* Bible integration & verse sharing

---

## 🤝 Contribution

1. Fork the repo
2. Create a feature branch
3. Submit a PR with clear descriptions

---

## 📄 License

MIT License

---

## 📬 Contact

For questions or support, reach out to the KIS development team.
