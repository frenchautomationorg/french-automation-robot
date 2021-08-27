const electron = require('electron')
const app = electron.app;
const Step = require('./step');
const { SequenceError, ApiError } = require('./errors');

/** Step executed as a nodejs module */
class SequenceStep extends Step {
    /*
     * @param {promise} resolveStep - Resolve callback provided by Task. Allow resolving from Task as well as from Step
     * @param {promise} rejectStep - Reject callback provided by Task. Allow rejecting from Task as well as from Step
     * @param {Object} jsonStep - Step configuration object
     * @param {Object} win - Electron task's window
     * @param {function} log - Log function of {@link Task#log Task.log}
     * @param {bool} isDomReady - Whether to start step execution right away or wait for the DOM to be ready
     */
	constructor({resolveStep, rejectStep, jsonStep, win, utils, log, isDomReady = false}) {
		super(resolveStep, rejectStep, jsonStep, win, log, isDomReady);

        this._utils = utils;
		this._sequence = null;
	}

	//
	// PUBLIC FUNCTIONS
	//

    /** Initialize step<br>
     * requires the sequence's script file
     */
	async init(environmentVars, stepData) {
        try {

            // Initialize stepData in utils
            this._utils.stepData = stepData;

            // const requirePath = `${__dirname}/../exec/program/${this._snippet}`
            const requirePath = app.getPath("temp") + `/exec/program/${this._snippet}`
        	delete require.cache[require.resolve(requirePath)];
        	this._sequence = require(requirePath);
        } catch(err) {
            this.error(new SequenceError(err));
        }
    }

    /** Execute the sequence's script */
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