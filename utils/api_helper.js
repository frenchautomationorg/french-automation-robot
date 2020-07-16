var request = require('request');
const fs = require('fs-extra');

var defaultOptions = {
	rejectUnauthorized: false,
	json: true,
	headers: {'content-type': 'application/json'}
}
var BEARER_TOKEN = 'fakeInitToken';
var MAX_TOKEN_TRY = 20

var credentials;

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
			return reject("Couldn't get Bearer Token");

		// Add bearer token to url
		callOptions.url = callOptions.originUrl.indexOf('?') != -1 ?
						credentials.back_host + callOptions.originUrl + '&token='+BEARER_TOKEN :
						credentials.back_host + callOptions.originUrl + '?token='+BEARER_TOKEN;

		// callOptions.forever = true;

		if (!request[callOptions.method])
			return reject("Bad method "+callOptions.method+' for API request');

		request[callOptions.method.toLowerCase()](callOptions, function(error, response, body) {
			if (error || response.statusCode == '500')
				return reject(error);

			// Bad or expired Token, refresh token and call again
			if (response.statusCode == '403' || response.statusCode == '401') {
				getToken().then(function() {
					call(callOptions, ++loopCount).then(resolve).catch(reject);
				}).catch(reject);
			}
			else
				resolve({error: error, response: response, body: body});
		});
	});
}

module.exports = {
	call: function (callOptions) {
		return new Promise(function(resolve, reject) {
			if (!credentials) {
				console.error("Can't make API call. No credentials defined");
				return reject();
			}

			// Merge default and provided options
			for (var defaultOpt in defaultOptions)
				if (!callOptions[defaultOpt])
					callOptions[defaultOpt] = defaultOptions[defaultOpt];

			if (!callOptions.method)
				callOptions.method = 'get';
			if (!callOptions.url)
				return reject("No URL for API call");

			callOptions.originUrl = callOptions.url;

			call(callOptions, 0)
			.then(resolve)
			.catch(function(error) {
				console.error(error);
				reject(error);
			});
		});
	},
	upload: function(callOptions) {
		return new Promise(function(resolve,reject) {
			if (!credentials) {
				console.error("Can't make API call. No credentials defined");
				return reject();
			}

			// Merge default and provided options
			for (var defaultOpt in defaultOptions)
				if (!callOptions[defaultOpt])
					callOptions[defaultOpt] = defaultOptions[defaultOpt];

			if (!callOptions.method)
				callOptions.method = 'get';
			if (!callOptions.url)
				return reject("No URL for API call");

			callOptions.originUrl = callOptions.url;
			// Add bearer token to url
			callOptions.url = callOptions.originUrl.indexOf('?') != -1 ?
							credentials.back_host + callOptions.originUrl + '&token='+BEARER_TOKEN :
							credentials.back_host + callOptions.originUrl + '?token='+BEARER_TOKEN;
			var apiReq = request[callOptions.method](callOptions, function(err, resp, body) {
				if (err)
					return reject(err);
				return resolve();
			});
			var apiForm = apiReq.form();
			apiForm.append('file', callOptions.stream);
		});
	},
	token: function() {
		return BEARER_TOKEN;
	},
	credentials: function(reload = false) {
		if (!reload && credentials)
			return credentials;

		// Erase existing credentials
		credentials = null;

		if (!fs.existsSync(__dirname+'/../config/credentials.json'))
			console.error("No credentials file found");
		else {
			// Load credentials file
			try {
				credentials = JSON.parse(fs.readFileSync(__dirname+'/../config/credentials.json'));
			} catch (e) {
				console.error("Error in credentials configuration file");
			}
		}

		return credentials;
	}
}