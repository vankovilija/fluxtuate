import {event, eventPayload} from "./_internals"

export default class Command {
    constructor(responsibleEvent, responsibleEventPayload) {
        this[event] = responsibleEvent;
        this[eventPayload] = responsibleEventPayload;
    }
}