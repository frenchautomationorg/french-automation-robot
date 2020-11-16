
class AutomationError extends Error {
    constructor(error) {
        super(error);
        this.code = error.code || this.constructor.name;
    }
}

exports.TaskError = class TaskError extends AutomationError {
    constructor(error) {
        super(error)
        Error.captureStackTrace(this, TaskError)
    }
}

exports.StepError = class StepError extends AutomationError {
    constructor(error) {
        super(error)
        Error.captureStackTrace(this, StepError)
    }
}

exports.ScriptError = class ScriptError extends AutomationError {
    constructor(error) {
        super(error)
        Error.captureStackTrace(this, ScriptError)
    }
}

exports.SequenceError = class SequenceError extends AutomationError {
    constructor(error) {
        super(error)
        Error.captureStackTrace(this, SequenceError)
        if (error.stack)
            this.stack = error.stack;
        if (error.code)
            this.code = error.code;
    }
}

exports.ApiError = class ApiError extends AutomationError {
    constructor(error, response) {
        super(error)
        Error.captureStackTrace(this, ApiError)
        if (response) {
            this.statusCode = response.statusCode;
            this.target = response.request.method+' '+response.request.originUrl;
            delete this.stack;
        }
    }
}

exports.CustomError = class CustomError extends AutomationError {
    constructor(code) {
        super(code);
        this.code = code;
    }
}