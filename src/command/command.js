import {event, eventPayload} from "./_internals"
import Promise from "bluebird"

const releasePromise = Symbol("fluxtuateCommand_releasePromise");

export default class Command {
    constructor(responsibleEvent, responsibleEventPayload) {
        this[releasePromise] = new Promise((release)=>{
            Object.defineProperty(this, "release", {
                get() {
                    return release;
                }
            });
        });

        Object.defineProperty(this, "onComplete", {
            get() {
                return (handler)=>{
                    this[releasePromise].then(()=>{
                        handler();
                    });
                };
            }
        });

        this[event] = responsibleEvent;
        this[eventPayload] = responsibleEventPayload;
    }

    execute() {}
}