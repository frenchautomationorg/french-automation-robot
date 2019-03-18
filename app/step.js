
class Step {
	constructor(resolveStep, rejectStep, timeout = 30000) {
		this._success = resolveStep;
		this._error = rejectStep;

		this._sessionData = {};
		this._timeoutValue = timeout;
		this._timeout = setTimeout(_ => {
			this._timedOut()
		}, timeout)
	}

	//
	// PRIVATE FUNCTIONS
	//

	_timedOut() {
		this.error("Step timed out after - "+this._timeoutValue+'ms');
	}


	//
	// PUBLIC FUNCTIONS
	//

	// "virtual"
	inputUrl(url) {
		console.error("Step received url but is not supposed to : "+url);
	}

	success() {
		clearTimeout(this._timeout);
		this._success(this._sessionData);
	}

	error(error) {
		this._error(error);
	}
}

module.exports = Step;