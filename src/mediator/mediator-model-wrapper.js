import {mediator} from "./_internals"
import {constructorProps, arrayConstructor} from "../model/_internals"
import ModelWrapper from "../model/model-wrapper"
import MediatorArrayWrapper from "./mediator-array-wrapper"

export default class MediatorModelWrapper extends ModelWrapper {
    constructor(wrappedModel, holderContext, holderMediator) {
        super(wrappedModel, holderContext);
        this[mediator] = holderMediator;
        this[constructorProps] = [holderContext, holderMediator];
        this[arrayConstructor] = MediatorArrayWrapper;
    }

    update() {
        throw new Error(`You are trying to update the model ${this.modelName} from a mediator, models can only be updated from commands.`);
    }

    setValue() {
        throw new Error(`You are trying to update the model ${this.modelName} from a mediator, models can only be updated from commands.`);
    }

    clear() {
        throw new Error(`You are trying to update the model ${this.modelName} from a mediator, models can only be updated from commands.`);
    }
}