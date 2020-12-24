var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'French Automation Robot',
  description: 'Node application as Windows Service',
  script: 'C:\\node\\french-automation-robot\\main.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();