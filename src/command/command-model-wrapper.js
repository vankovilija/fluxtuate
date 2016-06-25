import {command} from "./_internals"
import UpdateModelWrapper from "../model/update-model-wrapper"

export default class CommandModelWrapper extends UpdateModelWrapper {
    constructor(wrappedModel, holderContext, holderCommand) {
        super(wrappedModel, holderContext);
        this[command] = holderCommand;
    }
}