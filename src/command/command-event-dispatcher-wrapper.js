import {command} from "./_internals"
import EventDispatcherWrapper from "../event-dispatcher/event-dispatcher-wrapper"

export default class CommandEventDispatcherWrapper extends EventDispatcherWrapper {
    constructor(eventDispatcher, holderContext, holderCommand) {
        super(eventDispatcher, holderContext, holderCommand);
        this[command] = holderCommand;
    }
    
    get command() {
        return this[command];
    }
}