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
		let credentials = api.credentials();
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
	    this.window.openDevTools();

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
	        // Retrieve name of file defined in current step
	        const filename = this._task.willDownload();
	        if (!filename)
	        	return;

	        item.setSavePath(`./exec/program/download/${filename}`);

	        item.on('updated', (event, state) => {
	        	this._task.downloadState(filename, 'pending');
	            if (state === 'interrupted')
	            	this._task.downloadState(filename, 'interrupted');
	            else if (state === 'progressing')
	                if (item.isPaused())
	                	this._task.downloadState(filename, 'paused');
	        });
	        item.once('done', (event, state) => {
	            if (state === 'completed')
	            	this._task.downloadState(filename, 'success');
	            else
	            	this._task.downloadState(filename, 'error');
	        });
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

	_end(rerun) {
		// Manualy delete task to ensure that garbage collector resets any unfinished promise/timeout
		delete this._task;

		// Destroy window to reset current page and session
		if (this.window) {
			this.window.destroy()
			this._browserInitialized = false;
		}
		if (rerun) {
			console.log("Fetching new task in 5000ms");
			setTimeout(_ => { this.run() }, 5000);
		}
	}


	//
	// PUBLIC FUNCTIONS
	//

	async run() {
		// Load task if available
		try {
			const task = await Task.fetch(this);
			if (!task) {
	        	console.log("No task found - Retry in 5000ms");
				return setTimeout(_=> {this.run()}, 5000);
			}

			// Init working browser
			this._initBrowser();

			// Start task execution
			this._task = task;
			await this._task.start();

			// Send log file to API
			await this._task.sendLogFile();

			this._end(true);

		} catch(error) {
			console.error("Couldn't fetch task :");
			console.error(error);
			console.error("Retrying in 30000ms");
			setTimeout(_ => { this.run() }, 30000);
		}

	}

	stop() {
		this._end();
	}
}

module.exports = Robot;