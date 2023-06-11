// main.js
const { app, dialog, Menu, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const fs = require('fs');
const Papa = require('papaparse');

let mainWindow;

// Detect system's dark mode setting
if (nativeTheme.shouldUseDarkColors) {
    // Enable dark mode
    app.on('ready', () => {
        app.commandLine.appendSwitch('force-dark-mode');
    });
}

// Prevent errors on Windows X-Server
app.disableHardwareAcceleration();

// Create the application window.
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    mainWindow.loadFile('src/index.html');
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

// Show file open dialog
ipcMain.handle('open-csv', async () => {
    return await openFile();
});

// Parse the CSV
ipcMain.handle('parse-csv', async (event, path) => {
    const file = fs.readFileSync(path, 'utf8');
    return Papa.parse(file, { header: true });
});

// Open file dialog and handle selected file
const openFile = async () => {
    const { filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    const filePath = filePaths[0];
    watchFile(filePath);
    return filePath;
};

// Watches the file at filePath for changes, 
// and triggers sending new data if it changed.
function watchFile(filePath) {
    fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            console.log(`File at ${filePath} modified, reloading data`);
            const file = fs.readFileSync(filePath, 'utf8');
            const data = Papa.parse(file, { header: true });
            mainWindow.webContents.send('file-data', data.data);
        }
    });
}