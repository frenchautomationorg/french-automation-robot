const api = require('../utils/api_helper');
const unzip = require('unzip-stream');
const fs = require('fs-extra');

const ScriptStep = require('./script_step');
const SequenceStep = require('./sequence_step');

class Task {
	constructor(task, robot) {
		this._id = task.id;
		this._state = task.r_state.id;
		this._env = task.f_data_flow;
		this._filesToDownload = [];
		this._robot = robot;
		this._window = robot.window;
		this._sessionData = {};
		this._loggedOut = false;
		this._domReady = false;

		this._startTime = process.hrtime();
	}


	//
	// STATIC
	//

	static get PROCESSING() {return 42;}
	static get FINALIZING() {return -1;}
	static get FAILED() {return 44;}
	static get PROCESSED() {return 43;}

	static async fetch(robotId) {
		if (robotId == null)
			return null;

		// Fetch task from API
	    let result = await api.call({url: '/api/task?fk_id_robot_robot=' + robotId + '&fk_id_status_state=41&include=r_state&limit=1'});

        let tasks = result.body.tasks;

        // No task available
        if (!result.body.tasks || !result.body.tasks.length || result.body.tasks.length == 0)
            return null;

        // Create task instance
        let task = new Task(result.body.tasks[0], robot);

        // Indicate to orchestrator, task is now in process
		await api.call({url: '/api/task/' + task.id, body: {r_state: task.PROCESSING}, method: 'put'});

		task._state = task.PROCESSING;

        return task;
	}


	//
	// GETTER/SETTER
	//

	get id() {return this._id}

	get robotId() {return this._robot.id}

	get window() {return this._robot.window}

	get state() {return this._state}
	set state(newState) {this._state = newState}

	get PROCESSING() {return 42}
	set PROCESSING(id) {this._config.taskStatus.processing = id}
	get FINALIZING() {return -1;}
	get FAILED() {return 44}
	set FAILED(id) {this._config.taskStatus.failed = id}
	get DONE() {return 43}
	set DONE(id) {this._config.taskStatus.done = id}

	get sequenceUtils() {
		return {
    		window: this.window,
    		robotId: this._robotId,
    		taskId: this._id,
    		env: this._env,
    		sessionData: this._sessionData,
    		api: api,
    		waitDownloads: _ => {
    			return new Promise((downloadsDone, downloadsError) => {
			    	let waitDownloadPromise = new Promise((resolve, reject) => {
			        	this.waitForDownloads(resolve, reject);
			    	});
			    	waitDownloadPromise.then(downloadsDone).catch(downloadsError);
    			});
    		}
    	}
	}

	//
	// PRIVATE FUNCTIONS
	//

	async _init() {
		console.log(`\n**** Initialization ****\n`);

		try {
			// Load data
			{
				// Download zip file
				let result = await api.call({url: '/api/task/'+this._id+'/downloadProgram', encoding: null});
				fs.writeFileSync('./program_zip.zip', result.body);

				// Clear previous task program files
				if (fs.existsSync('./exec/program'))
					fs.removeSync('./exec/program');

				// Unzip program folder
				await new Promise((resolve, reject) => {
					fs.createReadStream('./program_zip.zip')
						.pipe(unzip.Extract({
							path: './exec/program'
						}))
						.on('close', resolve)
						.on('error', reject);
				});
				// Delete downloaded zip
				fs.unlink('./program_zip.zip', _ =>{});

				// Parse env
				try {
					this._env = JSON.parse(this._env);
				} catch (error) {throw new Error("Task f_data_flow couldn't be parsed\n"+JSON.stringify(error, null, 4));}
				// Parse steps
				try {
					this._config = JSON.parse(fs.readFileSync(`${__dirname}/../exec/program/config.json`))
				} catch (error) {throw new Error("Task config.json couldn't be parsed\n"+JSON.stringify(error, null, 4));}
			}

			// Check config validity
			{
				// Ensure first step is defined and exist
				if (!this._config.firstStep)
					throw new Error("First step must be defined in config.json");
				if (!this._config.steps[this._config.firstStep])
					throw new Error(`First step ${this._config.firstStep} doesn't exist`)


				// Ensure steps flow validity
				for (let stepName in this._config.steps) {
					let step = this._config.steps[stepName];
					if (step.next && !this._config.steps[step.next])
						throw new Error(`Step '${step.next}' expected but doesn't exist`);
					if (!step.endType)
						throw new Error(`Step ${stepName} doesn't have a endType defined`);
					if (step.endType == 'url' && !step.endWith)
						throw new Error(`Step ${stepName} as 'url' endType but no endWith provided`);
				}
			}

		} catch (error) {
			console.log(`\tFAILED\n`);
			throw error;
		}
		console.log(`\tSUCCESS\n`);
	}

	_executeStep(stepName) {
		let jsonStep = this._config.steps[stepName];
		let stepError = {
			stepName: stepName,
			step: jsonStep
		};

		if (['script', 'sequence'].indexOf(jsonStep.type) == -1) {
			stepError.error = `Unkown step type ${jsonStep.type}`;
			return this.failed(stepError);
		}

		// Create, init and execute step
		new Promise((resolveStep, rejectStep) => {
	        console.log(`Executing step ${stepName}:`);
	        console.log(JSON.stringify(jsonStep, null, 4));

			// Create step
			if (jsonStep.type == 'script')
				this._step = new ScriptStep(resolveStep, rejectStep, jsonStep, this.window, this._domReady);
			else if (jsonStep.type == 'sequence')
				this._step = new SequenceStep(resolveStep, rejectStep, jsonStep, this.sequenceUtils);

			this._step.init(this._env).then(_ => {
				this._step.execute()
			})
			.catch(rejectStep)
		})
		// Step success
		.then(data => {
			// If step extracted data, merge with Task sessionData
			if (data)
				this._sessionData = {...this._sessionData, ...data};

			// Execute next step
			if (jsonStep.next)
				return this._executeStep(jsonStep.next);

			// No next step, finalize task
			this.finalize();
		})
		// Step failed, end Task
		.catch(error => {
			stepError.error = error;
			this.failed(stepError);
		})
	}


	//
	// PUBLIC FUNCTIONS
	//

	async start() {
        console.log(`\n*********************************\n**** Task #` + this.id + ` process STARTED ****\n*********************************`);

        await new Promise((resolve, reject) => {
        	// Set main resolve/reject to task to be able to finish process anytime
        	this._resolveTask = resolve;
        	this._rejectTask = reject

        	// Initialize task
        	this._init().then(_ => {
	        	// Start first step
	        	this._executeStep(this._config.firstStep);
        	})
        	.catch(error => {
        		this.failed(error);
        	});
        });
	}

	async failed(error) {
		const duration = this.elapsedTime();
        console.error(`\n**** Process ended - ${duration}ms ****\n\tERROR\n`)
		this._state = this.FAILED;

		// TODO:
		// Logout if needed
		if (this._config.onError)
			this.window.loadURL(this._config.onError);

		if (error) {
			console.error(error);
			console.error('\n\n');
		}
		await api.call({url: '/api/task/'+this._id, body: {r_state: this.FAILED, f_duration: duration}, method: 'put'});

		this._rejectTask();
	}

	async finalize() {
		const duration = this.elapsedTime();
    	console.log(`\n**** Process ended - ${duration}ms ****\n\tSUCCESS\n\n`)
		this._state = this.DONE;
		// Update Task status
		await api.call({url: '/api/task/'+this._id, body: {r_state: this.DONE, f_duration: duration}, method: 'put'});

		this._resolveTask();
	}

	inputUrl(details) {
    	if (!this._step)
    		return console.error("Got url input while no step processing : "+details.url);

    	// Assets loading, dismiss
    	if (details.url.toLowerCase().match(/.*\.(css|js|png|jpg|jpeg|woff)$/) != null)
    		return;
    	if (['dev-tools'].filter(ignore => details.url.includes(ignore)).length > 0)
    		return;

    	console.log(details.method+ '  -  '+details.url)
    	this._step.inputUrl(details);
	}

	elapsedTime() {
		const nanosec_per_sec = 1e9;
		const hrTime = process.hrtime(this._startTime);
		return hrTime[0] * 1000 + hrTime[1] / 1000000;// Convert to milliseconds
	}

	willDownload() {
		if (!this._step) {
			console.error("Trying to download file but there is no step processing");
			return;
		}
		if (!(this._downloading = this._step.downloadInfo)) {
			console.error("Trying to download file but step haven't any download configured")
			return;
		}

		this._downloading.state = 'pending';

		return this._downloading.name;
	}

	downloadState(fileName, state) {
		console.log(`${fileName} - ${state}`);
		if (!this._step)
			return;
		this._step.downloadState(state);
	}

	domReady(isReady = true) {
    	this._domReady = isReady;
    	if (this._step)
	    	this._step.domReady(isReady);
	}
}

module.exports = Task;