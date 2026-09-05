# WhisperIO

> A desktop AI dictation utility for Windows powered by Groq and OpenAI Whisper. Press a global hotkey, speak, and your voice automatically transcribes and types itself into any active application.

---

## Download & Install

### Option 1: Windows Setup Installer (Recommended)
1. Go to the [**WhisperIO Releases Page**](https://github.com/itzHarsh7/WhisperIO/releases).
2. Download **`WhisperIOSetup.exe`**.
3. Double-click the installer. It will automatically install WhisperIO cleanly on your system and create a shortcut on your **Windows Desktop** and inside your **Start Menu**.

### Option 2: Standalone Portable Build
1. Download `WhisperIO-win32-x64` from the releases page or build it locally.
2. Open the `dist/WhisperIO-win32-x64` directory.
3. Double-click **`WhisperIO.exe`** to start dictating instantly.

---

## The Problem & The Solution

On macOS, users have access to minimalist, fast dictation tools like *Superwhisper* or *MacWhisper*. On Windows, traditional voice dictation options have often been clunky, slow, or invasive.

**WhisperIO** solves this problem cleanly. It sits as a sleek, floating widget at the top center of your Windows desktop. It stays unobtrusively out of your way until you trigger your global shortcut key. When activated, it records your audio, sends it to Groq's ultra-fast Whisper API (`whisper-large-v3`), copies the transcription, and **automatically types it at your active cursor location**—all while safely preserving your existing clipboard history and active window focus.

---

## Features

- **Dynamic Overlay Interface**: Glassmorphic floating top-center widget that contracts into a minimal indicator to save screen real estate and expands smoothly on hover or hotkey activation.
- **Global Hotkey Integration**: Register system-level hotkeys (`Ctrl+Shift+Space` by default) to start and stop dictation across any Windows application without needing window focus.
- **Sub-Second Groq Speech-to-Text**: Directly interfaces with Groq Cloud's ultra-low latency Llama-powered `whisper-large-v3` API model for near-instantaneous transcription.
- **Non-Focus-Stealing Keystroke Injection**: Utilizes lightweight VBScript keystroke injection (`paste.vbs`) alongside native `showInactive` window management, inserting text directly into the active editor while keeping input focus intact.
- **Clipboard Preservation Engine**: Temporarily backs up pre-existing clipboard contents, writes the transcribed text for pasting, and restores the original clipboard buffer in less than 300ms.
- **Always-on-Top Pin Mode**: Includes a pin toggle mechanism to keep the dictation interface expanded and locked above other windows during extended dictation sessions.
- **Customizable Configuration Drawer**: Built-in settings panel to manage Groq API credentials, select Whisper model variants, set custom global hotkeys, choose color themes, and configure text formatting options.
- **System Tray Management**: Runs quietly in the Windows system tray for background execution, quick setting access, and process control.

---

## Getting Started & Local Development

### Prerequisites

- **Windows 10 or Windows 11 (x64)**
- **Node.js**: v18.0.0 or higher recommended
- **NPM**: Included with Node.js
- **Groq API Key**: Get a free API key at [console.groq.com](https://console.groq.com/)

### Installation from Source

1. **Clone the repository:**
   ```bash
   git clone https://github.com/itzHarsh7/WhisperIO.git
   cd WhisperIO
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Set Up your Groq API Key**:
   - The bar will appear floating at the top center of your screen.
   - Click the **Gear (Settings) Icon** to open configuration.
   - Paste your Groq API Key (`gsk_...`).
   - Click **Save Changes**.

---

## Build Scripts

### Build Executable Directory
Package the application into a standalone Windows executable directory:
```bash
npm run build:exe
```
Output location: `dist/WhisperIO-win32-x64/WhisperIO.exe`

### Build Windows Installer
Compile a single-file Windows setup installer:
```bash
npm run build:installer
```
Output location: `dist/installers/WhisperIOSetup.exe`

---

## Usage Guide

- **Start and Stop Dictation**: Press `Ctrl+Shift+Space` anywhere on Windows (or click the microphone icon in the floating widget). Speak into your microphone, then press the shortcut again to finish.
- **Automated Text Insertion**: Place your text cursor in any input field or editor (VS Code, Notepad, Chrome, Slack, Discord). Trigger dictation; when complete, the transcribed text will automatically type itself at your active cursor.
- **Pin Overlay**: Click the **Pin Icon** to keep the control bar visible and locked on top of active applications.
- **Configuration Panel**: Click the **Gear Icon** to manage API keys, select Whisper models (`whisper-large-v3`), record new global shortcuts, select color themes, or toggle auto-paste behavior.
- **System Tray Docking**: Click the **Quit** option in the system tray context menu to exit, or double-click the tray icon to toggle visibility of the dictation bar.

---

## Technology Stack

- **Core Framework**: Electron (v30+)
- **Frontend Architecture**: HTML5, Vanilla CSS3, & Modern ES6+ JavaScript (Zero framework overhead)
- **Audio Capture & Analysis**: Browser Web Audio API & MediaRecorder API
- **AI Engine Integration**: Groq Cloud High-Speed Whisper REST API (`whisper-large-v3`)
- **Native OS Keystroke Injection**: Node.js `child_process` + Windows `wscript.exe` VBScript SendKeys