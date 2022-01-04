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
// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

function createWindow () {

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: false
        },
        icon: __dirname + '/assets/img/logo_fa.png'
    })

    mainWindow.maximize();

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // and load the ./html/index.html of the app.
    mainWindow.loadFile(__dirname + '/html/index.html')

    // Set Robot ID
    mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);

    // Set mainWindow to robot so it can be used as a parent of window used for tasks.
    // Closing parent closes children
    robot.mainWindow = mainWindow;

    // Check if config path and file exist
    if (!fs.existsSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json')) {
        fs.mkdirSync(app.getPath("appData") + '/french-automation-robot/config', {recursive: true});
        const credentialsTempalte = {
            "method": "post",
            "action": "setConfig",
            "id": "1",
            "back_host": "https://",
            "clientKey": "",
            "clientSecret": "",
            "idPending": "1",
            "idProcessing": "2",
            "idFailed": "3",
            "idDone": "4",
            "autoStart": false,
            "openDevTools": false,
            "windowOpened": false
        }
        credentialsTempalte.installPath = process.platform == 'win32'
            ? __dirname
            : "/opt/node/french-automation-robot";
        fs.writeFileSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json', JSON.stringify(credentialsTempalte, null, 4), 'utf8');
    }
    else {
        // Autostart robot if configured
        const rawConfig = fs.readFileSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json');
        if (rawConfig && rawConfig !== '') {
            const { autoStart, installPath, openDevTools, windowOpened } = JSON.parse(rawConfig);

            // Autostart
            if (autoStart) mainWindow.webContents.executeJavaScript(`document.getElementById("launchBtn").click();`);

            // Open developer console in robot pages
            if (openDevTools) robot.devTools = true;

            if (windowOpened) robot.keepSession = true;

            // Set temp folder according to config file : "/opt/node/french-automation-robot" or "C://french-automation-robot-win32-x64"
            console.log("Install Path : " + installPath);
            if ((installPath) && (installPath != ""))  {
                app.setPath("temp", installPath);
            }
        }

    }

    // Check if exec path and subfolders exist
    if (!fs.existsSync(app.getPath("temp") + '/exec')) {
        fs.mkdirSync(app.getPath("temp") + '/exec', {recursive: true});
        fs.mkdirSync(app.getPath("temp") + '/exec/downloads', {recursive: true});
        fs.mkdirSync(app.getPath("temp") + '/exec/program', {recursive: true});
        // fs.copyFileSync(__dirname + '/../french-automation-robot/exec/package.json',app.getPath("temp") + '/french-automation-robot/exec/package.json');
    }



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

    const template = [];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        robot.stop();
        app.quit();
    }
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null)
        createWindow();
});

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

    if (arg.method == 'get') {
        switch (arg.page) {
            case 'access':
                mainWindow.loadFile(__dirname + '/html/access.html');
                try {
                    const rawConfig = fs.readFileSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json');
                    if (rawConfig && rawConfig !== '') {
                        const {
                            id,
                            back_host,
                            clientKey,
                            clientSecret,
                            idPending,
                            idProcessing,
                            idFailed,
                            idDone,
                            autoStart,
                            installPath,
                            openDevTools,
                            windowOpened
                        } = JSON.parse(rawConfig);

                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('id').value = '${id}';
                            document.getElementById('f_server').value = '${back_host}';
                            document.getElementById('f_key').value = '${clientKey}';
                            document.getElementById('f_secret').value = '${clientSecret}';
                            document.getElementById('f_processing').value = '${idProcessing}';
                            document.getElementById('f_done').value = '${idDone}';
                            document.getElementById('f_pending').value = '${idPending}';
                            document.getElementById('f_failed').value = '${idFailed}';
                            document.getElementById('f_autostart').checked = ${autoStart};
                            document.getElementById('f_install_path').value = '${installPath}';
                            document.getElementById('f_open_dev_tools').checked = ${openDevTools};
                            document.getElementById('f_window_opened').checked = ${windowOpened};
                        `);
                    }
                } catch(err) {
                    ;
                }
            break;

            default:
                mainWindow.loadFile(__dirname + '/html/index.html');
                mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);
            break;
        }
    }
    else if (arg.method == 'post') {
        switch (arg.action) {
            case 'launchBot':
                mainWindow.loadFile(__dirname + '/html/running.html')
                mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);

                const rawConfig = fs.readFileSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json');
                if (rawConfig && rawConfig !== '') {
                    const { windowOpened } = JSON.parse(rawConfig);
                    robot._keepSession = windowOpened;
                }
                
                robot.run();
                console.log("Robot running...");
            break;


            case 'stopBot':
                robot.pause();
                console.log("Robot stopping...");

                mainWindow.loadFile(__dirname + '/html/index.html')
                mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${robot.id}";`);


            break;

            case 'setConfig':
                // Store server config
                fs.writeFileSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json', JSON.stringify(arg, null, 4));

                mainWindow.loadFile(__dirname + '/html/index.html')
                mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${arg.id}";`);

                // Reload api credentials
                api.credentials(true);
                mainWindow.loadFile(__dirname + '/html/index.html');
            break;

            case 'cancelConfig':
                mainWindow.loadFile(__dirname + '/html/index.html');
                mainWindow.webContents.executeJavaScript(`document.getElementById("id").innerHTML = "${arg.id}";`);
            break;
        }
    }

    event.returnValue = 'success'
});
