import EventDispatcher from "./event-dispatcher"

const context = Symbol("fluxtuateEventDispatcher_ContextEventDispatcher");

export default class ContextEventDispatcher extends EventDispatcher {
    constructor(currentContext) {
        super();
        this[context] = currentContext;
    }
    
    get context() {
        return this[context];
    }
}