import invokeFunction from "../utils/invokeFunction"
import {destroy, pause, resume, eventMap, sendEvent, propagateToParent, propagateToChildren, eventDispatchCallback} from "./_internals"

const isPaused = Symbol("fluxtuateEventDispatcher_isPaused");
const children = Symbol("fluxtuateEventDispatcher_children");
const parent = Symbol("fluxtuateEventDispatcher_parent");

function sortEvents(event1, event2) {
    if(event1.priority > event2.priority)
        return -1;
    else if(event2.priority > event1.priority)
        return 1;
    else
        return 0;
}

export default class EventDispatcher {
    constructor() {
        this[eventDispatchCallback] = null;
        this[eventMap] = {};
        this[isPaused] = false;
        this[children] = [];
        
        this[pause] = () => {
            this[isPaused] = true;
        };

        this[resume] = () => {
            this[isPaused] = false;
        };
        
        this[destroy] = () => {
            let cs = this[children].slice();
            cs.forEach(e=>{
                e[destroy]();
            });
            this[children] = [];
            this[parent] = undefined;
            this[eventMap] = {};
        };

        this[propagateToParent] = (event, payload, eventMetaData) => {
            setTimeout(()=>{
                if(!eventMetaData.shouldPropagate || !eventMetaData.shouldImmediatelyPropagate) {
                    return;
                }
                if(this[parent]){
                    this[parent][sendEvent](Object.assign({}, event, {currentTarget: this[parent]}), payload, eventMetaData);
                    if(this[parent])
                        this[parent][propagateToParent](event, payload, eventMetaData);
                }
            },0);
        };

        this[propagateToChildren] = (event, payload, eventMetaData) => {
            setTimeout(()=>{
                if(this[children] && this[children].length > 0){
                    for(let i = 0; i < this[children].length; i++){
                        if(!eventMetaData.shouldPropagate || !eventMetaData.shouldImmediatelyPropagate) {
                            break;
                        }
                        let c = this[children][i];
                        c[sendEvent](Object.assign({}, event, {currentTarget: c}), payload, eventMetaData);
                        c[propagateToChildren](event, payload, eventMetaData);
                    }
                }
            },0);
        };

        this[sendEvent] = (event, payload, eventMetaData) => {
            let eventList = this[eventMap][event.eventName];
            if(!eventList) return;

            if(this[eventDispatchCallback]) {
                this[eventDispatchCallback](event, payload, eventMetaData);
            }

            eventList = eventList.slice();

            eventList = eventList.sort(sortEvents);

            for(let i = 0; i < eventList.length; i++){
                if(!eventMetaData.shouldImmediatelyPropagate) {
                    break;
                }
                let eventObject = eventList[i];
                invokeFunction(eventObject.callbackFunction, [event, payload]);
                if(eventObject.oneShot){
                    eventObject.remove();
                }
            }
        }
    }
    
    addChild(eventDispatcher) {
        if(!eventDispatcher) return;
        if(this[children].indexOf(eventDispatcher) !== -1) return;
        
        this[children].push(eventDispatcher);
        eventDispatcher[parent] = this;
    }

    removeChild(eventDispatcher) {
        let index = this[children].indexOf(eventDispatcher);
        if(index === -1) return;

        this[children].splice(index, 1);
        eventDispatcher[parent] = undefined;
    }
    
    dispatch(eventName, payload) {
        if(this[isPaused]) return;

        let eventMetaData = {
            shouldPropagate: true,
            shouldImmediatelyPropagate: true
        };

        let event = {
            eventName,
            stopPropagation: function() {
                eventMetaData.shouldPropagate = false;
            },
            stopImmediatePropagation: function() {
                eventMetaData.shouldImmediatelyPropagate = false;
            },
            currentTarget: this,
            target: this
        };

        this[propagateToParent](event, payload, eventMetaData);
        this[propagateToChildren](event, payload, eventMetaData);

        this[sendEvent](event, payload, eventMetaData);
    }
    
    addListener(eventName, callbackFunction, priority = 0, oneShot = false) {
        if(!this[eventMap][eventName]) this[eventMap][eventName] = [];
        let self = this;

        let eventObject = {
            callbackFunction: callbackFunction,
            oneShot: oneShot,
            priority: priority,
            remove: function(){
                let list = self[eventMap][eventName];
                if(!list) return;
                let index = list.indexOf(eventObject);
                if(index === -1) return;
                list.splice(index, 1);
            }
        };

        this[eventMap][eventName].push(eventObject);
        

        return {
            remove: eventObject.remove
        }
    }
    
    get children() {
        return this[children].slice();
    }
    
    get parent() {
        return this[parent];
    }
}