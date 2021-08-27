/** @namespace Errors
 * Error classes thrown by the Robot process
 */

class AutomationError extends Error {
    constructor(error) {
        super(error)
        this.code = error && error.code || this.constructor.name;
    }
}
exports.AutomationError = AutomationError;

exports.RobotError = class RobotError extends AutomationError {
    constructor(error) {
        super(error)
        this.name = this.constructor.name
        Error.captureStackTrace(this, RobotError)
    }
}

exports.TaskError = class TaskError extends AutomationError {
    constructor(error) {
        super(error)
        this.name = this.constructor.name
        Error.captureStackTrace(this, TaskError)
    }
}

exports.StepError = class StepError extends AutomationError {
    constructor(error) {
        super(error)
        this.name = this.constructor.name
        Error.captureStackTrace(this, StepError)
    }
}

exports.ScriptError = class ScriptError extends AutomationError {
    constructor(error) {
        super(error)
        this.name = this.constructor.name
        Error.captureStackTrace(this, ScriptError)
    }
}

exports.SequenceError = class SequenceError extends AutomationError {
    constructor(error) {
        super(error)
        this.name = this.constructor.name
        // Error.captureStackTrace(this, SequenceError)
        if (error.stack)
            this.stack = error.stack;
        if (error.code) {
            this.code = error.code;
        }
    }
}

exports.ApiError = class ApiError extends AutomationError {
    constructor(error, response) {
        super(error)
        this.name = this.constructor.name
        Error.captureStackTrace(this, ApiError)
        if (response) {
            this.statusCode = response.statusCode;
            this.target = response.request.method+' '+response.request.originUrl;
            delete this.stack;
        }
    }
}

exports.ProgramError = class ProgramError extends AutomationError {
    constructor(code, message) {
        super(code);
        this.code = code;
        this.message = message;
    }
}