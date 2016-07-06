import EventDispatcher from "./event-dispatcher"
import invokeFunction from "../utils/invokeFunction"

const dispatchValues = Symbol("fluxtuateRetainEventDispatcher_values");

export default class RetainEventDispatcher extends EventDispatcher {
    constructor() {
        super();
        this[dispatchValues] = {};
    }

    addListener(eventName, callbackFunction, priority = 0, retain = true) {
        let returnListener = super.addListener(eventName, callbackFunction, priority);

        if(!retain) return returnListener;

        if(this[dispatchValues][eventName])
            invokeFunction(callbackFunction, [eventName, this[dispatchValues][eventName]]);
        
        return returnListener;
    }

    dispatch(eventName, payload) {
        super.dispatch(eventName, payload);
        this[dispatchValues][eventName] = payload;
    }
}