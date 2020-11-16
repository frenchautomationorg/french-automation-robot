const api = require('../utils/api_helper');
const fs = require('fs-extra');
const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;

const Task = require('./task');

class Robot {
	constructor() {
		this._task = null;
		this._browserInitialized = false;
	}

	//
	// STATIC
	//

	static get EXEC_FOLDER() {return 'program'};


	//
	// GETTER/SETTER
	//

	get id() {
		const credentials = api.credentials();
		return credentials ? credentials.id : -1;
	}

	get window() {return this._window;}
	set window(win) {this._window = win;}

	get mainWindow() {return this._mainWindow}
	set mainWindow(mainWin) {this._mainWindow = mainWin}


	//
	// PRIVATE FUNCTIONS
	//

	_initBrowser() {
		if (this._browserInitialized == true)
			return;

	    // Window initialization
	    this.window = new BrowserWindow({
	    	width: 1000,
	    	height: 1000,
	    	alwaysOnTop: true,
	        closable: true,
	        minimizable: false,
	        resizable: true,
	        webPreferences: { nodeIntegration: false } })
	    // this.window.openDevTools();

	    // When request is complete, notify task so it can continue ongoing task processing
        this.window.webContents.session.webRequest.onCompleted((details, callback) => {
        	if (['stylesheet', 'image', 'script'].includes(details.resourceType))
        		return;

        	// App level url filtering
        	if (details.url.match(/file:\/\//) != null || details.url.includes('devtools://'))
        		return;

        	// Trigger url processing
        	if (this._task)
        		this._task.inputUrl(details);
        });

		this.window.webContents.on('new-window', (event, url) => {
			event.preventDefault();
			this.window.loadURL(url);
		});
        // On navigation, notify task that dom is not ready anymore
        this.window.webContents.on('did-navigate', (event, url) => {
        	if (!this._task)
        		return;

        	this._task.domReady(false);
        	this._task.inputUrl({method: 'get', url: url});
        });

        // On dom ready, notify task so it can trigger paused script execution
        this.window.webContents.on('dom-ready', _ => {
        	if (!this._task)
        		return;
        	this._task.domReady(true);
        });

	    this.window.webContents.session.on('will-download', (event, item, webContents) => {
	    	if (!this._task)
	    		return;
		  item.setSavePath('/tmp/'+item.getFilename());

		  item.on('updated', (event, state) => {
		    if (state === 'interrupted') {
		      console.log('Le téléchargement est interrompu mais peut être redémarrer')
		    } else if (state === 'progressing') {
		      if (item.isPaused()) {
		        console.log('Le téléchargement est en pause')
		      } else {
		        console.log(`Received bytes: ${item.getReceivedBytes()}`)
		      }
		    }
		  })
		  item.once('done', (event, state) => {
		    if (state === 'completed') {
		      console.log('Téléchargement réussi')
		    } else {
		      console.log(`Téléchargement échoué : ${state}`)
		    }
		  })
	    	// this._task.willDownload(item);
	    });

	    this.window.on('closed', _ => {
	        this._browserInitialized = false;
	        this.window = null;

	        if (this._task)
	        	this._task.failed("Window closed during process");
	    });

        this.window.maximize();
        this.window.show();
	    this._browserInitialized = true;
	}

	_end() {
		// Manualy delete task to ensure that garbage collector resets any unfinished promise/timeout
		delete this._task;

		// Destroy window to reset current page and session
		if (this.window) {
			this.window.destroy();
			delete this._window;
			this._browserInitialized = false;
		}
	}


	//
	// PUBLIC FUNCTIONS
	//

	async run() {
		let nextTimeout = 5000;
		try {
			// Load task if available
			try {
				this._task = await Task.fetch(this);
				if (!this._task) {
		        	console.log("No task found");
					return;
				}

			} catch(err) {
				console.error("Couldn't fetch task :");
				console.error(err);
				return nextTimeout = 30000;
			}

			// Init working browser
			this._initBrowser();
			// Execute task
			await this._task.start();

		} catch(err) {
			console.error("Unexpected error during task execution");
			console.error(err);
		} finally {
			this._end();
			console.log(`Fetching task in ${nextTimeout}`);
			setTimeout(_ => { this.run() }, nextTimeout);
		}
	}

	stop() {
		this._end();
	}
}

module.exports = Robot;