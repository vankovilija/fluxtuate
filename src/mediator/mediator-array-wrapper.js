import {mediator} from "./_internals"
import {constructorProps, modelConstructor, dateConstructor} from "../model/_internals"
import ArrayWrapper from "../model/array-wrapper"
import MediatorModelWrapper from "./mediator-model-wrapper"
import MediatorDateWrapper from "./mediator-date-wrapper"

export default class MediatorArrayWrapper extends ArrayWrapper {
    constructor(wrappedModel, holderContext, holderMediator) {
        super(wrappedModel, holderContext);
        this[mediator] = holderMediator;
        this[constructorProps] = [holderContext, holderMediator];
        this[modelConstructor] = MediatorModelWrapper;
        this[dateConstructor] = MediatorDateWrapper;
    }
}