import {model, context, destroyed, checkDestroyed, updateable} from "./_internals"
import getOwnKeys from "../utils/getOwnKeys"
import reserved from "../model/reserved"

const listeners = Symbol("fluxtuateModelWrapper_listeners");
const refreshListener = Symbol("fluxtuateModelWrapper_refreshListener");
const dispatchUpdate = Symbol("fluxtuateModelWrapper_dispatchUpdate");
const updateTimer = Symbol("fluxtuateModelWrapper_updateTimer");


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

        this[dispatchUpdate] = (callback, payload)=>{
            if(this[updateTimer]) {
                clearTimeout(this[updateTimer]);
                this[updateTimer] = undefined;
            }

            if(this[destroyed]) return;

            this[updateTimer] = setTimeout(()=>{
                callback({model: this, data: payload.data, name: payload.name});
            }, 0)
        };

        this[updateable] = false;

        this[refreshListener] = wrappedModel.onUpdate(()=>{
            let wrapperKeys = getOwnKeys(this);
            let keys = getOwnKeys(wrappedModel);
            keys.forEach((key)=>{
                if(wrapperKeys.indexOf(key) !== -1 || reserved.indexOf(key) !== -1) return;

                Object.defineProperty(this, key, {
                    get(){
                        return wrappedModel[key];
                    },
                    set(value){
                        if(!this[updateable]){
                            throw new Error("You can only set values to a model from a command!");
                        }

                        wrappedModel.setKeyValue(key, value, this);
                    },
                    configurable: false
                });
            });
            let descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(wrappedModel));

            Object.keys(descriptors).filter((key)=>keys.indexOf(key) === -1).forEach((key)=> {
                if(wrapperKeys.indexOf(key) !== -1 || reserved.indexOf(key) !== -1) return;

                if (descriptors[key].get) {
                    Object.defineProperty(this, key, {
                        get(){
                            return wrappedModel[key];
                        }
                    });
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

        let listener = this[model].onUpdate(this[dispatchUpdate].bind(this, callback));
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

        this[refreshListener].remove();
    }
} 