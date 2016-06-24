import invokeFunction from "../utils/invokeFunction"
import {destroy, pause, resume, eventMap, sendEvent} from "./_internals"

const isPaused = Symbol("fluxtuateEventDispatcher_isPaused");
const children = Symbol("fluxtuateEventDispatcher_children");
const parent = Symbol("fluxtuateEventDispatcher_parent");
const propagateToParent = Symbol("fluxtuateEventDispatcher_propagateToParent");
const propagateToChildren = Symbol("fluxtuateEventDispatcher_propagateToChildren");

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

        this[propagateToParent] = (eventName, payload) => {
            setTimeout(()=>{
                if(this[parent]){
                    this[parent][sendEvent](eventName, payload);
                    this[parent][propagateToParent](eventName, payload);
                }
            },0);
        };

        this[propagateToChildren] = (eventName, payload) => {
            setTimeout(()=>{
                if(this[children] && this[children].length > 0){
                    this[children].forEach(c=>{
                        c[sendEvent](eventName, payload);
                        c[propagateToChildren](eventName, payload);
                    });
                }
            },0);
        };

        this[sendEvent] = (eventName, payload) => {
            let eventList = this[eventMap][eventName];
            if(!eventList) return;
            eventList = eventList.slice();

            eventList = eventList.sort(sortEvents);

            eventList.forEach((eventObject)=>{
                invokeFunction(eventObject.callbackFunction, [eventName, payload]);
                if(eventObject.oneShot){
                    eventObject.remove();
                }
            });
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

        this[propagateToParent](eventName, payload);
        this[propagateToChildren](eventName, payload);

        this[sendEvent](eventName, payload);
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