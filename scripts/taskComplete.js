var api_call = require('../utils/api_helper');
const argv = require('minimist')(process.argv.slice(2));


console.log(argv["id"]);

api_call.call({url: '/api/task/' + argv["id"]}).then(function(task) {

	if (task != null) {

		// Indicate to orchestrator, task in now complete
		task.r_state = 5;

		api_call.call({url: '/api/task/' + argv["id"], body: task, method: 'put'}).then(function(task) {
			process.stdout.write(JSON.stringify(task));
		});

	}
	else {
		process.stderr.write("No task found");
	}

}).catch(function(error) {
  process.stderr.write(error);
  console.log(error);
});




