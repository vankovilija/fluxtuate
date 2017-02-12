import {mediator} from "./_internals"
import DateWrapper from "../model/date-wrapper"

export default class MediatorArrayWrapper extends DateWrapper {
    constructor(wrappedModel, holderContext, holderMediator) {
        super(wrappedModel, holderContext);
        this[mediator] = holderMediator;
    }
}