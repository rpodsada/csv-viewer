import { app, dialog, Menu, BrowserWindow, ipcMain, IpcMainEvent, globalShortcut, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';
import windowStateManager from './lib/windowStateManager';

// Prevent errors on Windows X-Server (WSL)
app.disableHardwareAcceleration();

// Reload app on changes in dev (relative to build/ directory)
if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
        electron: require(path.join(__dirname, '..', 'node_modules', 'electron')),
        hardResetMethod: 'exit'
    });
}

// State
let mainWindow: BrowserWindow | null = null;
let fileDialogOpen: boolean = false;

/**
 * Create the main application window.
 */
function createWindow(): void {
    // If the window already exists, do nothing.
    if (mainWindow !== null) {
        return;
    }

    // Create our window
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        minWidth: 850,
        minHeight: 250,
        backgroundColor: '#1e1e1e',
        darkTheme: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    // Saves window state (size & position)
    windowStateManager(mainWindow);

    // Load the our app into the window
    mainWindow.loadURL(`file://${__dirname}/app/index.html`);

    // Register global shortcuts
    registerGlobalShortcuts();

    // Clear the window object when the window is closed.
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Launch our app
app.whenReady().then(() => {
    createWindow();
    createMenu();
});

// Activate from dock in MacOS
app.on('activate', () => {
    createWindow();
});

// Quit when all windows are closed
// (Including MacOS, less clicks = better)
app.on('window-all-closed', () => {
    app.quit();
});

// Handle file open requests from app
ipcMain.on('open-csv', async () => {
    await showFileOpenDialog();
});

// Handle file dropped on window
ipcMain.on('file-dropped', async (event: IpcMainEvent, filePath: string) => {
    await loadFile(filePath);
});

/**
 * Register global application shortcuts.
 */
const registerGlobalShortcuts = (): void => {
    // Ctrl+R (refresh).
    globalShortcut.register('CommandOrControl+R', () => {
        mainWindow?.reload();
    });

    // Ctrl+Shift+I (toggle developer tools).
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        mainWindow?.webContents.toggleDevTools();
    });
}

/**
 * Create the application menu.
 */
const createMenu = (): void => {
    const template: MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: showFileOpenDialog,
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "copy" },
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'togglefullscreen' },
                { role: 'minimize' },
            ]
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * Show the file open dialog
 */
const showFileOpenDialog = async () => {
    // Prevent multiple dialogs
    if (fileDialogOpen) {
        return;
    }
    fileDialogOpen = true;
    
    // Open the dialog
    const { filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    fileDialogOpen = false;
    
    // Ensure a file was selected
    if (!filePaths || filePaths.length === 0 || !filePaths[0]) {
        console.log("No file chosen in dialog. Doing nothing.");
        return null;
    }

    // Ensure it's a CSV
    if (path.extname(filePaths[0]) !== '.csv') {
        // Send a message to the renderer to show an error.
        mainWindow?.webContents.send('file-error', 'File chosen is not a CSV.');
        return null;
    }

    loadFile(filePaths[0]);
};

/**
 * Load the provided file.
 * 
 * @param filePath The path to the file to load.
 */
const loadFile = async (filePath: string): Promise<any> => {
    try {
        const file = fs.readFileSync(filePath, 'utf8');
        const data = Papa.parse(file, { header: true });
        setWindowTitle(filePath);
        watchFile(filePath);
        mainWindow?.webContents.send('file-data', data.data);
    } catch (error) {
        mainWindow?.webContents.send('file-error', 'Error reading the file.');
    }
}

/**
 * Watch the provided file for changes.
 * 
 * @param filePath The path to the file to watch.
 */
const watchFile = (filePath: string):void => {
    try {
        fs.watch(filePath, (eventType: string) => {
            if (eventType === 'change') {
                const file = fs.readFileSync(filePath, 'utf8');
                const data = Papa.parse(file, { header: true });
                mainWindow?.webContents.send('file-data', data.data);
            }
        });
    } catch (error) {
        mainWindow?.webContents.send('file-error', 'Error setting watch. Data may not refresh if changed.');
    }
   
}

/**
 * Set the window title.
 * 
 * @param newTitle The new title to set. Appended to the app name.
 */
const setWindowTitle = (newTitle: string): void => {
    const appTitle = app.getName();
    if (!newTitle) {
        mainWindow?.setTitle(appTitle);
        return;
    }
    mainWindow?.setTitle(`${appTitle} - ${newTitle}`);
}
