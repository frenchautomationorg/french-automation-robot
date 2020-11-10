const Step = require('./step');
const lineReader = require('readline');
const fs = require('fs-extra');

let CONSOLE_ERROR;
let PREPENDED_LINES = 0;

class ScriptStep extends Step {
	constructor(stepResolve, stepReject, jsonStep, win, sequenceUtils, isDomReady = false) {
		super(stepResolve, stepReject, jsonStep, win, isDomReady);
		this.sequenceUtils = sequenceUtils;

		CONSOLE_ERROR = undefined;
	}

	//
	// PRIVATE FUNCTIONS
	//
	consoleMessage(event, level, message, line, sourceId) {
		if (level === 3)
			CONSOLE_ERROR = `${message} - line:${line - PREPENDED_LINES}`.replace(/^Uncaught /, '');
	}

	_executeScript() {
		// Dom is not ready, register that script should be executed when dom becomes ready
		if (!this._domReady) {
			this._scriptWaiting = true;
			return;
		}
		this._scriptWaiting = false;

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
		        		console.error("WARN: Couldn't parse webContents.executeJavaScript() scriptData\n"+JSON.stringify(e, null, 4));
		        	}
		        }
		        else
		        	this._sessionData = {...this._sessionData, ...scriptData};
	        }

        	if (!this._endWith)
        		this.success();
        }).catch(error => {
        	if (CONSOLE_ERROR)
        		error = CONSOLE_ERROR;
    		this.error(error);
        });
    }


	//
	// PUBLIC FUNCTIONS
	//

	async init(environmentVars) {
		await new Promise((resolve, reject) => {
			// No script file
			if (!this._snippet)
				return resolve();
			const snippetFile = `${__dirname}/../exec/program/${this._snippet}`;

			if (!fs.existsSync(snippetFile))
				return reject(`Couldn't find snippet file ${snippetFile}`);

            // Read script file
            const instructions = lineReader.createInterface({
                input: fs.createReadStream(snippetFile)
            });
            const lines = [];
            // Replace environment variables
            instructions.on('line', inputLine => {
	            const regex = new RegExp(/{ENV\|([^}]*)}/g);
	            let line = inputLine, matches = null;
	            if (environmentVars)
		            while ((matches = regex.exec(inputLine)) != null)
		            	if (environmentVars[matches[1]])
		                	line = line.replace(matches[0], environmentVars[matches[1]]);

	            lines.push(line);
            }).on('close', _ => {
            	let script = lines.join('\n');

            	let sessionDataStr, envStr;
            	try {
            		sessionDataStr = JSON.stringify(this.sequenceUtils.sessionData, null, 4);
            	} catch(err) {
            		console.error("Couldn't prepend sessionData to script");
            	}
            	try {
            		envStr = JSON.stringify(this.sequenceUtils.env, null, 4);
            	} catch(err) {
            		console.error("Couldn't prepend env to script");
            	}

            	this._script = '';
            	if (sessionDataStr)
            		this._script += `sessionData = ${sessionDataStr};\n`;
            	if (envStr)
            		this._script += `env = ${envStr};\n`;
            	PREPENDED_LINES = this._script.split('\n').length+1;

        		this._script += script;

            	resolve();
            }).on('error', reject);
		});
	}
}

module.exports = ScriptStep;