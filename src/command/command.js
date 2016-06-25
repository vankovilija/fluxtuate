import {event, eventPayload} from "./_internals"
import Promise from "bluebird"

export default class Command extends Promise{
    constructor(responsibleEvent, responsibleEventPayload) {
        super((release)=>{
            Object.defineProperty(this, "release", {
                get() {
                    return release;
                }
            });
        });

        this[event] = responsibleEvent;
        this[eventPayload] = responsibleEventPayload;
    }

    execute() {}
}