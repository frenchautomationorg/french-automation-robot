// Modules to control application life and create native browser window
const electron = require('electron')
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const session = electron.session;
const exec = require('child_process').exec;

const api = require('./utils/api_helper');
const Robot = require('./app/robot');
const robot = new Robot();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
const Menu = electron.Menu;

// Includes
var fs = require('fs');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true;
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

function createWindow () {

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        },
        icon: './assets/img/new_logo_newmips.png'
    })

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // and load the ./html/index.html of the app.
    mainWindow.loadFile('./html/index.html')

    // Set Robot ID
    mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);

    // Set mainWindow to robot so it can be used as a parent of window used for tasks.
    // Closing parent closes children
    robot.mainWindow = mainWindow;

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    createWindow();

    const template = [{
        label: 'Action',
        submenu: [
        {
          label: 'Accueil',
          click: function() {
            mainWindow.loadFile('./html/index.html')
            mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);
          }

        },
        {
          label: 'Configurer la connexion',
          click: function() {
            mainWindow.loadFile('./html/access.html')
            mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);
          }

        },
        {
          label: 'Lancer les traitements',
          click: function() {
            console.log('Lancement');
            mainWindow.loadFile('./html/index.html');
            mainWindow.webContents.executeJavaScript(`document.getElementById("launchBtn").click();`);
          }

        },
        {
          type: 'separator'
        },
        {
          label: 'Quitter',
          click: function() {
            app.quit();
          }
        }]
    }]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin')
        app.quit()
})

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null)
        createWindow()
})

app.on('certificate-error', function(event, webContents, url, error, certificate, callback) {
    dialog.info('certificate-error');
    event.preventDefault();
    callback(true);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const { ipcMain } = require('electron')

ipcMain.on('synchronous-message', (event, arg) => {

    if (arg == null)
        return;

    if (arg.action == "setConfig") {
        // Store server config
        fs.writeFileSync('config/credentials.json', JSON.stringify(arg, null, 4));
        event.returnValue = 'Configuration réussie !'

        mainWindow.loadFile('./html/index.html')
        mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${arg.id}";`);

        // Reload api credentials
        api.credentials(true);
    }

    if (arg.action == "launchBot") {
        console.log("launchBot");
        mainWindow.loadFile('./html/running.html')
        mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);

        robot.run();
    }

    event.returnValue = 'success'
});