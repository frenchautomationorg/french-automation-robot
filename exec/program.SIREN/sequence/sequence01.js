module.exports = {
	execute: (utils) => {
		return new Promise((resolve, reject) => {
			console.log("Sequence sends to API :");
			console.log(utils.sessionData);
			resolve();
		});
	}
};