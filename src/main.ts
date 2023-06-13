// Third party imports
import { app, dialog, Menu, BrowserWindow, ipcMain, IpcMainEvent, globalShortcut, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';

// Local imports
import windowStateManager from './lib/windowStateManager';

// Reload app on changes.
if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
        electron: require(path.join(
            __dirname,
            '..',
            'node_modules',
            'electron'
        )),
        hardResetMethod: 'exit'
    });
}

// Used to set window title.
const appTitle = 'CSV Viewer';

let mainWindow: BrowserWindow | null = null;
let fileDialogOpen: boolean = false;

// Prevent errors on Windows X-Server
app.disableHardwareAcceleration();

// Create the application window.
function createWindow() {

    // Only create a new window if one does not already exist
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

    // Saves window state (size, position, etc.)
    windowStateManager(mainWindow);

    // Load the our app into the window
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    // Register the global shortcut for Ctrl+0 (reset zoom)
    globalShortcut.register('CommandOrControl+0', () => {
        mainWindow?.webContents.setZoomLevel(0);
    });

    // Register the global shortcut for Ctrl++ (increase zoom)
    globalShortcut.register('CommandOrControl+=', () => {
        const currentZoomLevel = mainWindow?.webContents.getZoomLevel();
        if (!currentZoomLevel) {
            return;
        }
        mainWindow?.webContents.setZoomLevel(currentZoomLevel + 1);
    });

    // Register the global shortcut for Ctrl+- (decrease zoom)
    globalShortcut.register('CommandOrControl+-', () => {
        const currentZoomLevel = mainWindow?.webContents.getZoomLevel();
        if (!currentZoomLevel) {
            return;
        }
        mainWindow?.webContents.setZoomLevel(currentZoomLevel - 1);
    });

    // Register the global shortcut for Ctrl+R (refresh)
    globalShortcut.register('CommandOrControl+R', () => {
        mainWindow?.reload();
    });

    // Register the global shortcut for Ctrl+Shift+I (toggle developer tools)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        mainWindow?.webContents.toggleDevTools();
    });

    // Clear the window object when the window is closed.
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create the application menu
const createMenu = () => {
    const template: MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: selectFile,
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
                {
                    label: "Copy",
                    accelerator: "CmdOrCtrl+C",
                },
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

// Start the app
app.whenReady().then(() => {
    createWindow();
    createMenu();
});

// Activate (create) a window when the app is activated (clicked) in the Dock (macOS)
app.on('activate', () => {
    createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    app.quit();
});

// Open file dialog and handle selected file
ipcMain.on('open-csv', async () => {
    console.log("main: received open-csv ipc event");
    await selectFile();
});

// Open file dialog and handle selected file
ipcMain.on('file-dropped', async (event: IpcMainEvent, filePath: string) => {
    console.log("main: received file-dropped ipc event");
    await loadFile(filePath);
});

// Open file dialog to pick a file.
const selectFile = async () => {
    console.log("openFile called.");
    if (fileDialogOpen) {
        console.log("File dialog already open, doing nothing.");
        return;
    }
    console.log("Showing file open dialog...");
    fileDialogOpen = true;
    const { filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    fileDialogOpen = false;
    if (!filePaths || filePaths.length === 0 || !filePaths[0]) {
        console.log("No file chosen in dialog. Doing nothing.");
        return null;
    }
    // Ensure it's a CSV
    if (path.extname(filePaths[0]) !== '.csv') {
        // Send a message to the renderer to show an error.
        console.log("File chosen is not a CSV. Doing nothing.");
        mainWindow?.webContents.send('file-error', 'File chosen is not a CSV.');
        return null;
    }
    loadFile(filePaths[0]);
};

/**
 * Load the provided file.
 */
const loadFile = async (filePath: string): Promise<any> => {
    console.log(`Opening ${filePath}...`);
    const file = fs.readFileSync(filePath, 'utf8');
    const data = Papa.parse(file, { header: true });
    setWindowTitle(filePath);
    watchFile(filePath);
    mainWindow?.webContents.send('file-data', data.data);
}

// Watches the file at filePath for changes, 
// and triggers sending new data if it changed.
function watchFile(filePath: string) {
    console.log(`Setting watch on ${filePath}.`);
    fs.watch(filePath, (eventType: string) => {
        console.log(`watch [${filePath}]: ${eventType} fired.`);
        if (eventType === 'change') {
            console.log(`File at ${filePath} modified, reloading data`);
            const file = fs.readFileSync(filePath, 'utf8');
            const data = Papa.parse(file, { header: true });
            mainWindow?.webContents.send('file-data', data.data);
        }
    });
}

function setWindowTitle(newTitle: string): void {
    if (!newTitle) {
        mainWindow?.setTitle(appTitle);
        return;
    }
    mainWindow?.setTitle(`${appTitle} - ${newTitle}`);
}