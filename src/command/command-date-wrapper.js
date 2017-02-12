import {command} from "./_internals"
import UpdateDateWrapper from "../model/update-date-wrapper"

export default class CommandArrayWrapper extends UpdateDateWrapper {
    constructor(wrappedModel, holderContext, holderCommand) {
        super(wrappedModel, holderContext);
        this[command] = holderCommand;
    }
}