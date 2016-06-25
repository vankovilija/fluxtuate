import {model} from "./_internals"
import ModelWrapper from "./model-wrapper"

export default class UpdateModelWrapper extends ModelWrapper{
    update(data) {
        this[model].update(data);
    }

    setValue(value) {
        this[model].setValue(value);
    }

    clear() {
        this[model].clear();
    }
} 