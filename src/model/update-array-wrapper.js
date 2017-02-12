import ArrayWrapper from "./array-wrapper"
import {updateable, modelConstructor, dateConstructor} from "./_internals"
import UpdateModelWrapper from "./update-model-wrapper"
import UpdateDateWrapper from "./update-date-wrapper"

export default class UpdateArrayWrapper extends ArrayWrapper {
    constructor(wrappedArray, holderContext) {
        super(wrappedArray, holderContext);
        this[updateable] = true;
        this[modelConstructor] = UpdateModelWrapper; 
        this[dateConstructor] = UpdateDateWrapper;
    }
}