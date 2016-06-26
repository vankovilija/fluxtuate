import {model, context, destroyed, checkDestroyed} from "./_internals"
import getOwnKeys from "../utils/getOwnKeys"
import reserved from "../model/reserved"

const listeners = Symbol("fluxtuateModelWrapper_listeners");


export default class ModelWrapper {
    constructor (wrappedModel, holderContext) {
        this[model] = wrappedModel;
        this[listeners] = [];
        this[context] = holderContext;
        this[destroyed] = false;
        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed model.");
            }
        };

        let keys = getOwnKeys(wrappedModel);
        keys.forEach((key)=>{
            if(reserved.indexOf(key) !== -1) return;

            Object.defineProperty(this, key, {
                get(){
                    return wrappedModel[key];
                },
                set(value){
                    wrappedModel[key] = value;
                }
            });
        });
    }

    get modelData() {
        this[checkDestroyed]();
        
        return this[model].modelData;
    }

    get cleanData() {
        this[checkDestroyed]();

        return this[model].cleanData;
    }

    get modelName() {
        this[checkDestroyed]();

        return this[model].modelName;
    }

    compare(model) {
        this[checkDestroyed]();

        this[model].compare(model);
    }
    
    onUpdate(callback) {
        this[checkDestroyed]();

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
        this[destroyed] = true;
    }
} 