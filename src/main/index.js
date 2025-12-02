import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#121212',
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // CRÍTICO: Permite reproducir audio local en modo desarrollo
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- LÓGICA DE SPLICE LOCAL ---

// 1. Escaneo Recursivo
function scanDirectory(dir) {
  let results = [] 
  try {
    const list = fs.readdirSync(dir)
    list.forEach(file => {
      const fullPath = path.join(dir, file)
      try {
        const stat = fs.statSync(fullPath)
        if (stat && stat.isDirectory()) {
          results = results.concat(scanDirectory(fullPath))
        } else {
          if (/\.(wav|mp3|aif|flac|ogg|m4a)$/i.test(file)) {
            results.push({
              name: file,
              path: fullPath,
              size: stat.size,
              date: stat.mtime
            })
          }
        }
      } catch (err) { console.error(err) }
    })
  } catch (err) { console.error(err) }
  return results
}

// 2. Comunicación: Importar (Carpeta o Archivos)
ipcMain.handle('import-content', async (event, type) => { // type: 'folder' | 'files'
  const isFolder = type === 'folder'
  
  const { filePaths } = await dialog.showOpenDialog({
    title: isFolder ? 'Selecciona una carpeta' : 'Selecciona tus samples',
    buttonLabel: 'Importar',
    // Si es carpeta usa openDirectory, si son archivos usa openFile y multiSelections
    properties: isFolder ? ['openDirectory'] : ['openFile', 'multiSelections'],
    filters: [
      { name: 'Audio', extensions: ['wav', 'mp3', 'aif', 'flac', 'ogg', 'm4a'] }
    ]
  })
  
  if (filePaths.length > 0) {
    let files = []
    let folderName = 'Imported'

    if (isFolder) {
      // Modo Carpeta: Escaneo recursivo
      const folderPath = filePaths[0]
      folderName = path.basename(folderPath)
      files = scanDirectory(folderPath)
    } else {
      // Modo Archivos: Procesar lista seleccionada
      folderName = "Selección Individual"
      files = filePaths.map(fp => {
        try {
          const stat = fs.statSync(fp)
          return {
            name: path.basename(fp),
            path: fp,
            size: stat.size,
            date: stat.mtime
          }
        } catch (e) { return null }
      }).filter(f => f !== null)
    }

    return { folderName, files } 
  }
  return null
})

// 3. Comunicación: Arrastrar al DAW
ipcMain.on('ondragstart', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: icon 
  })
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})