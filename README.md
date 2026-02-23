# RMod

RMod is a desktop AI coding workspace built with Electron + React for **Roblox development**. It connects to OpenRouter models, lets you chat with an agent about your project, and can read/write files directly in a selected project folder.

Feel free to donate to the owner here: ko-fi.com/enovinx

## Features

- 🤖 **AI coding assistant** tuned for Roblox/Luau workflows.
- 📁 **Project-based workspace** with chat history and per-project context.
- 🛠️ **Built-in file tools** (read, write, create folders, delete, search, list).
- 🧠 **Model presets** with switchable providers and token/temperature settings.
- ✅ **Checkpoint snapshots** to capture and restore project file states.
- 🎨 **Theme support** and first-run onboarding/setup flow.
- ⚡ **Super Agent mode** with plan + task checklist workflow.

## Tech Stack

- **Desktop runtime:** Electron
- **Frontend:** React + TypeScript + Vite (via electron-vite)
- **Storage:** electron-store
- **Packaging:** electron-builder + electron-forge

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm
- An [OpenRouter API key](https://openrouter.ai/keys)

## Getting Started

```bash
npm install
npm run dev
```

On first launch, RMod asks for an OpenRouter key (`sk-...`) and validates it before continuing.

## Available Scripts

- `npm run dev` – start Electron in development mode.
- `npm run build` – build the main/preload/renderer bundles.
- `npm run start` – run with Electron Forge.
- `npm run package` – package app with Electron Forge.
- `npm run make` – generate distributables with Electron Forge makers.
- `npm run build:unpack` – build and output unpacked app via electron-builder.
- `npm run build:win` / `npm run build:mac` / `npm run build:linux` – platform builds via electron-builder.

## Project Structure

```text
src/
  main/        # Electron main process + IPC handlers
  preload/     # Secure API bridge (contextIsolation)
  renderer/    # React UI (pages, components, agent logic)
resources/     # App icons/assets for packaging
build/         # Packaging icons/assets
```

## Notes

- Project/chat/settings/checkpoint data is persisted with `electron-store` in your OS user data directory.
- Checkpoints intentionally ignore heavy/common folders like `.git`, `node_modules`, `dist`, and `build`.
- External links are opened in your default browser.

## License

See [LICENSE](./LICENSE).
