const { ApiError, StepError, ScriptError, SequenceError, AutomationError } = require('./errors');

class Step {
	constructor(resolveStep, rejectStep, jsonStep, win, log, isDomReady) {
		this._resolveStep = resolveStep;
		this._rejectStep = rejectStep;
		this._sessionData = {};

		if (jsonStep.startWith && typeof jsonStep.startWith.expected === 'undefined')
			jsonStep.startWith.expected = false;

		Object.assign(this, {
			_stepIdx: jsonStep.stepIdx,
			_serialNumber: jsonStep.serialNumber,
			_name: jsonStep.name,
			_snippet: jsonStep.snippet,
			_startWith: jsonStep.startWith,
			_endWith: jsonStep.endWith,
			_next: jsonStep.next,
			_download: jsonStep.download,
			_ignoreList: jsonStep.ignoreList,
			_window: win,
			_script: '',
			_domReady: isDomReady,
			_scriptWaiting: true
		});

		this.log = log;

		this._timeoutValue = jsonStep.timeout !== undefined ? jsonStep.timeout : 30000;
		if (this._timeoutValue !== false && this._timeoutValue != 0)
			this._timeout = setTimeout(_ => {
				this._timedOut()
			}, this._timeoutValue)
	}

	//
	// GETTER/SETTER
	//
	get download() {
		return this._download;
	}

	//
	// PRIVATE FUNCTIONS
	//

	_timedOut() {
		this.error(new StepError("Step timed out after - "+this._timeoutValue+'ms'));
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

		// Execute script
		if (this._snippet) {
			if (this._domReady) {
				this._scriptWaiting = false;
				this._executeScript()
			}
			// Dom is not ready, register that script should be executed when dom becomes ready
			else
				this._scriptWaiting = true;
		}
		// Trigger download
		if (this.download) {
			if (!this.download.url || this.download.url == "")
				this.log("WARN: No URL provided for download")
			else
				this._window.webContents.downloadURL(this.download.url);
		}

		// Wait for ending url
		if (this._endWith && this._endWith.url) {
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

	execute() {
		// Create iterator object from generator function
		this._urlAction = this._stepActionsIterator();

		// Move iterator to starting position
		this._urlAction.next();

		// Trigger execution with starting url if provided
		if (this._startWith && this._startWith.url && this._window)
			this._window.webContents.loadURL(this._startWith.url);
	}

	inputUrl(details) {
		try {
			if (!this._urlAction)
				return;
			let {value, done} = this._urlAction.next(details);
			if (this._endWith && (value == true && done == true))
				this.success();
		} catch(error) {
			this.error(new StepError(error));
		}
	}

	success() {
		clearTimeout(this._timeout);
		this._resolveStep(this._sessionData);
	}

	error(err) {
		clearTimeout(this._timeout);
		if (!(err instanceof AutomationError))
			err = new StepError(err);
		this._rejectStep(err);
	}

	domReady(isReady) {
		this._domReady = isReady;
		if (this._domReady === true && this._scriptWaiting == true) {
			this._scriptWaiting = false;
			this._executeScript();
		}
	}

	//
	// VIRTUAL FUNCTIONS
	//

	async init() {
		console.error("WARN: Virtual function Step.init called");
	}

	async _executeScript() {
		console.error("WARN: Virtual function Step._executeScript called");
	}
}

module.exports = Step;