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
		super(stepResolve, stepReject, jsonStep, win, isDomReady);
	}

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
	        	this._sessionData = {...this._sessionData, ...scriptData};
	        }

        	if (!this._endWith)
        		this.success();
        });
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
}

module.exports = ScriptStep;