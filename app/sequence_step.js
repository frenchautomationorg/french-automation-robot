const electron = require('electron')
const app = electron.app;
const Step = require('./step');
const { SequenceError, ApiError } = require('./errors');

class SequenceStep extends Step {
	constructor({resolveStep, rejectStep, jsonStep, win, utils, log, isDomReady = false}) {
		super(resolveStep, rejectStep, jsonStep, win, log, isDomReady);

        this._utils = utils;
		this._sequence = null;
	}

	//
	// PUBLIC FUNCTIONS
	//

	async init() {
        try {
            // const requirePath = `${__dirname}/../exec/program/${this._snippet}`
            const requirePath = app.getPath("temp") + `/french-automation-robot/exec/program/${this._snippet}`
        	delete require.cache[require.resolve(requirePath)];
        	this._sequence = require(requirePath);
        } catch(err) {
            this.error(new SequenceError(err));
        }
    }

    async _executeScript() {
        try {
            await this._sequence.execute(this._utils);
            if (!this._endWith)
                this.success();
        } catch(err) {
            this.error(new SequenceError(err));
        }
    }
}

module.exports = SequenceStep;