import {autobind} from "core-decorators"
import {defaultValues, injectionValueMap, applyInjectionSignature, getInjectionSignature} from "./_internals"
import Injector from "./injector"

const contextSignature = Symbol("fluxtuate_contextInjectionSignature");

@autobind
export default class ContextInjector extends Injector{
    constructor(context, eventDispatcher, mediatorMap, commandMap){
        super();
        
        this[defaultValues] = {
            "injector": "Gets the default injection for the context",
            "mediatorMap": "Retrieves the map of mediators",
            "commandMap": "Retrieves the map of commands",
            "eventDispatcher": "Gets the event dispatcher for the context",
            "context": "Retrieves the current context"
        };

        this[injectionValueMap]["eventDispatcher"] = eventDispatcher;
        this[injectionValueMap]["mediatorMap"] = mediatorMap;
        this[injectionValueMap]["commandMap"] = commandMap;
        this[injectionValueMap]["context"] = context;
        this[injectionValueMap]["injector"] = this;

        this[getInjectionSignature] = (instance) => {
            if(!instance[contextSignature]) return undefined;

            return instance[contextSignature][context.contextName];
        };

        this[applyInjectionSignature] = (instance, signature) => {
            if(!instance[contextSignature]) {
                instance[contextSignature] = {};
            }

            instance[contextSignature][context.contextName] = signature;
        };
    }
}