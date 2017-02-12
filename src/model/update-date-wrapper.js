import DateWrapper from "./date-wrapper"
import {updateable} from "./_internals"

export default class UpdateDateWrapper extends DateWrapper {
    constructor(wrappedDate, holderContext) {
        super(wrappedDate, holderContext);
        this[updateable] = true;
    }
}