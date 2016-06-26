import {model, checkDestroyed, updateable} from "./_internals"
import ModelWrapper from "./model-wrapper"

export default class UpdateModelWrapper extends ModelWrapper{
    constructor() {
        super();

        this[updateable] = true;
    }
    
    update(data) {
        this[checkDestroyed]();
        this[model].update(data);
    }

    setValue(value) {
        this[checkDestroyed]();
        this[model].setValue(value);
    }

    clear() {
        this[checkDestroyed]();
        this[model].clear();
    }
} 