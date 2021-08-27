const electron = require('electron')
const app = electron.app;
const Step = require('./step');
const lineReader = require('readline');
const fs = require('fs-extra');
const { ScriptError, StepError, ProgramError } = require('./errors');

let CONSOLE_ERROR;
let PREPENDED_LINES = 0;

/** Step that executes a script on the web client
 * @extends Step
 */
class ScriptStep extends Step {
	/**
	 * @param {promise} resolveStep - Resolve callback provided by Task. Allow resolving from Task as well as from Step
	 * @param {promise} rejectStep - Reject callback provided by Task. Allow rejecting from Task as well as from Step
	 * @param {Object} jsonStep - Step configuration object
	 * @param {Object} win - Electron task's window
	 * @param {function} log - Log function of {@link Task#log Task.log}
	 * @param {bool} isDomReady - Whether to start step execution right away or wait for the DOM to be ready
	 */
	constructor({resolveStep, rejectStep, jsonStep, win, utils, log, isDomReady = false}) {
		super(resolveStep, rejectStep, jsonStep, win, log, isDomReady);
		this.utils = utils;
	}

	//
	// PRIVATE FUNCTIONS
	//

	/** Callback for window's 'console-message' event<br>
	 * Store the console message to fetch error from it
	 */
	consoleMessage(event, level, message, line, sourceId) {
		// Called by webContents console-message event
		// `this` isn't the class context but the callback function
		// Use global variables
		if (level === 3)
			CONSOLE_ERROR = new ProgramError(message.replace(/^Uncaught [^]+: /, ''));
	}

	/** Bind 'console-message' event callback and execute step's script<br>
	 * Any data returned by the script will be appended to sessionData object
	 */
	async _executeScript() {
		try {
			CONSOLE_ERROR = undefined;

	        this._window.webContents.removeListener('console-message', this.consoleMessage);
	        this._window.webContents.on('console-message', this.consoleMessage);

	        // Execute step script
	        this._window.webContents.executeJavaScript(this._script, true).then(scriptData => {
	        	if (scriptData) {
	        		if (typeof scriptData === 'string') {
			        	try {
			        		scriptData = JSON.parse(scriptData);
				        	// Merge scriptData with Step sessionData
				        	this._sessionData = {...this._sessionData, ...scriptData};
			        	}
			        	catch(e) {
			        		this.log("WARN: Couldn't parse webContents.executeJavaScript() scriptData\n"+JSON.stringify(e, null, 4));
			        	}
			        }
			        else
			        	this._sessionData = {...this._sessionData, ...scriptData};
		        }

	        	if (!this._endWith)
	        		this.success();
	        }).catch(err => {
	    		err = new ScriptError(CONSOLE_ERROR || err || "Unknown error while executing script");
	    		this.error(err);
	        });
   	    } catch(err) {
	    	;
	    }
    }


	//
	// PUBLIC FUNCTIONS
	//

	/** Initialize the step<br>
	 * Prepend step's env and task's sessionData to the executed script so the variables can be accessed inside the web client
	 */
	async init(environmentVars, stepData) {
		try {
			// No script file
			if (!this._snippet)
				return;

			// const snippetFile = `${__dirname}/../exec/program/${this._snippet}`;
			const snippetFile = app.getPath("temp") + `/exec/program/${this._snippet}`;

			if (!fs.existsSync(snippetFile))
				throw new Error(`Couldn't find snippet file ${snippetFile}`);

            // Read script file
            let script = fs.readFileSync(snippetFile, 'utf8');
            // Replace environment variables
            let matches = null;
            const regex = new RegExp(/{ENV\|([^}]*)}/g);
            if (environmentVars)
	            while ((matches = regex.exec(script)) != null)
	            	if (environmentVars[matches[1]])
	                	script = script.replace(matches[0], environmentVars[matches[1]]);

        	// Prepend stepData, sessionData and env to script
        	this._script = '';
        	try {
        		this._script += `stepData = ${JSON.stringify(stepData, null, 4)};\n`;
        	} catch(err) {
        		this.log("WARN: Couldn't prepend stepData to script");
        	}
        	try {
        		this._script += `sessionData = ${JSON.stringify(this.utils.sessionData, null, 4)};\n`;
        	} catch(err) {
        		this.log("WARN: Couldn't prepend sessionData to script");
        	}
        	try {
        		this._script += `env = ${JSON.stringify(this.utils.env, null, 4)};\n`;
        	} catch(err) {
        		this.log("WARN: Couldn't prepend env to script");
        	}
        	// Save prepended line count to fix error line message
        	PREPENDED_LINES = this._script.split('\n').length+1;

    		this._script += script;

		} catch(err) {
			this.error(new ScriptError(err));
		}
	}
}

module.exports = ScriptStep;