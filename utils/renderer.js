// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// Dans le processus de rendu (page web).

function testConnection() {
	const { ipcRenderer } = require('electron')
	console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // affiche "pong"
}