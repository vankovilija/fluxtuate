import EventDispatcher from "../event-dispatcher"
import {isFunction, isString} from "lodash/lang"
import {findIndex} from "lodash/array"
import {applyCommandContext, applyGuardContext} from "../context/_internals"
import Command from "./command"
import {destroy, pause, resume, event as eventKey, eventPayload as eventPayloadKey, command as CommandKey} from "./_internals"
import {approveGuard} from "../guard/_internals"
import CommandModelWrapper from "./command-model-wrapper"
import Model from "../model"
import ModelWrapper from "../model/model-wrapper"
import {model} from "../model/_internals"

const eventMap = Symbol("fluxtuateCommandMap_eventMap");
const addCommand = Symbol("fluxtuateCommandMap_addCommand");
const executeCommandFromEvent = Symbol("fluxtuateCommandMap_executeCommandFromEvent");
const eventDispatcher = Symbol("fluxtuateCommandMap_eventDispatcher");
const isPaused = Symbol("fluxtuateCommandMap_isPaused");
const commandsContext = Symbol("fluxtuateCommandMap_commandsContext");

export default class CommandMap extends EventDispatcher{
    constructor(ed, context) {
        super();
        this[commandsContext] = context;
        this[eventMap] = {};
        this[isPaused] = false;

        this[pause] = () => {
            this[isPaused] = true;
        };

        this[resume] = () => {
            this[isPaused] = false;
        };
        
        this[destroy] = () => {
            this[eventMap] = {};
        };

        this[addCommand] = (eventName, command, commandProperties, oneShot)=>{
            if((command === Command) || !(command.prototype instanceof Command))
                throw new Error("Commands must extend the Command class!");

            if(!isFunction(command.prototype.execute)){
                throw new Error("Commands must implement a execute method!");
            }

            if(!this[eventMap][eventName]) this[eventMap][eventName] = [];

            let commandName = eventName + " (" + this[eventMap][eventName].length + ")";

            let commandObject = {
                command: command,
                commandName: commandName,
                commandProperties: commandProperties,
                oneShot: oneShot,
                listener: this[eventDispatcher].addListener(eventName, this[executeCommandFromEvent])
            };

            this[eventMap][eventName].push(commandObject);
            return commandObject;

        };

        this[executeCommandFromEvent] = (eventName, payload) => {
            if(this[isPaused]) return;

            let commandCount = 0;
            let completeCount = 0;

            function completeCommandForEvent(command, eventName, payload, commandObject){
                if(commandObject.oneShot){
                    this.unmapEvent(eventName, commandObject.command);
                }
                completeCount++;
                if(isFunction(command.destroy)){
                    command.destroy();
                }
                if(commandCount === completeCount) {
                    this.dispatch("complete", {event: eventName, payload: payload});
                }
            }

            let executeInEvent = (eventName, payload, commandObject)=>{
                commandCount++;
                let command = this.executeCommand(eventName, commandObject.command, payload, ...commandObject.commandProperties);
                if(!command.commandName) {
                    Object.defineProperty(command, "commandName", {
                        get() {
                            return context.contextName + "->" + commandObject.commandName;
                        }
                    });
                }
                command.onComplete(completeCommandForEvent.bind(this, command, eventName, payload, commandObject));
            };

            let commandMappings = this[eventMap][eventName].slice();
            commandMappings.forEach((commandObject)=>{
                if(commandObject.guard){
                    let guard;
                    if(commandObject.guardProperties) {
                        let convertedProperties = commandObject.guardProperties.map((prop)=>{
                            if(prop instanceof ModelWrapper){
                                prop = prop[model];
                            }

                            if(prop instanceof Model){
                                return new ModelWrapper(prop, context);
                            }
                            
                            return prop;
                        });
                        guard = new (Function.prototype.bind.apply(commandObject.guard, [this, ...convertedProperties]));
                    }else{
                        guard = new commandObject.guard();
                    }
                    context[applyGuardContext](guard, {payload: payload});
                    if(!isFunction(guard[approveGuard])){
                        throw new Error(`Guards must have a approve function! ${guard}`);
                    }
                    guard[approveGuard]().then((isApproved)=> {
                        if(isFunction(guard.destroy))
                            guard.destroy();
                        if (!isApproved) return;

                        executeInEvent(eventName, payload, commandObject);
                    });
                }else{
                    executeInEvent(eventName, payload, commandObject);
                }
            });

            if(commandCount === 0) {
                this.dispatch("complete", {event: eventName, payload: payload});
            }
        };

        this[eventDispatcher] = ed;
    }

    executeCommand(commandConstructor, payload, ...commandProperties){
        let command;
        let eventName = "DirectCommandExecution";
        if(isString(commandConstructor)){
            eventName = commandConstructor;
            commandConstructor = payload;
            payload = commandProperties[0];
            commandProperties = commandProperties.slice(1);
        }
        if(commandProperties){
            let injectedModels = [];
            let convertedProperties = commandProperties.map((prop)=>{
                if(prop instanceof ModelWrapper){
                    prop = prop[model];
                }

                if(prop instanceof Model){
                    let modelWrapper = new CommandModelWrapper(prop, this[commandsContext]);
                    injectedModels.push(modelWrapper);
                    return modelWrapper;
                }

                return prop;
            });
            command = new (Function.prototype.bind.apply(commandConstructor, [this, ...convertedProperties]));
            injectedModels.forEach((modelWrapper)=>{
                modelWrapper[CommandKey] = command;
            });
        }else{
            command = new commandConstructor();
        }
        command[eventKey] = eventName;
        command[eventPayloadKey] = payload;
        this[commandsContext][applyCommandContext](command, {payload: payload});
        setTimeout(()=>{
            command.execute();
        }, 0);

        return command;
    }

    onComplete(callback){
        if(!callback) return;

        let listener = this.addListener("complete", (ev, payload)=>{
            callback(payload.event, payload.payload);
            listener.remove();
        });
    }

    mapEvent(eventName){
        let self = this;
        
        function guardReturn(commandObject){
            return {
                withGuard(guardClass, ...guardProperties){
                    commandObject.guard = guardClass;
                    commandObject.guardProperties = guardProperties;
                    return self;
                }
            };
        }
        
        return {
            toCommand(command, ...commandProps) {
                let commandObject = self[addCommand](eventName, command, commandProps, false);
                return guardReturn(commandObject);
            },
            once(command, ...commandProps){
                let commandObject = self[addCommand](eventName, command, commandProps, true);
                return guardReturn(commandObject);
            }
        };
    }

    unmapEvent(eventName, command) {
        if(!this[eventMap][eventName]) return;

        let index = findIndex(this[eventMap][eventName], {command: command});


        if(index === -1) return;

        this[eventMap][eventName][index].listener.remove();
        this[eventMap][eventName].splice(index, 1);
    }

    hasEvent(eventName) {
        return Boolean(this[eventMap][eventName] && this[eventMap][eventName].length > 0);
    }
}