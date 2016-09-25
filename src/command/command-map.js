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
import Promise from "bluebird"

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

            if(!this[eventMap][eventName]) this[eventMap][eventName] = {
                listener: this[eventDispatcher].addListener(eventName, this[executeCommandFromEvent]),
                commands: []
            };

            let commandName = eventName + " (" + this[eventMap][eventName].commands.length + ")";

            let commandObject = {
                command: command,
                commandName: commandName,
                commandProperties: commandProperties,
                oneShot: oneShot
            };

            this[eventMap][eventName].commands.push(commandObject);
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
                if(commandObject.hooks){
                    commandObject.hooks.forEach((hookObject)=>{
                        let hook;
                        if(hookObject.hookProperties) {
                            let convertedProperties = hookObject.hookProperties.map((prop)=>{
                                if(prop instanceof ModelWrapper){
                                    prop = prop[model];
                                }

                                if(prop instanceof Model){
                                    return new ModelWrapper(prop, context);
                                }

                                return prop;
                            });
                            hook = new (Function.prototype.bind.apply(hookObject.hook, [this, ...convertedProperties]));
                        }else{
                            hook = new hookObject.hook();
                        }
                        context[applyGuardContext](hook, {payload: payload});
                        if(!isFunction(hook.hook)){
                            throw new Error(`Hooks must have a hook function! ${hook}`);
                        }
                        hook.dispatch = context.dispatch;
                        hook.hook();
                    });
                }
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

            let commandMappings = this[eventMap][eventName].commands.slice();
            commandMappings.forEach((commandObject)=>{
                if(commandObject.guards){
                    let guardPromises = commandObject.guards.map((guardObject)=>{
                        let guard;
                        if(guardObject.guardProperties) {
                            let convertedProperties = guardObject.guardProperties.map((prop)=>{
                                if(prop instanceof ModelWrapper){
                                    prop = prop[model];
                                }

                                if(prop instanceof Model){
                                    return new ModelWrapper(prop, context);
                                }

                                return prop;
                            });
                            guard = new (Function.prototype.bind.apply(guardObject.guard, [this, ...convertedProperties]));
                        }else{
                            guard = new guardObject.guard();
                        }
                        context[applyGuardContext](guard, {payload: payload});
                        if(!isFunction(guard[approveGuard])){
                            throw new Error(`Guards must have be of type Guard! ${guard}`);
                        }
                        return guard[approveGuard]().then((isApproved)=> {
                            if(isFunction(guard.destroy))
                                guard.destroy();

                            return guardObject.hasGuard && isApproved || !guardObject.hasGuard && !isApproved;
                        });
                    });
                    Promise.all(guardPromises).then((results)=>{
                        for(let i = 0; i < results.length; i++){
                            if (!results[i]) return;
                        }

                        executeInEvent(eventName, payload, commandObject);
                    });
                }else{
                    executeInEvent(eventName, payload, commandObject);
                }
            });

            if(commandCount === 0) {
                setTimeout(()=>{
                    this.dispatch("complete", {event: eventName, payload: payload});
                }, 0);
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
        if(commandProperties && commandProperties.length > 0){
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
                    if(!commandObject.guards) commandObject.guards = [];
                    commandObject.guards.push({
                        hasGuard: true,
                        guard: guardClass,
                        guardProperties: guardProperties
                    });

                    return guardReturn(commandObject);
                },
                withoutGuard(guardClass, ...guardProperties){
                    if(!commandObject.guards) commandObject.guards = [];
                    commandObject.guards.push({
                        hasGuard: false,
                        guard: guardClass,
                        guardProperties: guardProperties
                    });

                    return guardReturn(commandObject);
                },
                withHook(hookClass, ...hookProperties){
                    if(!commandObject.hooks) commandObject.hooks = [];
                    commandObject.hooks.push({
                        hook: hookClass,
                        hookProperties
                    });

                    return guardReturn(commandObject);
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

        let index = findIndex(this[eventMap][eventName].commands, {command: command});


        if(index === -1) return;

        this[eventMap][eventName].commands.splice(index, 1);
        if(this[eventMap][eventName].commands.length === 0) {
            this[eventMap][eventName].listener.remove();
            this[eventMap][eventName] = undefined;
        }
    }

    hasEvent(eventName) {
        return Boolean(this[eventMap][eventName] && this[eventMap][eventName].commands.length > 0);
    }
}