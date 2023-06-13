import Store from 'electron-store';
import { BrowserWindow } from 'electron';

const store = new Store();

export const windowStateManager = (mainWindow: BrowserWindow): void => {
    let windowState = store.get('windowState') || { width: 1000, height: 600 };

    // Set the initial dimensions and position if present
    try {
        mainWindow.setBounds(windowState);
    } catch (e) {
        console.error(e);
    }

    // Update the state on resize and move events
    mainWindow.on('resize', () => {
        windowState = mainWindow.getBounds();
        store.set('windowState', windowState);
    });

    mainWindow.on('move', () => {
        windowState = mainWindow.getBounds();
        store.set('windowState', windowState);
    });
};

export default windowStateManager;