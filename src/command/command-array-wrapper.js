import {command} from "./_internals"
import {constructorProps, modelConstructor} from "../model/_internals"
import UpdateArrayWrapper from "../model/update-array-wrapper"
import CommandModelWrapper from "./command-model-wrapper"

export default class CommandArrayWrapper extends UpdateArrayWrapper {
    constructor(wrappedModel, holderContext, holderCommand) {
        super(wrappedModel, holderContext);
        this[command] = holderCommand;
        this[constructorProps] = [holderContext, holderCommand];
        this[modelConstructor] = CommandModelWrapper;
    }
}