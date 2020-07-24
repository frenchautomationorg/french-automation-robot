
class Step {
	constructor(resolveStep, rejectStep, jsonStep, win, isDomReady) {
		this._success = resolveStep;
		this._error = rejectStep;
		this._sessionData = {};

		if (jsonStep.startWith && typeof jsonStep.startWith.expected === 'undefined')
			jsonStep.startWith.expected = true;

		Object.assign(this, {
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


		this._timeoutValue = jsonStep.timeout || 30000;
		this._timeout = setTimeout(_ => {
			this._timedOut()
		}, this._timeoutValue)
	}

	//
	// PRIVATE FUNCTIONS
	//

	_timedOut() {
		this.error("Step timed out after - "+this._timeoutValue+'ms');
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

	success() {
		clearTimeout(this._timeout);
		this._success(this._sessionData);
	}

	error(error) {
		this._error(error);
	}

	inputUrl(details) {
		try {
			if (!this._urlAction)
				return;
			let {value, done} = this._urlAction.next(details);
			if (this._endWith && (value == true && done == true))
				this.success();
		} catch(error) {
			this.error(error);
		}
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

	downloadState(state) {
		this._download.state = state;
		if (!this._endWith) {
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


	//
	// GETTER/SETTER
	//

	get downloadInfo() { return this._download }

	//
	// VIRTUAL FUNCTIONS
	//

	async init() {
		console.error("Error: Step children must implement init() function");
	}
}

module.exports = Step;