import {model, checkDestroyed, updateable, arrayConstructor} from "./_internals"
import ModelWrapper from "./model-wrapper"
import UpdateArrayWrapper from "./update-array-wrapper"

export default class UpdateModelWrapper extends ModelWrapper{
    constructor(wrappedModel, holderContext) {
        super(wrappedModel, holderContext);
        this[arrayConstructor] = UpdateArrayWrapper;
        this[updateable] = true;
    }

    update(data) {
        this[checkDestroyed]();
        this[model].update(data, this);
    }

    setValue(value) {
        this[checkDestroyed]();
        this[model].setValue(value, this);
    }

    clear() {
        this[checkDestroyed]();
        this[model].clear(this);
    }
} 