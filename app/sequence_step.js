const Step = require('./step');

class SequenceStep extends Step {
	constructor(stepResolve, stepReject, jsonStep, win, utils, isDomReady = true) {
		super(stepResolve, stepReject, jsonStep, win, isDomReady);

		this._utils = utils;
		this._sequence = null;
	}

	//
	// PUBLIC FUNCTIONS
	//

	async init() {
        const requirePath = `${__dirname}/../exec/program/${this._snippet}`
    	delete require.cache[require.resolve(requirePath)];
    	this._sequence = require(requirePath);
    }

    _executeScript() {
        // Dom is not ready, register that sequence should be executed when dom becomes ready
        if (!this._domReady) {
            this._scriptWaiting = true;
            return;
        }
        this._scriptWaiting = false;

    	this._sequence.execute(this._utils).then(_ => {
            if (!this._endWith)
    		  this.success();
    	})
        .catch(error => {
            this.error(error)
        });
    }
}

module.exports = SequenceStep;