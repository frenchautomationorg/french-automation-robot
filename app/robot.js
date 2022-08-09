const api = require('../utils/api_helper');
const fs = require('fs-extra');
const electron = require('electron');
const BrowserWindow = electron.BrowserWindow;
const Task = require('./task');
const { ProgramError } = require('./errors');
/** Main Robot class
 * Handles electron task window initialization and program execution start
 */
class Robot {
	constructor() {
		this._task = null;
		this._browserInitialized = false;
		this._sessionSet = false;
		this._started = false;
	}

	//
	// STATIC
	//
	/** Where to find the fetched task's program on disk
	 * @readonly
	 */
	static get EXEC_FOLDER() {return 'program'};


	//
	// GETTER/SETTER
	//

	/** Fetches credentials from configuration using {@link module:api_helper.credentials api_helper.credentials()} */
	get id() {
		const credentials = api.credentials();
		return credentials ? credentials.id : -1;
	}

	get window() {return this._window;}
	set window(win) {this._window = win;}

	get mainWindow() {return this._mainWindow}
	set mainWindow(mainWin) {this._mainWindow = mainWin}


	get devTools() {return this._devTools}
	set devTools(devTools) { this._devTools = devTools}

	get keepSession() {return this._keepSession}
	set keepSession(keepSession) { this._keepSession = keepSession}

	//
	// PRIVATE FUNCTIONS
	//

	/** Initialize task's browser window */
	_initBrowser() {
		if (this._browserInitialized == true)
			return;
		var self = this;
	    // Window initialization
	    this.window = new BrowserWindow({
	    	width: 1000,
	    	height: 1000,
	    	alwaysOnTop: false,
	        closable: true,
	        minimizable: false,
	        resizable: true,
	        webPreferences: { nodeIntegration: false, enableRemoteModule: true } })

	    // this.window.openDevTools();
	    if (this._devTools) this.window.openDevTools();

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

        if (!this._sessionSet) {
		    this.window.webContents.session.on('will-download', (event, item, webContents) => {
		    	if (!this._task)
		    		return;
		    	this._task.willDownload(item);
		    });
		    this._sessionSet = true;
		}

	    this.window.on('closed', _ => {
	    	this.stop();
	    });

        this.window.maximize();
        this.window.show();
	    this._browserInitialized = true;
	}

	/** Ends robot's execution<br>
	 * Clean stop and delete of robot and any running task<br>
	 * Destroys and delete the task's window
	 */
	_end(err) {
		if (this._task) {
			this._task.stop(err);
			// Manualy delete task to ensure that garbage collector resets any unfinished promise/timeout
			delete this._task;
		}

		if (!this._keepSession) {

			// Destroy window to reset current page and session
			if (this.window) {
				this.window.destroy();
				delete this.window;
				this._browserInitialized = false;
			}
			
		}
	}


	//
	// PUBLIC FUNCTIONS
	//

	/** Main entry point of robot execution<br>
	 * First fetch potential pending Task, then starts it and await its completion<br>
	 * Always ends with a recursive call to itself after 5s
	 */
	async run() {
		let nextTimeout = 5000;
		try {
			// Load task if available
			try {
				this._started = true;
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
			setTimeout(_ => {
				if (this._started) {
					this.run()
				}
			}, nextTimeout);
		}
	}

	/** Public function to stop robot execution, triggered by closing the task's window<br>
	 * Internaly calls {@link Robot#_end Robot._end()} with WindowClosedDuringProcess error */
	stop() {
		this._end(new ProgramError("WindowClosedDuringProcess"));
	}

	/** Stops {@link Robot#run Robot.run()} recursive calls */
	pause() {
		this._started = false;
	}

}

module.exports = Robot;