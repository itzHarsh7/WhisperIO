const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, clipboard, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Guard check if user mistakenly launched with 'node main.js' instead of Electron
if (!app || typeof app.getPath !== 'function') {
  console.error('\n❌ ERROR: WhisperIO is an Electron application and must be launched using Electron.');
  console.error('👉 Please start the application using: npm start\n');
  process.exit(1);
}

// Handle Squirrel installation, uninstallation, and desktop shortcut events for Windows
if (require('electron-squirrel-startup')) return;

// Configuration management
const configPath = path.join(app.getPath('userData'), 'config.json');
let config = {
  groqApiKey: '',
  model: 'whisper-large-v3',
  globalShortcut: 'Ctrl+Shift+Space',
  autoPaste: true,
  copyToClipboard: true,
  soundFeedback: true,
  pinned: false,
  theme: 'purple',
  casing: 'default',
  cleanStutters: true
};

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = { ...config, ...JSON.parse(data) };
    } else {
      saveConfig(config);
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

// Save configuration
function saveConfig(newConfig) {
  try {
    config = { ...config, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

let mainWindow = null;
let trayIcon = null;
let vbsPath = '';

// Register global shortcut
function registerShortcut() {
  globalShortcut.unregisterAll();
  try {
    const registered = globalShortcut.register(config.globalShortcut, () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) {
          showAndCenterWindow(false); // Show passively without stealing focus!
        }
        mainWindow.webContents.send('toggle-record-shortcut');
      }
    });
    if (!registered) {
      console.error(`Failed to register shortcut: ${config.globalShortcut}`);
    }
  } catch (err) {
    console.error('Error registering shortcut:', err);
  }
}

function showAndCenterWindow(shouldFocus = false) {
  if (!mainWindow) return;

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const winBounds = mainWindow.getBounds();

  // Center horizontally at the top of the screen (50px down)
  const x = Math.round((screenWidth - winBounds.width) / 2);
  const y = 50;

  mainWindow.setPosition(x, y);

  if (shouldFocus) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    mainWindow.showInactive();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 75,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Open DevTools only if running in unpackaged development mode
  if (!app.isPackaged) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('blur', () => {
    // If not pinned, not recording/processing, and DevTools is not open, hide the window
    if (!config.pinned && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.send('check-can-hide');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Set up System Tray
function createTray() {
  const iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
  const tempIconPath = path.join(app.getPath('userData'), 'tray-icon.png');

  // Copy the icon from ASAR to a physical temp file outside the ASAR archive
  // so that the Windows Shell (which runs outside Electron) can read and render it in the tray!
  try {
    if (fs.existsSync(iconPath)) {
      fs.writeFileSync(tempIconPath, fs.readFileSync(iconPath));
    }
  } catch (err) {
    console.error('Failed to extract tray icon:', err);
  }

  // Load the tray from the physical temp file, or fallback to an empty nativeImage
  let trayImageSource;
  if (fs.existsSync(tempIconPath)) {
    trayImageSource = nativeImage.createFromPath(tempIconPath);
  } else {
    trayImageSource = nativeImage.createEmpty();
  }

  trayIcon = new Tray(trayImageSource);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Overlay', click: () => showAndCenterWindow(true) },
    {
      label: 'Settings', click: () => {
        showAndCenterWindow(true);
        mainWindow.webContents.send('open-settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  trayIcon.setToolTip('AI Speech-to-Text Agent');
  trayIcon.setContextMenu(contextMenu);

  trayIcon.on('double-click', () => {
    showAndCenterWindow(true);
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      showAndCenterWindow(true);
    }
  });

  app.whenReady().then(() => {
    loadConfig();
    createWindow();
    createTray();
    registerShortcut();

    // Create temporary paste.vbs script for fast, lightweight keystroke injection
    vbsPath = path.join(app.getPath('userData'), 'paste.vbs');
    try {
      fs.writeFileSync(vbsPath, 'Set wshShell = CreateObject("WScript.Shell")\nwshShell.SendKeys "^v"\n', 'utf8');
    } catch (err) {
      console.error('Failed to create paste.vbs:', err);
    }

    // Show window on first launch so the user knows it's active!
    setTimeout(() => {
      showAndCenterWindow(true);
    }, 300);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Avoid quitting when window is closed, keep it in tray
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

// IPC communication handlers
ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('save-config', (event, newConfig) => {
  saveConfig(newConfig);
  registerShortcut(); // Re-register if shortcut changed
  return config;
});

ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const newX = Math.round((screenWidth - width) / 2);

    // Temporarily allow resizing to prevent OS restrictions
    mainWindow.setResizable(true);
    mainWindow.setBounds({
      x: newX,
      y: bounds.y,
      width: width,
      height: height
    });
    mainWindow.setResizable(false);
  }
});

ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on('show-window', () => {
  if (mainWindow) {
    showAndCenterWindow();
  }
});

ipcMain.on('toggle-pin', (event, isPinned) => {
  config.pinned = isPinned;
  saveConfig({ pinned: isPinned });
});

// SMART AUTO-PASTE TRIGGER
ipcMain.on('trigger-paste', (event, text) => {
  if (!text || text.trim() === '') return;

  const originalClipboardText = clipboard.readText();
  clipboard.writeText(text);

  if (config.autoPaste) {
    // 1. Hide the window to return focus back to the previously active application
    if (mainWindow && !config.pinned) {
      mainWindow.hide();
    }

    // 2. Wait 400ms to ensure the user has fully released the physical keys (Ctrl+Shift+Space)
    // and Google Chrome/Notepad focus state has fully settled.
    setTimeout(() => {
      // 3. Trigger native lightweight VBScript paste
      exec(`wscript.exe "${vbsPath}"`, (error) => {
        if (error) {
          console.error('VBScript auto-paste failed:', error);
        }

        // 4. Restore original clipboard content only if copyToClipboard is explicitly disabled
        if (config.copyToClipboard === false) {
          setTimeout(() => {
            clipboard.writeText(originalClipboardText);
          }, 500);
        }
      });
    }, 400);
  } else {
    // If autopaste is disabled, keep it on clipboard and hide if unpinned
    if (mainWindow && !config.pinned) {
      mainWindow.hide();
    }
  }
});

