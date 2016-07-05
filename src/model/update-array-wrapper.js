import ArrayWrapper from "./array-wrapper"
import {updateable, modelConstructor} from "./_internals"
import UpdateModelWrapper from "./update-model-wrapper"

export default class UpdateArrayWrapper extends ArrayWrapper {
    constructor(wrappedArray, holderContext) {
        super(wrappedArray, holderContext);
        this[updateable] = true;
        this[modelConstructor] = UpdateModelWrapper; 
    }
}