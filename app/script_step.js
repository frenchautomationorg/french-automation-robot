const Step = require('./step');
const lineReader = require('readline');
const fs = require('fs-extra');

const SCRIPT_FINISH_FUNCTION = `\
	function scriptFinish(object) {
		if (object)
			return JSON.stringify(object);
	}
`;

class ScriptStep extends Step {
	constructor(stepResolve, stepReject, jsonStep, win, isDomReady = false) {
		super(stepResolve, stepReject, jsonStep.timeout);

		if (jsonStep.startWith && typeof jsonStep.startWith.expected === 'undefined')
			jsonStep.startWith.expected = true;

		Object.assign(this, {
			_snippet: jsonStep.snippet,
			_startWith: jsonStep.startWith,
			_endType: jsonStep.endType,
			_endWith: jsonStep.endWith,
			_next: jsonStep.next,
			_download: jsonStep.download,
			_ignoreList: jsonStep.ignoreList,
			_window: win,
			_script: '',
			_domReady: isDomReady,
			_scriptWaiting: true
		});
	}

	//
	// GETTER/SETTER
	//

	get downloadInfo() { return this._download }


	//
	// PRIVATE FUNCTIONS
	//

	_executeScript() {
		// Dom is not ready, register that script should be executed when dom becomes ready
		if (!this._domReady) {
			this._scriptWaiting = true;
			return;
		}
		this._scriptWaiting = false;

        // Execute step script
        this._window.webContents.executeJavaScript(this._script, true).then(scriptData => {
        	if (scriptData) {
	        	try { scriptData = JSON.parse(scriptData); }
	        	catch(e) {
	        		return reject("Couldn't parse webContents.executeJavaScript() scriptData\n"+JSON.stringify(e, null, 4));
	        	}
	        	// Merge scriptData with Step sessionData
	        	super._sessionData = {...super._sessionData, ...scriptData};
	        }

        	if (this._endType == 'snippet')
        		super.success();
        });
    }

	* _stepActionsIterator() {
		// Wait for starting url
		if (this._startWith && this._startWith.expected == true) {
			let startUrlMatched = false;
			while (startUrlMatched == false) {
				let yieldUrl = yield;
				if (this._startWith.url == yieldUrl.url && this._startWith.method.toLowerCase() == yieldUrl.method.toLowerCase())
					startUrlMatched = true;
			}
		}

		// Execute script/download
		if (this._snippet)
			this._executeScript();
		if (this._download)
			this._window.webContents.downloadURL(this._download.url);

		// Wait for ending url
		if (this._endType == 'url') {
			let endUrlMatched = false;

			while (endUrlMatched == false) {
				let yieldUrl = yield;

				// Check Browser window
				if (this._window.webContents.getURL().indexOf(this._endWith.url) == 0 && this._endWith.method.toLowerCase() == yieldUrl.method.toLowerCase())
					endUrlMatched = true;

				// Check yield URL context (useful for JS apps)
				if (yieldUrl.url.indexOf(this._endWith.url) == 0 && this._endWith.method.toLowerCase() == yieldUrl.method.toLowerCase())
					endUrlMatched = true;
			}
		}

		return true;
	}


	//
	// PUBLIC FUNCTIONS
	//

	async init(environmentVars) {
		await new Promise((resolve, reject) => {
			// No script file, normalize behavior with scriptFinish function
			if (!this._snippet)
				return resolve(SCRIPT_FINISH_FUNCTION+'\nscriptFinish();');

            // Read script file
            const instructions = lineReader.createInterface({
                input: fs.createReadStream(`${__dirname}/../exec/program/${this._snippet}`)
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
            	// Add default scriptFinish call at end of file if none found
            	if (script.indexOf("scriptFinish(") == -1)
            		script = script+"\nscriptFinish();";

            	// Prepend scriptFinish function definition
            	this._script = SCRIPT_FINISH_FUNCTION+'\n'+script

            	resolve();
            }).on('error', reject);
		});
	}

	execute() {
		// Create iterator object from generator function
		this._urlAction = this._stepActionsIterator();
		// Move iterator to starting position
		this._urlAction.next();

		// Trigger execution with starting url if provided
		if (this._startWith && this._startWith.url)
			this._window.webContents.loadURL(this._startWith.url);
	}

	inputUrl(details) {
		try {
			let {value, done} = this._urlAction.next(details);
			if (this._endType == 'url' && (value == true && done == true))
				super.success();
		} catch(error) {
			super.error(error);
		}
	}

	downloadState(state) {
		this._download.state = state;
		if (this._endType == 'download') {
			if (state == 'success')
				this.success();
			else if (state == 'error')
				this.error(`File ${this._download.name} failed with state ${state}`);
		}
	}

	domReady(isReady) {
		this._domReady = isReady;
		if (this._domReady == true) {
			// Start pending executions
			if (this._scriptWaiting == true)
				this._executeScript();
		}
	}
}

module.exports = ScriptStep;