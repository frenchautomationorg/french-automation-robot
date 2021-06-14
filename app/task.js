const electron = require('electron')
const app = electron.app;
const api = require('../utils/api_helper');
const unzip = require('unzip-stream');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');

const ScriptStep = require('./script_step');
const SequenceStep = require('./sequence_step');

const { StepError, SequenceError, TaskError, CustomError } = require('./errors');

// const robotjs = require('robotjs');

class Task {
	constructor(task, robot) {
		this._startTime = process.hrtime();
		this._id = task.id;
		this._executionId = task.id_execution;
		this._state = task.r_state.id;
		this._env = task.f_data_flow;
		this._robot = robot;
		this._sessionData = {};
		this._loggedOut = false;
		this._domReady = false;
		this._downloads = [];

		// this._logFolder = `${__dirname}/../logs/${moment().format('DDMMYYYY')}`;
		if (!fs.existsSync(app.getPath("logs") + `/${moment().format('DDMMYYYY')}`)) {
			fs.mkdirSync(app.getPath("logs") + `/${moment().format('DDMMYYYY')}`);
		}
		this._logFolder = app.getPath("logs") + `/${moment().format('DDMMYYYY')}`;
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
		task._executionId = result_execution.body.execution.id;

		return task;
	}


	//
	// GETTER/SETTER
	//

	get id() {return this._id}
	get executionId() {return this._executionId}
	get robotId() {return this._robot.id}
	get window() {return this._robot._window}
	get state() {return this._state}
	set state(newState) {this._state = newState}
	get logFilePath() {return this._logFilePath}

	set executionId(id) { this._executionId = id}
	set window(win) { this._window = win}

	get snippetUtils() {
		return {
			window: this.window,
			robotId: this.robotId,
			taskId: this.id,
			env: this._env,
			sessionData: this._sessionData,
			api: api,
			error: code => {
				throw new CustomError(code);
			},
			download: url => {
				this.window.webContents.downloadURL(url);
			},
			waitDownloads: async _ => {
				await Promise.allSettled(this._downloads.map(dl => dl.promise));
				return this._downloads;
			},
			upload: async (url, filePath) => {
				if (!filePath)
					throw new SequenceError("Missing fileInfo to upload file");
				if (!fs.existsSync(filePath))
					throw new SequenceError("File not found "+filePath);

				const stream = fs.createReadStream(filePath, 'utf8');
				await api.upload({
					url,
					stream
				});
			}
		}
	}

	//
	// PRIVATE FUNCTIONS
	//

	elapsedTime() {
		const nanosec_per_sec = 1e9;
		const hrTime = process.hrtime(this._startTime);
		return hrTime[0] * 1000 + hrTime[1] / 1000000;// Convert to milliseconds
	}

	log(param) {
		try {
			if (!this._writeStream) {
				fs.ensureDirSync(this._logFolder);
				this._writeStream = fs.createWriteStream(this._logFilePath, {flags: 'a', encoding: 'utf8'});
			}

			// Replacer parameter for JSON.stringify. It correctly prints error stacktrace
			function replaceErrors(key, value) {
				if (value instanceof Error) {
					const error = {name: value.name};
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
		} catch(err) {
			console.error("Couldn't log to file");
			console.error(err);
			console.log(param);
		}
	}

	sendLogFile() {
		return new Promise(resolve => {
			if (!this._writeStream)
				return resolve();
			this._writeStream.on('finish', async _ => {
				try {
					await api.upload({
						url: '/api/execution/'+this._executionId+'/logfile', method: 'post',
						stream: fs.createReadStream(this._logFilePath)
					});
				} catch(err) {
					console.error("Couldn't send error file "+this._logFilePath);
					console.error(err);
				}
				resolve();
			});
			this._writeStream.close();
		});
	}

	async init() {
		this.log(`\n**** Initialization ****\n`);

		try {
			// Download zip file
			let result = await api.call({url: '/api/task/'+this._id+'/downloadProgram', encoding: null});
			if (result.response.statusCode == 404)
				throw new TaskError("Task doesn't have a program file");
			fs.writeFileSync('./program_zip.zip', result.body);

			// Clear previous task program files
			/* if (fs.existsSync('./exec/program'))
				fs.removeSync('./exec/program'); */
			if (fs.existsSync(app.getPath("temp") + `/exec/program`))
				fs.removeSync(app.getPath("temp") + `/exec/program`);

			// Unzip program folder
			await new Promise((resolve, reject) => {
				fs.createReadStream('./program_zip.zip')
					.pipe(unzip.Extract({
						path: app.getPath("temp") + '/exec/program'
					}))
					.on('close', resolve)
					.on('error', reject);
			});
			// Delete downloaded zip
			fs.removeSync('./program_zip.zip');

			// Parse env
			try {
				this._env = this._env && this._env != '' ? JSON.parse(this._env) : {};
			} catch (error) {throw new TaskError("Task f_data_flow couldn't be parsed\n"+JSON.stringify(error, null, 4));}
			// Parse steps
			try {
				this._config = JSON.parse(fs.readFileSync(app.getPath("temp") + `/exec/program/config.json`));
			} catch (error) {throw new TaskError("Task config.json couldn't be parsed\n"+JSON.stringify(error, null, 4));}

		} catch (error) {
			this.log(`\tFAILED\n`);
			// Clear task program files
			/*if (fs.existsSync('./program_zip.zip'))
				fs.removeSync('./program_zip.zip'); */
			if (fs.existsSync(app.getPath("temp") + '/exec/program_zip.zip'))
				fs.removeSync(app.getPath("temp") + '/exec/program_zip.zip');
			throw error;
		}
		this.log(`\tSUCCESS\n`);
	}

	async executeSteps(steps, isErrorStep = false) {
		if (!steps || steps.length == 0 || steps.filter(step => !!step).length != steps.length) {
			if (isErrorStep)
				this.log("Invalid onError definition");
			return;
		}

		let stepIdx = 0;
		let l = steps.length;
		while (stepIdx < l) {

			let jsonStep = steps[stepIdx];

			let stepError = {
				stepIndex: stepIdx,
				step: jsonStep
			};

			if (['action', 'sequence'].indexOf(jsonStep.type) == -1) {
				stepError.error = new StepError(`Unknown step type ${jsonStep.type}`);
				throw stepError;
			}

			// Create, init and execute step
			const stepPromise = new Promise((resolveStep, rejectStep) => {
				const stepDelay = jsonStep.delay || 0;

				setTimeout(async _ => {
					this.log(`Executing ${isErrorStep ? "onError step" : "step"} ${jsonStep.name || stepIdx+1}:`);
					this.log(JSON.stringify(jsonStep, null, 4));

					// If first step is a sequence, don't wait for domReady event to execute
					if (stepIdx == 0 && jsonStep.type == 'sequence')
						this._domReady = true;
					// Provide promise resolve/reject to step so it can end task process at any time
					const stepParams = {resolveStep, rejectStep, jsonStep, win: this.window, utils: this.snippetUtils, isDomReady: this._domReady};
					// Create step
					if (jsonStep.type == 'action')
						this._step = new ScriptStep(stepParams);
					else if (jsonStep.type == 'sequence')
						this._step = new SequenceStep(stepParams);

					// Send stepData in context
					let stepData = {
						stepIdx: stepIdx,
						serialNumber: stepIdx +1
					};

					// Initialize and execute step
					await this._step.init(this._env, stepData);
					// execute() can't be awaited because it depends on step's resolveStep/rejectStep
					this._step.execute();
				}, stepDelay);
			});

			try {
				// await step execution
				const data = await stepPromise;

				// If step extracted data, merge with Task sessionData
				if (data)
					this._sessionData = {...this._sessionData, ...data};

				// GoTo stepIdx
				if (this._sessionData.goToStep && this._config.steps[this._sessionData.goToStep - 1]) {

					// Using serial number of step to reach index in array
					stepIdx = this._sessionData.goToStep - 1;
					delete this._sessionData.goToStep;
				}
				else {

					// Go ahead
					stepIdx = stepIdx + 1;
				}

			} catch (error) {
				stepError.error = error;
				throw stepError;
			}
		}
	}

	async executeErrorSteps() {
		// Execute error steps if defined
		if (this._config.onError !== undefined) {
			try {
				this.log("\n**** Task failed - Starting onError process ****\n");
				const self = this;
				function stepFromType(errorStep) {
					let matchedStep;
					if (typeof errorStep === 'string') {
						let referencedError = self._config._steps.filter(step => step.name === errorStep);
						matchedStep = referencedError.length ? referencedError[0] : null;
					}
					else if (typeof errorStep === 'object')
						matchedStep = errorStep;
					else if (!isNaN(errorStep))
						matchedStep = self._config._steps[errorStep];
					return matchedStep;
				}

				const errorSteps = [];
				if (this._config.onError instanceof Array) {
					for (const errorStep of this._config.onError)
						errorSteps.push(stepFromType(errorStep))
				}
				else
					errorSteps.push(stepFromType(this._config.onError));

				await this.executeSteps(errorSteps, true);

			} catch(err) {
				this.log("onError step failed");
				this.log(err);
			}
		}
	}

	async failed(error) {
		try {
			const duration = this.elapsedTime();

			this.log(`\n**** Process ended - ${duration}ms ****\n\tERROR\n`);
			if (error) {
				this.log(error);
				this.log('\n\n');
			}

			this._state = Task.FAILED;
			await api.call({
				url: '/api/task/'+this._id, method: 'put',
				body: {r_state: Task.FAILED,f_execution_finish_date: new Date(),f_duration: duration}
			});
			await api.call({
				url: '/api/execution/'+this._executionId, method: 'put',
				body: {f_state: "ERROR",f_execution_finish_date: new Date(), f_error_cause: (error && error.code) || (error.error && error.error.code) || ""}
			});
		} catch(err) {
			this.log("Unable to update task's status in `failed()`");
			this.log(err);
		}
	}

	async finalize() {
		try {
			const duration = this.elapsedTime();
			this.log(`\n**** Process ended - ${duration}ms ****\n\tSUCCESS\n\n`)

			if (Object.keys(this._sessionData).length)
				this.log(JSON.stringify(this._sessionData, null, 4));

			this._state = Task.DONE;
			// Update Task status
			await api.call({
				url: '/api/task/'+this._id, method: 'put',
				body: {r_state: Task.DONE, f_execution_finish_date: new Date(), f_duration: duration}
			});
			// Update Execution state
			await api.call({
				url: '/api/execution/'+this._executionId, method: 'put',
				body: {f_state: "SUCCESS", f_execution_finish_date: new Date()}
			});
		} catch(err) {
			this.log("Unable to update task's status in `finalize()`");
			this.log(err);
		}
	}

	//
	// PUBLIC FUNCTIONS
	//

	async start() {
		try {
			await new Promise((resolve, reject) => {
				this.log(`\n*********************************\n**** Task #` + this.id + ` process STARTED ****\n*********************************`);
				this.resolve = resolve;
				this.reject = reject;

				(async _ => {
					// Initialize task
					await this.init();
					try {
						// Execute steps array
						await this.executeSteps(this._config.steps);

					} catch(stepError) {
						// Execute onError and re-throw so `failed()` is executed
						await this.executeErrorSteps();
						throw stepError;
					}

					await this.finalize();
				})().then(resolve).catch(reject);
			});
		} catch(err) {
			await this.failed(err);
		} finally {
			await this.sendLogFile();
		}
	}

	stop(error) {
		for (const download of this._downloads) {
			if (download.state == 'pending')
				download.fileItem.cancel();
		}
		return this.reject && this.reject(error);
	}

	inputUrl(details) {
		if (!this._step)
			return this.log("Got url input while no step processing : "+details.url);

		// Assets loading, dismiss
		if (details.url.toLowerCase().match(/.*\.(css|js|png|jpg|jpeg|woff)$/) != null)
			return;
		if (['dev-tools'].filter(ignore => details.url.includes(ignore)).length > 0)
			return;

		// this.log("Task.inputUrl() : "+details.method+ '  -  '+details.url)
		this._step.inputUrl(details);
	}

	willDownload(fileItem) {
		let fileName;
		if (!this._step)
			this.log("WARN: Trying to download file but there is no step processing");
		else if (this._step.download && this._step.download.filename)
			fileName = this._step.download.filename;
		if (!fileName)
			fileName = fileItem.getFilename();

		const filePath = path.resolve(app.getPath("appData") + `/french-automation-robot/exec/downloads/${fileName}`);
		const download = {
			state: 'initialized',
			fileName,
			filePath,
			fileItem
		};
		fileItem.setSavePath(filePath);

		download.promise = new Promise((resolve, reject) => {
			fileItem.on('updated', (event, state) => {
				download.state = 'pending';
				if (state === 'interrupted')
					download.state = 'interrupted';
				else if (state === 'progressing')
					download.state = fileItem.isPaused() ? 'paused' : 'progressing';
			});
			fileItem.once('done', (event, state) => {
				if (state === 'completed') {
					this.log(`Download SUCCESS for file ${fileName}`)
					download.state = 'success';
					resolve();
				}
				else {
					this.log(`Download FAILED for file ${fileName} - ${state}`)
					download.state = 'error';
					reject();
				}
			});
		});

		this._downloads.push(download);
	}

	domReady(isReady = true) {
		this._domReady = isReady;
		if (this._step)
			this._step.domReady(isReady);
	}
}

module.exports = Task;
