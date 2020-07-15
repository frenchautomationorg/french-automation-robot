const { ipcRenderer } = require('electron');

function load(page) {
	const json = {
		method: 'get',
		page
	}
	return ipcRenderer.sendSync('synchronous-message', json)
}

function send(action, options = {}) {
	const json = {
		method: 'post',
		action,
		...options
	}
	return ipcRenderer.sendSync('synchronous-message', json)
}

module.exports = {
	load,
	send
}