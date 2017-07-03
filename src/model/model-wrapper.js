import {updateInnerObject, model, context, destroyed, checkDestroyed, updateable, constructorProps, arrayConstructor, dateConstructor, configureDefaultValues, dataType} from "./_internals"
import {contextDispatcher} from "../context/_internals"
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
const detachModel = Symbol("fluxtuateModelWrapper_detachModel");
const changeModelListener = Symbol("fluxtuateModelWrapper_changeModelListener");
const destroyListener = Symbol("fluxtuateModelWrapper_destroyListener");
const propertiesCache = Symbol("fluxtuateModelWrapper_propertiesCache");

export default class ModelWrapper {
    constructor (wrappedModel, holderContext) {
        wrappedModel[configureDefaultValues]();

        this._modelName = wrappedModel.modelName;

        this[model] = wrappedModel;
        this[propertiesCache] = {};
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

        this[detachModel] = () =>{
            if(this[refreshListener]) {
                this[refreshListener].remove();
                this[refreshListener] = undefined;
            }

            if(this[destroyListener]) {
                this[destroyListener].remove();
                this[destroyListener] = undefined;
            }
        };

        this[updateInnerObject] = (wrappedModel) => {
            this[detachModel]();

            this[model] = wrappedModel;

            let cacheKeys = Object.keys(this[propertiesCache]);

            for(let i = 0; i < cacheKeys.length; i++) {
                let propValue = this[propertiesCache][cacheKeys[i]];
                if(propValue !== undefined) {
                    if(isFunction(propValue[updateInnerObject]) && wrappedModel[cacheKeys[i]] !== undefined) {
                        propValue[updateInnerObject](wrappedModel[cacheKeys[i]]);
                    } else {
                        if(isFunction(propValue.destroy)) {
                            propValue.destroy();
                        }
                        delete this[propertiesCache][cacheKeys[i]];
                    }
                }
            }

            this[refreshListener] = wrappedModel.onUpdate(this[setupModelValues].bind(this, wrappedModel));
            this[destroyListener] = wrappedModel.addListener("destroy", this[detachModel]);
            this[setupModelValues](wrappedModel);

            let oldListeners = this[listeners];
            this[listeners] = [];
            while(oldListeners.length > 0){
                let listener = oldListeners.pop();
                listener.originalRemove();
                this.onUpdate(listener.callback);
            }
        };

        this[setupModelValues] = (wrappedModel)=>{
            let wrapperKeys = getOwnKeys(this);
            let keys = getOwnKeys(wrappedModel);
            keys.forEach((key)=>{
                if(wrapperKeys.indexOf(key) !== -1 || reserved.indexOf(key) !== -1) return;

                Object.defineProperty(this, key, {
                    get(){
                        this[checkDestroyed]();

                        if(this[propertiesCache][key])
                            return this[propertiesCache][key];

                        let propValue;
                        if(wrappedModel[key] && isFunction(wrappedModel[key].onUpdate)){
                            if(wrappedModel[key][dataType] === "array") {
                                propValue = new (Function.prototype.bind.apply(this[arrayConstructor], [this, wrappedModel[key], ...this[constructorProps]]));
                            }else if(wrappedModel[key][dataType] === "date") {
                                propValue = new (Function.prototype.bind.apply(this[dateConstructor], [this, wrappedModel[key], ...this[constructorProps]]));
                            }else {
                                propValue = new (Function.prototype.bind.apply(this.constructor, [this, wrappedModel[key], ...this[constructorProps]]));
                            }

                            this[propertiesCache] = propValue;

                            return propValue;
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
                    configurable: true
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

        this[refreshListener] = wrappedModel.onUpdate(this[setupModelValues].bind(this, wrappedModel));
        this[destroyListener] = wrappedModel.onUpdate(this[detachModel]);
        this[setupModelValues](wrappedModel);

        if(holderContext) {
            this[changeModelListener] = holderContext[contextDispatcher].addListener("changeModel", (event, payload) => {
                if (payload.model.modelName === this._modelName) {
                    this[updateInnerObject](payload.model);
                }
            });
        }
    }

    get modelData() {
        this[checkDestroyed]();

        if(!this[model]) return;

        return this[model].modelData;
    }

    get cleanData() {
        this[checkDestroyed]();

        if(!this[model]) return;

        return this[model].cleanData;
    }

    get modelName() {
        this[checkDestroyed]();

        if(!this[model]) return;

        return this[model].modelName;
    }

    compare(model) {
        this[checkDestroyed]();

        if(!this[model]) return;

        this[model].compare(model);
    }
    
    onUpdate(callback) {
        this[checkDestroyed]();

        if(!this[model]) return;

        let listener = this[model].onUpdate(this[dispatchUpdate].bind(this, callback, {}));
        let removeFunction = listener.remove;
        let index = this[listeners].length;
        listener.callback = callback;
        listener.originalRemove = removeFunction;
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

        let cacheKeys = Object.keys(this[propertiesCache]);

        for(let i = 0; i < cacheKeys.length; i++) {
            let propValue = this[propertiesCache][cacheKeys[i]];
            if(propValue && isFunction(propValue.destroy)) {
                propValue.destroy();
            }
        }

        this[destroyed] = true;

        if(this[refreshListener]) {
            this[refreshListener].remove();
            this[refreshListener] = undefined;
        }

        if(this[destroyListener]) {
            this[destroyListener].remove();
            this[destroyListener] = undefined;
        }

        if(this[changeModelListener]) {
            this[changeModelListener].remove();
            this[changeModelListener] = undefined;
        }
    }
} 