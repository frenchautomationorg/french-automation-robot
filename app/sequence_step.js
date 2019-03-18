const Step = require('./step');

class SequenceStep extends Step {
	constructor(stepResolve, stepReject, jsonStep, utils) {
		super(stepResolve, stepReject, jsonStep.timeout);

		this._snippet = jsonStep.snippet;
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

    execute() {
    	this._sequence.execute(this._utils).then(_ => {
    		super.success();
    	})
        .catch(error => {
        	super.error(error);
        });
    }
}

module.exports = SequenceStep;