// main.js
const { app, dialog, Menu, BrowserWindow, nativeTheme, ipcMain, globalShortcut } = require('electron');
const rootPath = require('electron-root-path').rootPath;
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');

// Read the app title from package.json
const packagePath = path.join(rootPath, 'package.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
const appTitle = packageData.productName;

let mainWindow;
let fileDialogOpen = false;


// Prevent errors on Windows X-Server
//app.disableHardwareAcceleration();

// Create the application window.
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 850,
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
    mainWindow.loadFile('src/index.html');

    // Register the global shortcut for Ctrl+0 (reset zoom)
    globalShortcut.register('CommandOrControl+0', () => {
        mainWindow.webContents.setZoomLevel(0);
    });

    // Register the global shortcut for Ctrl++ (increase zoom)
    globalShortcut.register('CommandOrControl+=', () => {
        const currentZoomLevel = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(currentZoomLevel + 1);
    });

    // Register the global shortcut for Ctrl+- (decrease zoom)
    globalShortcut.register('CommandOrControl+-', () => {
        const currentZoomLevel = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(currentZoomLevel - 1);
    });

    // Register the global shortcut for Ctrl+R (refresh)
    globalShortcut.register('CommandOrControl+R', () => {
        mainWindow.reload();
    });

    // Register the global shortcut for Ctrl+R (refresh)
    globalShortcut.register('CommandOrControl+O', () => {
        openFile();
    });

    // Register the global shortcut for Ctrl+Shift+I (toggle developer tools)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        mainWindow.webContents.toggleDevTools();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create the application menu
const createMenu = () => {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open',
                    click: openFile,
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
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

// Start the app
app.whenReady().then(() => {
    createWindow();
    createMenu();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    app.quit();
    // if (process.platform !== 'darwin') {
    // }
});

// Activate (create) a window when the app is activated (clicked) in the Dock (macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Open file dialog and handle selected file
ipcMain.on('open-csv', async (event) => {
    console.log("main: received open-csv ipc event");
    await openFile();
});

// Open file dialog and handle selected file
const openFile = async () => {
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

    const filePath = filePaths[0];
    console.log(`Opening ${filePath}...`);
    const file = fs.readFileSync(filePath, 'utf8');
    const data = Papa.parse(file, { header: true });
    
    setWindowTitle(filePath);
    watchFile(filePath);
    mainWindow.webContents.send('file-data', data.data);
};

// Watches the file at filePath for changes, 
// and triggers sending new data if it changed.
function watchFile(filePath) {
    console.log(`Setting watch on ${filePath}.`);
    fs.watch(filePath, (eventType) => {
        console.log(`watch [${filePath}]: ${eventType} fired.`);
        if (eventType === 'change') {
            console.log(`File at ${filePath} modified, reloading data`);
            const file = fs.readFileSync(filePath, 'utf8');
            const data = Papa.parse(file, { header: true });
            mainWindow.webContents.send('file-data', data.data);
        }
    });
}

function setWindowTitle(newTitle) {
    if (!newTitle) {
        mainWindow.setTitle(appTitle);
        return;
    }
    mainWindow.setTitle(`${appTitle} - ${newTitle}`);
}