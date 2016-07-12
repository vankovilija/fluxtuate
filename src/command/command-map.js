import EventDispatcher from "../event-dispatcher"
import {isFunction} from "lodash/lang"
import {findIndex} from "lodash/array"
import {applyCommandContext} from "../context/_internals"
import Command from "./command"
import {destroy, pause, resume} from "./_internals"
import Promise from "bluebird"

const eventMap = Symbol("fluxtuateCommandMap_eventMap");
const addCommand = Symbol("fluxtuateCommandMap_addCommand");
const executeCommandFromEvent = Symbol("fluxtuateCommandMap_executeCommandFromEvent");
const eventDispatcher = Symbol("fluxtuateCommandMap_eventDispatcher");
const isPaused = Symbol("fluxtuateCommandMap_isPaused");

export default class CommandMap extends EventDispatcher{
    constructor(ed, context) {
        super();
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

        this[addCommand] = (eventName, command, commandName, oneShot)=>{
            if((command === Command) || !(command.prototype instanceof Command))
                throw new Error("Commands must extend the Command class!");

            if(!isFunction(command.prototype.execute)){
                throw new Error("Commands must implement a execute method!");
            }

            if(!this[eventMap][eventName]) this[eventMap][eventName] = [];

            if(!commandName) commandName = eventName + " (" + this[eventMap][eventName].length + ")";

            this[eventMap][eventName].push({
                command: command,
                commandName: commandName,
                oneShot: oneShot,
                listener: this[eventDispatcher].addListener(eventName, this[executeCommandFromEvent])
            });

        };

        this[executeCommandFromEvent] = (eventName, payload) => {
            if(this[isPaused]) return;

            let commandMappings = this[eventMap][eventName].slice();
            let commands = [];
            commandMappings.forEach((commandObject)=>{
                let command = new commandObject.command(eventName, payload);
                context[applyCommandContext](command, {payload: payload});
                commands.push(command);
            });

            setTimeout(()=>{
                commands.forEach((command, index)=>{
                    if(!command.commandName) {
                        Object.defineProperty(command, "commandName", {
                            get() {
                                return context.contextName + "->" + commandMappings[index].commandName;
                            }
                        });
                    }
                    command.execute();
                    if(commandMappings[index].oneShot){
                        this.unmapEvent(eventName, commandMappings[index].command);
                    }
                });
            }, 0);

            if(commands.length > 0) {
                let completeCount = 0;
                commands.forEach((command)=> {
                    command.onComplete(()=> {
                        completeCount++;
                        if(commands.length === completeCount) {
                            this.dispatch("complete", {event: eventName, payload: payload});
                        }
                    });
                });
            } else {
                this.dispatch("complete", {event: eventName, payload: payload});
            }
        };

        this[eventDispatcher] = ed;
    }

    onComplete(callback){
        if(!callback) return;

        let listener = this.addListener("complete", (ev, payload)=>{
            callback(payload.event, payload.payload);
            listener.remove();
        });
    }

    mapEvent(eventName, command){
        let self = this;
        let r = {
            toCommand(command, commandName) {
                self[addCommand](eventName, command, commandName, false);
                return self;
            },
            once(command, commandName){
                self[addCommand](eventName, command, commandName, true);
                return self;
            }
        };
        if(command){
            return r.toCommand(command);
        }else {
            return r;
        }
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