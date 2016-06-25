import {model, context} from "./_internals"
const listeners = Symbol("fluxtuateModelWrapper_listeners");

export default class ModelWrapper {
    constructor (wrappedModel, holderContext) {
        this[model] = wrappedModel;
        this[listeners] = [];
        this[context] = holderContext;
    }

    get modelData() {
        return this[model].modelData;
    }

    get cleanData() {
        return this[model].cleanData;
    }

    get modelName() {
        return this[model].modelName;
    }

    compare(model) {
        this[model].compare(model);
    }
    
    onUpdate(callback) {
        let listener = this[model].onUpdate(callback);
        let removeFunction = listener.remove;
        let index = this[listeners].length;
        this[listeners].push(listener);
        listener.remove = () => {
            this[listeners].splice(index, 1);
            removeFunction();
        };
        return listener;
    }

    destroy(){
        this[listeners].forEach((listener)=>{
            listener.remove();
        });
    }
} 