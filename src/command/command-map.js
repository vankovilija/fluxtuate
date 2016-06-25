import {isFunction} from "lodash/lang"
import {findIndex} from "lodash/array"
import {applyCommandContext} from "../context/_internals"
import Command from "./command"
import {destroy, pause, resume} from "./_internals"

const eventMap = Symbol("fluxtuateCommandMap_eventMap");
const addCommand = Symbol("fluxtuateCommandMap_addCommand");
const executeCommandFromEvent = Symbol("fluxtuateCommandMap_executeCommandFromEvent");
const eventDispatcher = Symbol("fluxtuateCommandMap_eventDispatcher");
const isPaused = Symbol("fluxtuateCommandMap_isPaused");

export default class CommandMap {
    constructor(ed, context) {
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

        this[addCommand] = (eventName, command, oneShot)=>{
            if((command === Command) || !(command.prototype instanceof Command))
                throw new Error("Commands must extend the Command class!");

            if(!isFunction(command.prototype.execute)){
                throw new Error("Commands must implement a execute method!");
            }

            if(!this[eventMap][eventName]) this[eventMap][eventName] = [];
            this[eventMap][eventName].push({
                command: command,
                oneShot: oneShot,
                listener: this[eventDispatcher].addListener(eventName, this[executeCommandFromEvent])
            });

        };

        this[executeCommandFromEvent] = (eventName, payload) => {
            if(this[isPaused]) return;

            setTimeout(()=>{
                let cmds = this[eventMap][eventName].slice();
                cmds.forEach((commandObject)=>{
                    let command = new commandObject.command(eventName, payload);
                    context[applyCommandContext](command, {payload: payload});
                    command.execute();
                    if(commandObject.oneShot){
                        this.unmapEvent(eventName, commandObject.command);
                    }
                });
            }, 0);
        };

        this[eventDispatcher] = ed;
    }

    mapEvent(eventName, command){
        let self = this;
        let r = {
            toCommand(command) {
                self[addCommand](eventName, command, false);
                return self;
            },
            once(command){
                self[addCommand](eventName, command, true);
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
}