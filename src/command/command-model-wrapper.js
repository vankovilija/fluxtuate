import {command} from "./_internals"
import {constructorProps, arrayConstructor, dateConstructor} from "../model/_internals"
import UpdateModelWrapper from "../model/update-model-wrapper"
import CommandArrayWrapper from "./command-array-wrapper"
import CommandDateWrapper from "./command-date-wrapper"

export default class CommandModelWrapper extends UpdateModelWrapper {
    constructor(wrappedModel, holderContext, holderCommand) {
        super(wrappedModel, holderContext);
        this[command] = holderCommand;
        this[constructorProps] = [holderContext, holderCommand];
        this[arrayConstructor] = CommandArrayWrapper;
        this[dateConstructor] = CommandDateWrapper;
    }
}