import {sendEvent, propagateToParent, propagateToChildren} from "./_internals"

const innerDispatcher = Symbol("fluxtuateEventDispatcher_innerDispatcher");
const context = Symbol("fluxtuateEventDispatcher_context");
const listeners = Symbol("fluxtuateEventDispatcher_listeners");

const eventDispatcherFunction = ["addChild", "removeChild"];
const eventDispatcherProps = ["children", "parent"];

export default class EventDispatcherWrapper {
    constructor(eventDispatcher, holderContext) {
        this[listeners] = [];
        this[innerDispatcher] = eventDispatcher;
        this[context] = holderContext;

        eventDispatcherFunction.forEach((funcName)=>{
            Object.defineProperty(this, funcName, {
                get: ()=>{
                    return (...args)=>{
                        return this[innerDispatcher][funcName].apply(this, args);
                    }
                }
            })
        });

        eventDispatcherProps.forEach((propName)=>{
            if(Object.hasOwnProperty.apply(this[innerDispatcher], [propName])) {
                Object.defineProperty(this, propName, {
                    get: ()=> {
                        return ()=> {
                            return this[innerDispatcher][propName];
                        }
                    }
                })
            }
        });
    }

    dispatch(eventName, payload) {
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
            currentTarget: this[innerDispatcher],
            target: this
        };

        this[innerDispatcher][propagateToParent](event, payload, eventMetaData);
        this[innerDispatcher][propagateToChildren](event, payload, eventMetaData);

        this[innerDispatcher][sendEvent](event, payload, eventMetaData);
    }
    
    get context() {
        return this[context];
    }

    addListener(eventName, callbackFunction, priority = 0, oneShot = false) {
        let result = this[innerDispatcher].addListener(eventName, callbackFunction, priority, oneShot);
        let originalRemove = result.remove;
        result.remove = ()=>{
            let index = this[listeners].indexOf(result);
            if(index !== -1) {
                this[listeners].splice(index, 1);
            }
            return originalRemove();
        };
        this[listeners].push(
            result
        );
        return result;
    }
    
    
    destroy() {
        while(this[listeners].length > 0) {
            this[listeners].pop().remove();
        }
    }
}