# French Automation Robot
RPA Open Source French Automation

## Overview
French Automation is an Open Source RPA / RDA software suite based on :
<ul>
  <li>Newmips NodeJS development Studio : https://www.newmips.com/</li>
  <li>A web-based application called Orchestrator that manages Business activities and dispatches automated tasks between connected Robots</li>
  <li>An ElectronJS Robot that executes tasks on user desktop or remotely</li>
</ul>
<p> More details can be found on the official website : <a href="https://www.frenchautomation.com/" target="_blank" rel="nofollow">https://www.frenchautomation.com/</a></p>

<br/>

## Screenshot
<p><img src="https://www.frenchautomation.com/img/robot_electron.png" width="75%" /></p>

<br/>

## Installation
<p>Please refer to installation instructions and prerequisites on our Website : <a href="https://www.frenchautomation.com/default/robot" rel="nofollow">https://www.frenchautomation.com/default/robot</a></p>

<p>Clone repository :</p>
<pre><code>git clone git@github.com:frenchautomationorg/french-automation-robot.git</code></pre>

<p>Install modules and run application logged as "root" :</p>
<pre><code>sudo npm install -g electron --unsafe-perm=true --allow-root<br/>
sudo npm i<br/>
sudo npm i electron-rebuild --save<br/>
sudo ./node_modules/.bin/electron-rebuild</code></pre>

<br/>
<br/>
Once installed, simply execute:
<pre><code>electron .</code></pre>



## Usage

French Automation depends on a newmips application, follow the tutorial to know the prerequisites and how to initialize a configured application : <a href="https://www.frenchautomation.com/default/tutorial" rel="nofollow">https://www.frenchautomation.com/default/tutorial</a>
<br>
We're going to see how it works and how to build a program file for your newmips Task.

### Fetch Task

Once the robot is started and running, it will query the API every 5 secondes and check for pending tasks assigned to this robot :

<pre>
GET '[HOST]/api/task?fk_id_robot_robot=[ROBOT_ID]&fk_id_status_state=[PENDING_ID]&include=r_state&limit=1'
</pre>

`[HOST]`, `[ROBOT_ID]` and `[PENDING_ID]` are defined using configuration page.

It will download and unzip the task's program files.


### Task configuration

Task's zip file is expected to have a `config.json` file for the Task to run.

<pre>
{
  "steps": [
      ....
    ],
    "onError": ...
}
</pre>

`config.json` must be placed at zip's root directory

<pre>
program.zip/
 - config.json
 - sessionScripts/
   - login.js
   - logout.js
 - fetchData.js
</pre>


#### steps
JSON configuration must provide a `steps` array containing each steps of this Task. The order of the array will define order of execution.

<br>
Each of the following step properties are optionnal and will be executed in the following order if found :
<ul>

<li>startWith</li>
Providing a startWith object will start the execution of the step by loading the provided url :
<pre>
{
  "url": "https://target-website/login",
    "method": "GET"
}
</pre>

<li>snippet</li>
A path to a javascript file to execute on the currently loaded page. Root dir is the unzipped Task's program file
<br>
Depending on the step's `type` value, it is executed as javascript on the frontend or nodejs on backend
<pre>
"snippet": "script/fill_and_submit_login_form.js"
</pre>

<br>
<li>download</li>

Triggers a download
<pre>
{
  "url": "https://target-website/download",
  "method": "get",
  "name": "stepfile.pdf"
}
</pre>

<li>endWith</li>
Providing a endWith object will wait for the provided url to end the ongoing step :
<pre>
{
  "url": "https://target-website/logout",
  "method": "POST"
}
</pre>
</ul>
<br>
Steps require the property `type` to define the type of script it will execute. Two types are possible, 'action' and 'sequence'.
<br>

##### Step type 'action'

An `'action'` step is a frontend script. It expects a javascript file that will be executed on the currently loaded page.
<br>
The script is expected to return a promise. This promise result will be added to the step sessionData object
<br>
Example :
<pre>
  (_ => {
    return new Promise((resolve, reject) => {
      setTimeout(function() {
        resolve({inputValue: $("#data").text()});
      })
    })
  })().then(results => results);
</pre>

##### Step type 'sequence'

A `'sequence'` step is a nodejs script. Its `snippet` property will be executed as a nodejs module and must export a function `execute(utils)`.

The parameter `utils` sent to `execute(utils)` contains :

<pre>
{
  "window": {} // The electron `BrowserWindow` object in use
  "robotId": int // Running robot ID
  "taskId": int // Current Task id
  "env": {} // The Task's `f_data_flow` field, filled through Media Task and parsed to JSON
  "sessionData": {} // Object filled through script steps
  "api": { // Functions to use API connection
      "call": function(options) // Send a request, options should match `requestjs` requirements
      "upload": function(options) // Same as `call()` but using `options.stream` property to stream a file
      "map": function(options) // Map values according to configuration entities in orchestrator
    }
  "waitDownloads": async function() // Return a promise that resolve when all downloads are done
}
</pre>
<br>

##### Step optional properties

<table>
  <tbody>
    <tr>
      <td>timeout</td>
      <td>A timeout in milliseconds that will trigger step failure</td>
    </tr>
    <tr>
      <td>delay</td>
      <td>A delay in milliseconds that will delay step execution</td>
    </tr>
    <tr>
      <td>name</td>
      <td>The step name. Only used for config.json and logs readability</td>
    </tr>
  </tbody>
</table>

#### onError

`config.json` can provide `onError` property that will be executed if the task encounter an error. It can be useful to reset changes, logout or whatever is needed before finishing the task.

`onError` can be defined in 3 ways :

<ul>
<li>An index of a step from the steps array</li>
<li>A step object</li>
<li>An array of step objects</li>
</ul>


## Contribute
We encourage you to contribute to French Automation software suite.
<ul>
  <li>Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet</li>
  <li>Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it</li>
  <li>Fork the project</li>
  <li>Start a feature/bugfix branch</li>
  <li>Commit and push until you are happy with your contribution</li>
  <li>Make sure to add tests for it. This is important so we don't break it in a future version unintentionally.</li>
  <li>Please try not to mess with the branches, versions, or history. If you want to have your own version, or is otherwise necessary, that is fine, but please isolate to its own commit so we can cherry-pick around it.</li>
 </ul>


<br/>

## See also
<ul>
  <li><a href="https://www.frenchautomation.com/default/concepts" target="_blank">Concepts</a></li>
  <li><a href="https://www.frenchautomation.com/default/rpa" target="_blank">Methodology</a></li>
  <li><a href="https://www.frenchautomation.com/default/overview" target="_blank">Architecture</a></li>
  <li><a href="https://www.frenchautomation.com/default/tutorial" target="_blank">Tutorial</a></li>
  <li><a href="https://docs.frenchautomation.com/" target="_blank">Documentation</a></li>
</ul>

<br/>

## Licenses
French Automation is released under the [GNU General Public License version 3](http://opensource.org/licenses/GPL-3.0) license.

