const api = require('../utils/api_helper');
const unzip = require('unzip-stream');
const fs = require('fs-extra');
const moment = require('moment');

const ScriptStep = require('./script_step');
const SequenceStep = require('./sequence_step');

//const robotjs = require('robotjs');

class Task {
	constructor(task, robot) {
		this._startTime = process.hrtime();
		this._id = task.id;
		this._id_execution = task.id_execution;
		this._state = task.r_state.id;
		this._env = task.f_data_flow;
		this._filesToDownload = [];
		this._robot = robot;
		this._window = robot.window;
		this._sessionData = {};
		this._loggedOut = false;
		this._domReady = false;

		this._logFolder = `${__dirname}/../logs/${moment().format('DDMMYYYY')}`;
		this._logFilePath = `${this._logFolder}/${new Date().getTime()}_task_${task.id}_log.txt`;
	}


	//
	// STATIC
	//

	static get PENDING() {return api.credentials().idPending;}
	static get PROCESSING() {return api.credentials().idProcessing;}
	static get FAILED() {return api.credentials().idFailed;}
	static get DONE() {return api.credentials().idDone;}

	static async fetch(robot) {
		if (robot.id == null)
			return null;

		// Fetch task from API
	    let result = await api.call({url: '/api/task?fk_id_robot_robot=' + robot.id + '&fk_id_status_state='+Task.PENDING+'&include=r_state&limit=1'});

        let tasks = result.body.tasks;

        // No task available
        if (!result.body.tasks || !result.body.tasks.length || result.body.tasks.length == 0)
            return null;

        // Create task instance
        let task = new Task(result.body.tasks[0], robot);

        // Indicate to orchestrator that task is now in process
		await api.call({url: '/api/task/' + task.id, body: {r_state: Task.PROCESSING, f_execution_start_date: new Date()}, method: 'put'});

		task._state = Task.PROCESSING;

		// Instanciate new execution
		let result_execution = await api.call({url: '/api/execution/', body: {f_execution_start_date: new Date(), r_task_execution: task.id}, method: 'post'});
		task.id_execution = result_execution.body.execution.id;

        return task;
	}


	//
	// GETTER/SETTER
	//

	get id() {return this._id}
	get id_execution() {return this._id_execution}
	get robotId() {return this._robot.id}
	get window() {return this._robot.window}
	get state() {return this._state}
	set state(newState) {this._state = newState}
	get logFilePath() {return this._logFilePath}

	set id_execution(id) { this._id_execution = id}

	get sequenceUtils() {
		return {
    		"window": this._robot.window,
    		"robotId": this.robotId,
    		"taskId": this._id,
    		"env": this._env,
    		"sessionData": this._sessionData,
    		"api": api,
    		"waitDownloads": _ => {
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

	log(param) {
		try {
			if (!this._writeStream) {
				fs.ensureDirSync(this._logFolder);
				this._writeStream = fs.createWriteStream(this._logFilePath, {flags: 'a', encoding: 'utf8'});
			}

			// Replacer parameter for JSON.stringify. It correctly prints error stacktrace
			function replaceErrors(key, value) {
			    if (value instanceof Error) {
			        var error = {};
			        Object.getOwnPropertyNames(value).forEach(function (key) {
			            error[key] = value[key];
			        });
			        return error;
			    }
			    return value;
			}

			const toWrite = (typeof param === 'object' || typeof param === 'array' ? JSON.stringify(param, replaceErrors, 4) : param) + '\n';

			console.log(param);
			if (this._writeStream.BaseStream !== null)
				this._writeStream.write(toWrite);
			else console.log("DIDNT NOT WRITE THE ABOVE");
		} catch(err) {
			console.error("Couldn't log to file");
			console.error(err);
			console.log(param);
		}
	}

	async _init() {
		this.log(`\n**** Initialization ****\n`);

		try {
			// Load data
			{
				// Download zip file
				let result = await api.call({url: '/api/task/'+this._id+'/downloadProgram', encoding: null});
				if (result.response.statusCode == 404)
					throw new Error("Task doesn't have a program file");
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
				fs.removeSync('./program_zip.zip');

				// Parse env
				try {
					this._env = this._env && this._env != '' ? JSON.parse(this._env) : {};
				} catch (error) {throw new Error("Task f_data_flow couldn't be parsed\n"+JSON.stringify(error, null, 4));}
				// Parse steps
				try {
					this._config = JSON.parse(fs.readFileSync(`${__dirname}/../exec/program/config.json`))
				} catch (error) {throw new Error("Task config.json couldn't be parsed\n"+JSON.stringify(error, null, 4));}
			}

		} catch (error) {
			this.log(`\tFAILED\n`);
			// Clear task program files
			if (fs.existsSync('./program_zip.zip'))
				fs.removeSync('./program_zip.zip');
			throw error;
		}
		this.log(`\tSUCCESS\n`);
	}

	async _executeSteps(steps, isErrorStep = false) {
		const finalize = !isErrorStep ? _ => {this.finalize()} : _ => {};
		const failed = !isErrorStep ? error => { this.failed(error)} : error => {this.log("onError step failed"); this.log(error); };

		if (!steps || steps.length == 0 || steps.filter(step => !!step).length != steps.length) {
			if (isErrorStep)
				this.log("Invalid onError definition");
			return finalize();
		}

		for (const [stepIdx, jsonStep] of steps.entries()) {
			let stepError = {
				stepIndex: stepIdx,
				step: jsonStep
			};

			if (['action', 'sequence'].indexOf(jsonStep.type) == -1) {
				stepError.error = `Unknown step type ${jsonStep.type}`;
				return failed(stepError);
			}

			// Create, init and execute step
			const stepPromise = new Promise((resolveStep, rejectStep) => {
				const stepDelay = jsonStep.delay || 0;

				setTimeout(_ => {
			        this.log(`Executing ${isErrorStep ? "onError step" : "step"} ${jsonStep.name || stepIdx+1}:`);
			        this.log(JSON.stringify(jsonStep, null, 4));

					// Create step
					if (jsonStep.type == 'action')
						this._step = new ScriptStep(resolveStep, rejectStep, jsonStep, this.window, this.sequenceUtils, this._domReady);
					else if (jsonStep.type == 'sequence')
						this._step = new SequenceStep(resolveStep, rejectStep, jsonStep, this.window, this.sequenceUtils, this._domReady);

					// Initialize and execute step
					this._step.init(this._env).then(_ => {
						this._step.execute()
					})
					.catch(rejectStep);
				}, stepDelay);
			});

			try {
				// await step execution
				const data = await stepPromise;

				// If step extracted data, merge with Task sessionData
				if (data)
					this._sessionData = {...this._sessionData, ...data};

				// If step ended with an URL, set dom not ready. It will be set back to ready through electron 'dom-ready' event
				if (this._step._endWith)
					this.domReady(false);
			} catch (error) {
				stepError.error = error;
				return failed(stepError);
			}
		}

		finalize();
	}


	//
	// PUBLIC FUNCTIONS
	//

	async start() {
        this.log(`\n*********************************\n**** Task #` + this.id + ` process STARTED ****\n*********************************`);

        await new Promise((resolve) => {
        	// Set main resolve to task to be able to finish process anytime
        	this._resolveTask = resolve;

        	// Initialize task
        	this._init().then(_ => {
	        	// Start first step
	        	this._executeSteps(this._config.steps);
        	})
        	.catch(error => {
        		this.log(error);
        		this._resolveTask();
        	});
        });
	}

	async failed(error) {
		// Execute error steps if defined
		if (this._config.onError !== undefined) {
			this.log("\n**** Task failed - Starting onError process ****\n");
			const errorSteps = typeof this._config.onError === 'array'
					? this._config.onError
					: typeof this._config.onError === 'object'
						? [this._config.onError]
						: [this._config.steps[this._config.onError]];

			// Assuming there is only one error step to proceed, we must send an array with this step 
			function findElement(arr, propName, propValue) {
				for (var i=0; i < arr.length; i++)
				if (arr[i][propName] == propValue)
				return arr[i];
			}

			let lastSteps = [];
			lastSteps.push(findElement(this._config.steps, "name", errorSteps));
			
			await this._executeSteps(lastSteps, true);
		}

		const duration = this.elapsedTime();
		this._state = Task.FAILED;
		await api.call({url: '/api/task/'+this._id, body: {r_state: Task.FAILED, f_execution_finish_date: new Date(), f_duration: duration}, method: 'put'});

        this.log(`\n**** Process ended - ${duration}ms ****\n\tERROR\n`)
		if (error) {
			this.log(error);
			this.log('\n\n');
		}

		// Update Execution state
		await api.call({url: '/api/execution/'+this._id_execution, body: {f_state: "ERROR", f_error_cause: error.error, f_execution_finish_date: new Date()}, method: 'put'});

		this._resolveTask();
	}

	async finalize() {
		const duration = this.elapsedTime();
    	this.log(`\n**** Process ended - ${duration}ms ****\n\tSUCCESS\n\n`)

    	if (Object.keys(this._sessionData).length)
    		this.log(JSON.stringify(this._sessionData, null, 4));
		this._state = Task.DONE;
		// Update Task status
		await api.call({url: '/api/task/'+this._id, body: {r_state: Task.DONE, f_execution_finish_date: new Date(), f_duration: duration}, method: 'put'});

		// Update Execution state
		await api.call({url: '/api/execution/'+this._id_execution, body: {f_state: "SUCCESS", f_execution_finish_date: new Date()}, method: 'put'});

		this._resolveTask();
	}


	sendLogFile() {
		return new Promise((resolve, reject) => {
			if (!this._writeStream)
				return resolve();
			this._writeStream.on('finish', async _ => {
				try {
					await api.upload({
						url: '/api/task/'+this._id+'/logfile',
						method: 'post',
						stream: fs.createReadStream(this._logFilePath)
					});
					// fs.unlinkSync(this._logFilePath);

				} catch(err) {
					console.error("Couldn't send error file "+this._logFilePath);
					console.error(err);
				}
				resolve();
			});
			this._writeStream.close();
		});
	}

	inputUrl(details) {
    	if (!this._step)
    		return log("Got url input while no step processing : "+details.url);

    	// Assets loading, dismiss
    	if (details.url.toLowerCase().match(/.*\.(css|js|png|jpg|jpeg|woff)$/) != null)
    		return;
    	if (['dev-tools'].filter(ignore => details.url.includes(ignore)).length > 0)
    		return;

    	// this.log("Task.inputUrl() : "+details.method+ '  -  '+details.url)
    	this._step.inputUrl(details);
	}

	elapsedTime() {
		const nanosec_per_sec = 1e9;
		const hrTime = process.hrtime(this._startTime);
		return hrTime[0] * 1000 + hrTime[1] / 1000000;// Convert to milliseconds
	}

	willDownload() {
		if (!this._step) {
			this.log("Trying to download file but there is no step processing");
			return;
		}
		if (!(this._downloading = this._step.downloadInfo)) {
			this.log("Trying to download file but step haven't any download configured")
			return;
		}

		this._downloading.state = 'pending';

		return this._downloading.name;
	}

	downloadState(fileName, state) {
		this.log(`${fileName} - ${state}`);
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
