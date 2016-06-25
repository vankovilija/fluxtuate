import {mediator} from "./_internals"
import ModelWrapper from "../model/model-wrapper"

export default class MediatorModelWrapper extends ModelWrapper {
    constructor(wrappedModel, holderContext, holderMediator) {
        super(wrappedModel, holderContext);
        this[mediator] = holderMediator;
    }
}