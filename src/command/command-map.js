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
import {release} from "./_internals"

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

        this[executeCommandFromEvent] = (event, payload) => {
            if(this[isPaused]) return;
            let eventName = event.eventName;

            let commandCount = 0;
            let completeCount = 0;

            function errorForCommandOnEvent(command, eventName, payload, commandObject, error){
                let rootCommand;
                if(commandObject.rootCommand) {
                    rootCommand = commandObject.rootCommand;
                }else{
                    rootCommand = commandObject;
                }
                if(rootCommand.endings) {
                    for(let i = 0; i < rootCommand.endings.length; i++) {
                        processCommandGuard(eventName, payload, rootCommand.endings[i]);
                    }
                }

                throw new Error(`There was a error while executing command ${command.commandName} on event ${eventName} with payload ${payload}
                ${error.stack}`);
            }

            function completeCommandForEvent(command, eventName, payload, commandObject){
                if(commandObject.oneShot){
                    this.unmapEvent(eventName, commandObject.command);
                }
                completeCount++;
                this.dispatch("completeCommand", command);
                if(isFunction(command.destroy)){
                    command.destroy();
                }
                if(commandCount === completeCount) {
                    this.dispatch("complete", {event: eventName, payload: payload});
                }

                if(commandObject.events) {
                    for(let i = 0; i < commandObject.events.length; i++) {
                        ed.dispatch(commandObject.events[i].eventName, commandObject.events[i].payload || commandObject.events[i].payloadProvider(payload));
                    }
                }

                if(commandObject.commandObjects) {
                    for(let i = 0; i < commandObject.commandObjects.length; i++) {
                        processCommandGuard(eventName, payload, commandObject.commandObjects[i]);
                    }
                }else {
                    let rootCommand;
                    if (commandObject.rootCommand) {
                        rootCommand = commandObject.rootCommand;
                    } else {
                        rootCommand = commandObject;
                    }

                    if (rootCommand.endings) {
                        for (let i = 0; i < rootCommand.endings.length; i++) {
                            processCommandGuard(eventName, payload, rootCommand.endings[i]);
                        }
                    }
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
                let command = this.executeCommand(
                    eventName,
                    commandObject.command,
                    commandObject.payloadProvider ? commandObject.payloadProvider(payload) : payload,
                    ...commandObject.commandProperties
                );
                if(!command.commandName) {
                    Object.defineProperty(command, "commandName", {
                        get() {
                            return context.contextName + "->" + commandObject.commandName;
                        }
                    });
                }
                command.onComplete(completeCommandForEvent.bind(this, command, eventName, payload, commandObject));
                command.onError(errorForCommandOnEvent.bind(this, command, eventName, payload, commandObject));
            };

            let processCommandGuard = (eventName, payload, commandObject)=>{
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
                            if (!results[i]) {
                                if(commandObject.commandObjects) {
                                    for(let i = 0; i < commandObject.commandObjects.length; i++) {
                                        processCommandGuard(eventName, payload, commandObject.commandObjects[i]);
                                    }
                                }else {

                                    let rootCommand;
                                    if (commandObject.rootCommand) {
                                        rootCommand = commandObject.rootCommand;
                                    } else {
                                        rootCommand = commandObject;
                                    }

                                    if (rootCommand.endings) {
                                        for (let i = 0; i < rootCommand.endings.length; i++) {
                                            processCommandGuard(eventName, payload, rootCommand.endings[i]);
                                        }
                                    }
                                }
                                return;
                            }
                        }

                        executeInEvent(eventName, payload, commandObject);
                    });
                }else{
                    executeInEvent(eventName, payload, commandObject);
                }
            };

            let commandMappings = this[eventMap][eventName].commands.slice();
            commandMappings.forEach((commandObject)=>{
                if(commandObject.stopPropagation) {
                    event.stopPropagation();
                }
                processCommandGuard(eventName, payload, commandObject);
            });

            if(commandCount === 0) {
                setTimeout(()=>{
                    if(this[commandsContext].destroyed) return;

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
        this.dispatch("executeCommand", command);
        setTimeout(()=>{
            if(this[commandsContext].destroyed) return;

            this[commandsContext][applyCommandContext](command, {payload: payload});
            let result = command.execute();
            if(result && isFunction(result.then)){
                command[release](result);
            }else{
                command[release]();
            }
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
        
        function mapEventReturn(commandObject){
            return {
                withGuard(guardClass, ...guardProperties) {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }
                    if(!commandObject.guards) commandObject.guards = [];
                    commandObject.guards.push({
                        hasGuard: true,
                        guard: guardClass,
                        guardProperties: guardProperties
                    });

                    return mapEventReturn(commandObject);
                },
                withoutGuard(guardClass, ...guardProperties) {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }
                    if(!commandObject.guards) commandObject.guards = [];
                    commandObject.guards.push({
                        hasGuard: false,
                        guard: guardClass,
                        guardProperties: guardProperties
                    });

                    return mapEventReturn(commandObject);
                },
                withHook(hookClass, ...hookProperties) {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }
                    if(!commandObject.hooks) commandObject.hooks = [];
                    commandObject.hooks.push({
                        hook: hookClass,
                        hookProperties
                    });

                    return mapEventReturn(commandObject);
                },
                stopPropagation() {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }
                    let rootObject = commandObject;
                    if(rootObject.rootCommand) {
                        rootObject = rootObject.rootCommand;
                    }
                    rootObject.stopPropagation = true;

                    return mapEventReturn(commandObject);
                },
                payloadProvider(providerFunction) {
                    if(!isFunction(providerFunction)) {
                        throw new Error("Payload provider must be a function that returns a payload value!");
                    }
                    commandObject.payloadProvider = providerFunction;
                    return mapEventReturn(commandObject);
                },
                toCommand(command, ...commandProps) {
                    let c = self[addCommand](eventName, command, commandProps, false);
                    if(commandObject){
                        if(!commandObject.commandObjects) {
                            commandObject.commandObjects = [];
                        }

                        let commandIndex = self[eventMap][eventName].commands.indexOf(c);
                        if(commandIndex !== -1) {
                            self[eventMap][eventName].commands.splice(commandIndex, 1);
                        }
                        if(commandObject.rootCommand) {
                            c.rootCommand = commandObject.rootCommand;
                        }else{
                            c.rootCommand = commandObject;
                        }

                        commandObject.commandObjects.push(c);
                    }
                    return mapEventReturn(c);
                },
                endWith(command, ...commandProps) {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }
                    let rootCommand;

                    if(commandObject.rootCommand) {
                        rootCommand = commandObject.rootCommand;
                    }else{
                        rootCommand = commandObject;
                    }

                    let c = self[addCommand](eventName, command, commandProps, false);

                    if(!rootCommand.endings) {
                        rootCommand.endings = [];
                    }

                    let commandIndex = self[eventMap][eventName].commands.indexOf(c);
                    if(commandIndex !== -1) {
                        self[eventMap][eventName].commands.splice(commandIndex, 1);
                    }

                    rootCommand.endings.push(c);

                    return mapEventReturn(c);
                },
                once(command, ...commandProps){
                    let c = self[addCommand](eventName, command, commandProps, true);
                    if(commandObject){
                        if(!commandObject.commandObjects) {
                            commandObject.commandObjects = [];
                        }

                        let commandIndex = self[eventMap][eventName].commands.indexOf(c);
                        if(commandIndex !== -1) {
                            self[eventMap][eventName].commands.splice(commandIndex, 1);
                        }
                        if(commandObject.rootCommand) {
                            c.rootCommand = commandObject.rootCommand;
                        }else{
                            c.rootCommand = commandObject;
                        }

                        commandObject.commandObjects.push(c);
                    }
                    return mapEventReturn(c);
                },
                addEvent(addedEventName) {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }

                    if(!this[eventMap][eventName]) this[eventMap][eventName] = {
                        listener: this[eventDispatcher].addListener(eventName, this[executeCommandFromEvent]),
                        commands: []
                    };

                    this[eventMap][addedEventName].commands.push(commandObject);

                    return mapEventReturn(commandObject);
                },
                withEvent(eventName, payload) {
                    if(!commandObject) {
                        throw new Error("No command is mapped yet!");
                    }

                    if(!commandObject.events) {
                        commandObject.events = [];
                    }

                    let event = {
                        eventName
                    };

                    if(isFunction(payload)){
                        event.payloadProvider = payload;
                    }else{
                        event.payload = payload;
                    }

                    commandObject.events.push(event);

                    return mapEventReturn(commandObject);
                }
            };
        }

        return mapEventReturn();
    }

    unmapEvent(eventName, command) {
        if(!this[eventMap][eventName]) return;

        let index = findIndex(this[eventMap][eventName].commands, {command: command});

        if(index === -1) {
            let commands = this[eventMap][eventName].commands;
            if(!commands) return;
            for(let i = 0; i < commands.length; i++) {
                let commandObject = commands[i];
                while(commandObject) {
                    let parentCommandObject = commandObject;
                    commandObject = commandObject.commandObject;
                    if (commandObject) {
                        if (commandObject.command === command) {
                            parentCommandObject.commandObject = commandObject.commandObject;
                            break;
                        }
                    }
                }
            }
            return;
        }

        let commandObject = this[eventMap][eventName].commands[index];
        if(commandObject.commandObject){
            this[eventMap][eventName].commands[index] = commandObject.commandObject;
        }else {
            this[eventMap][eventName].commands.splice(index, 1);
            if (this[eventMap][eventName].commands.length === 0) {
                this[eventMap][eventName].listener.remove();
                this[eventMap][eventName] = undefined;
            }
        }
    }

    hasEvent(eventName) {
        return Boolean(this[eventMap][eventName] && this[eventMap][eventName].commands.length > 0);
    }
}