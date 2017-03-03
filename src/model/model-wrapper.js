import {model, context, destroyed, checkDestroyed, updateable, constructorProps, arrayConstructor, dateConstructor, configureDefaultValues, dataType} from "./_internals"
import getOwnKeys from "../utils/getOwnKeys"
import reserved from "../model/reserved"
import {isFunction} from "lodash/lang"
import ArrayWrapper from "./array-wrapper"
import DateWrapper from "./date-wrapper"
import forEachPrototype from "../utils/forEachPrototype"
import Model from "./model"

const listeners = Symbol("fluxtuateModelWrapper_listeners");
const refreshListener = Symbol("fluxtuateModelWrapper_refreshListener");
const dispatchUpdate = Symbol("fluxtuateModelWrapper_dispatchUpdate");
const updateTimer = Symbol("fluxtuateModelWrapper_updateTimer");
const setupModelValues = Symbol("fluxtuateModelWrapper_setupModelValues");

export default class ModelWrapper {
    constructor (wrappedModel, holderContext) {
        wrappedModel[configureDefaultValues]();
        this[model] = wrappedModel;
        this[listeners] = [];
        this[context] = holderContext;
        this[destroyed] = false;
        this[constructorProps] = [holderContext];
        this[arrayConstructor] = ArrayWrapper;
        this[dateConstructor] = DateWrapper;
        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed model.");
            }
        };

        this[dispatchUpdate] = (callback, timerHolder, payload)=>{
            if(timerHolder[updateTimer]) {
                clearTimeout(timerHolder[updateTimer]);
                timerHolder[updateTimer] = undefined;
            }

            if(this[destroyed]) return;

            timerHolder[updateTimer] = setTimeout(()=>{
                timerHolder[updateTimer] = undefined;
                if(this[destroyed]) return;
                callback({model: this, data: payload.data, name: payload.name});
            }, 0);
        };

        this[updateable] = false;

        this[setupModelValues] = ()=>{
            let wrapperKeys = getOwnKeys(this);
            let keys = getOwnKeys(wrappedModel);
            keys.forEach((key)=>{
                if(wrapperKeys.indexOf(key) !== -1 || reserved.indexOf(key) !== -1) return;

                Object.defineProperty(this, key, {
                    get(){
                        this[checkDestroyed]();

                        if(wrappedModel[key] && isFunction(wrappedModel[key].onUpdate)){
                            if(wrappedModel[key][dataType] === "array") {
                                return new (Function.prototype.bind.apply(this[arrayConstructor], [this, wrappedModel[key], ...this[constructorProps]]));
                            }else if(wrappedModel[key][dataType] === "date") {
                                return new (Function.prototype.bind.apply(this[dateConstructor], [this, wrappedModel[key], ...this[constructorProps]]));
                            }else {
                                return new (Function.prototype.bind.apply(this.constructor, [this, wrappedModel[key], ...this[constructorProps]]));
                            }
                        } else {
                            return wrappedModel[key];
                        }
                    },
                    set(value){
                        this[checkDestroyed]();

                        if(!this[updateable]){
                            throw new Error("You can only set values to a model from a command!");
                        }

                        wrappedModel.setKeyValue(key, value, this);
                    },
                    configurable: false
                });
            });
            let descriptors = {};
            forEachPrototype(wrappedModel, (proto)=>{
                descriptors = Object.assign(descriptors, Object.getOwnPropertyDescriptors(proto));
            }, Model);

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
        };

        this[refreshListener] = wrappedModel.onUpdate(this[setupModelValues]);
        this[setupModelValues]();
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

        let listener = this[model].onUpdate(this[dispatchUpdate].bind(this, callback, {}));
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