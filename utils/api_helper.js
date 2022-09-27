/** @module api_helper */
const request = require('request');
const fs = require('fs-extra');
const { ApiError } = require('../app/errors');
const electron = require('electron')
const app = electron.app;

const defaultOptions = {
	rejectUnauthorized: false,
	json: true,
	headers: {'content-type': 'application/json'}
}
let BEARER_TOKEN = 'fakeInitToken';
const MAX_TOKEN_TRY = 5;

let credentials;

function getToken() {
	return new Promise(function(resolve, reject) {
		request({
			url: credentials.back_host + '/api/getToken',
			forever:true,
			headers: {
				Authorization: 'Basic ' + new Buffer(credentials.clientKey + ':' + credentials.clientSecret).toString('base64')
			}
		}, function(error, response, body) {
			if (error)
				return reject(error);
			try {
				BEARER_TOKEN = JSON.parse(body).token;
			} catch(e) {
				return reject(e)
			}
			resolve();
		});
	});
}

function call(callOptions, loopCount) {
	return new Promise(function(resolve, reject) {
		if (loopCount >= MAX_TOKEN_TRY)
			return reject(new ApiError("Couldn't get Bearer Token"));

		// Add bearer token to url
		callOptions.url = callOptions.originUrl.indexOf('?') != -1 ?
						credentials.back_host + callOptions.originUrl + '&token='+BEARER_TOKEN :
						credentials.back_host + callOptions.originUrl + '?token='+BEARER_TOKEN;

		// callOptions.forever = true;

		if (!request[callOptions.method])
			return reject(new ApiError("Bad method "+callOptions.method+' for API request'));

		request[callOptions.method.toLowerCase()](callOptions, function(error, response, body) {
			if (error)
				return reject(new ApiError(error));
			if (![200, 302, 401, 403].includes(response.statusCode)) {
				return reject(new ApiError(response.statusMessage, response));
			}

			// Bad or expired Token, refresh token and call again
			if (response.statusCode == '403' || response.statusCode == '401') {
				getToken().then(function() {
					call(callOptions, ++loopCount).then(resolve).catch(reject);
				}).catch(err => {
					reject(new ApiError(err));
				});
			}
			else
				resolve({error: error, response: response, body: body});
		});
	});
}

module.exports = {
	/** Execute an HTTP call to the API<br>
	 * It will handle API authentication token generation / refresh and build the request's header
	 * @param {Object} callOptions - API call options. See requestjs for details
	 */
	call: async (callOptions) => {
		if (!credentials) {
			throw new ApiError("Can't make API call. No credentials defined");
		}

		// Merge default and provided options
		for (var defaultOpt in defaultOptions)
			if (!callOptions[defaultOpt])
				callOptions[defaultOpt] = defaultOptions[defaultOpt];

		if (!callOptions.method)
			callOptions.method = 'get';
		if (!callOptions.url)
			throw new ApiError("No URL for API call");

		callOptions.originUrl = callOptions.url;

		return await call(callOptions, 0);
	},
	/** Upload a file to the API<br>
	 * Takes the same parameter as {@link module:api_helper.call api_helper.call()} with a stream property of the file's readstream
	 * @param {Object} callOptions - API call options. See requestjs for details
	 */
	upload: function(callOptions) {
		return new Promise(function(resolve,reject) {
			if (!credentials)
				return reject(new ApiError("Can't make API call. No credentials defined"));

			// Merge default and provided options
			for (var defaultOpt in defaultOptions)
				if (!callOptions[defaultOpt])
					callOptions[defaultOpt] = defaultOptions[defaultOpt];

			if (!callOptions.method)
				callOptions.method = 'get';
			if (!callOptions.url)
				return reject(new ApiError("No URL for API call"));

			callOptions.originUrl = callOptions.url;
			// Add bearer token to url
			callOptions.url = callOptions.originUrl.indexOf('?') != -1 ?
							credentials.back_host + callOptions.originUrl + '&token='+BEARER_TOKEN :
							credentials.back_host + callOptions.originUrl + '?token='+BEARER_TOKEN;
			var apiReq = request[callOptions.method](callOptions, function(err, resp, body) {
				if (err)
					return reject(new ApiError(err));
				return resolve();
			});
			var apiForm = apiReq.form();
			apiForm.append('file', callOptions.stream);
		});
	},
	map: function (myEntity, myField, myValue, myTargetField) {
		return new Promise(function(resolve, reject) {
			if (!credentials)
				return reject(new ApiError("Can't make API call. No credentials defined"));

			let callOptions = {};

			callOptions.url = '/api/' + myEntity + '/?' + myField + '=' + myValue;
			callOptions.method = 'get';


			// Merge default and provided options
			for (var defaultOpt in defaultOptions)
				if (!callOptions[defaultOpt])
					callOptions[defaultOpt] = defaultOptions[defaultOpt];

			if (!callOptions.method)
				callOptions.method = 'get';
			if (!callOptions.url)
				return reject(new ApiError("No URL for API call"));

			callOptions.originUrl = callOptions.url;

			call(callOptions, 0)
			.then(function (data) {
				if (!data) {
					resolve();
				}
				else {
					console.log(data.response.body);
					// resolve(data.response.body[myEntity + 's'][0][myTargetField]);
					resolve(data.response.body[myEntity][0][myTargetField]);
				}
			})
			.catch(function(error) {
				reject(new ApiError(error));
			});
		});
	},
	/** Current API bearer token */
	token: function() {
		return BEARER_TOKEN;
	},
	/** Get credentials set in the configuration page of French Automation<br>
	 * @param {bool} reload - Whether to reload the credentials from file before returning
	 */
	credentials: function(reload = false) {
		if (!reload && credentials)
			return credentials;

		// Erase existing credentials
		credentials = null;

		if (!fs.existsSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json'))
			console.error("No credentials file found");
		else {
			// Load credentials file
			try {
				credentials = JSON.parse(fs.readFileSync(app.getPath("appData") + '/french-automation-robot/config/credentials.json'));
			} catch (e) {
				console.error("Error in credentials configuration file");
			}
		}

		return credentials;
	}
}