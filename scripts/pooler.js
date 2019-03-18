var api_call = require('../utils/api_helper');


api_call.call({url: '/api/task?fk_id_robot_robot=' + credentials.id + '&fk_id_status_state=2'}).then(function(tasks) {

	if (tasks != null) {
		if (tasks.body.tasks.length > 0) {

			// Indicate to orchestrator, task in now in process
			var task = tasks.body.tasks[0];
			task.r_state = 4;

			api_call.call({url: '/api/task/' + task.id, body: task, method: 'put'}).then(function(task) {
				process.stdout.write(JSON.stringify(task));
			});
		}
		else {
			process.stderr.write("No task found");
		}
	}
	else {
		process.stderr.write("API Call failed");
	}

}).catch(function(error) {
  process.stderr.write(error);
  console.log(error);
});




