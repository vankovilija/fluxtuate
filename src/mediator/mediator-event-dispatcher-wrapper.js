import {mediator} from "./_internals"
import EventDispatcherWrapper from "../event-dispatcher/event-dispatcher-wrapper"

export default class MediatorEventDispatcherWrapper extends EventDispatcherWrapper {
    constructor(eventDispatcher, holderContext, holderMediator) {
        super(eventDispatcher, holderContext, holderMediator);
        this[mediator] = holderMediator;
    }
    
    get mediator() {
        return this[mediator];
    }
}