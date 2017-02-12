import {context, updateable, modelConstructor, dateConstructor, constructorProps, dataType} from "./_internals"
import {arrayGetterMethods as baseArrayGetterMethods, arraySetterMethods as baseArraySetterMethods} from "./array-methods"
import {isFunction} from "lodash/lang"
import ModelWrapper from "./model-wrapper"
import DateWrapper from "./date-wrapper"
import deepData from "./deep-data"

const innerArray = Symbol("fluxtuateArrayWrapper_innerArray");
const listeners = Symbol("fluxtuateArrayWrapper_listeners");
const destroyed = Symbol("fluxtuateArrayWrapper_destroyed");
const checkDestroyed = Symbol("fluxtuateArrayWrapper_checkDestroyed");
const dispatchUpdate = Symbol("fluxtuateArrayWrapper_dispatchUpdate");
const updateTimer = Symbol("fluxtuateArrayWrapper_updateTimer");
const transformReturn = Symbol("fluxtuateArrayWrapper_transformReturn");
const defineArrayProperties = Symbol("fluxtuateArrayWrapper_defineArrayProperties");
const propsListener = Symbol("fluxtuateArrayWrapper_propsListener");
const propertiesLength = Symbol("fluxtuateArrayWrapper_propertiesLength");

const arraySetterMethods = baseArraySetterMethods.concat(["remove", "clear", "merge", "setElement", "setValue"]);
const arrayGetterMethods = baseArrayGetterMethods.concat(["compare", "find", "findIndex", "getElement"]);

export default class ArrayWrapper {
    constructor(wrappedArray, holderContext) {
        this[innerArray] = wrappedArray;
        this[listeners] = [];
        this[modelConstructor] = ModelWrapper;
        this[dateConstructor] = DateWrapper;
        this[context] = holderContext;
        this[updateable] = false;
        this[constructorProps] = [holderContext];
        this[destroyed] = false;
        this[propertiesLength] = 0;

        this[transformReturn] = (returnElement) => {
            if(returnElement && isFunction(returnElement.onUpdate)){
                if(returnElement[dataType] === "array") {
                    return new (Function.prototype.bind.apply(this.constructor, [this, returnElement, ...this[constructorProps]]));
                }else if(returnElement[dataType] === "date") {
                    return new (Function.prototype.bind.apply(this[dateConstructor], [this, returnElement, ...this[constructorProps]]));
                }else {
                    return new (Function.prototype.bind.apply(this[modelConstructor], [this, returnElement, ...this[constructorProps]]));
                }
            } else {
                return returnElement;
            }
        };

        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed array.");
            }
        };

        this[defineArrayProperties] = () => {
            let l = this[innerArray].length;

            for(let i = this[propertiesLength]; i <= l; i++) {
                Object.defineProperty(this, i, {
                    get() {
                        return this.getElement(i);
                    },
                    set(value) {
                        this.setElement(i, value);
                    },
                    configurable: true
                });
            }

            this[propertiesLength] = l + 1;
        };

        this[dispatchUpdate] = (callback, payload)=>{
            this[defineArrayProperties]();
            if(this[updateTimer]) {
                clearTimeout(this[updateTimer]);
                this[updateTimer] = undefined;
            }

            if(this[destroyed]) return;

            this[updateTimer] = setTimeout(()=>{
                callback({model: this, data: payload.data, name: payload.name});
            }, 0)
        };

        arraySetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    this[checkDestroyed]();

                    if(!this[updateable]){
                        throw new Error("You are trying to alter a array that is not editable, you must do all data alteration from a command!");
                    }

                    return this[transformReturn](this[innerArray][methodName].apply(this[innerArray], [this, ...args]));
                },
                configurable: false
            })
        });
        arrayGetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    this[checkDestroyed]();

                    return this[transformReturn](this[innerArray][methodName].apply(this[innerArray], args));
                },
                configurable: false
            })
        });
        
        this[propsListener] = this[innerArray].onUpdate(this[defineArrayProperties]);
        this[defineArrayProperties]();
    }

    get modelName() {
        this[checkDestroyed]();

        return this[innerArray].modelName;
    }

    get length() {
        this[checkDestroyed]();

        return this[innerArray].length;
    }

    set length(value) {
        this[checkDestroyed]();

        if(!this[updateable]){
            throw new Error("You are trying to alter a array that is not editable, you must do all data alteration from a command!");
        }

        this[innerArray].setLength(this, value);
    }

    forEach(callback) {
        if(!isFunction(callback)){
            throw new Error("You must supply a function to the forEach method of arrays!");
        }

        for(let i = 0; i < this[innerArray].length; i++) {
            callback(this.getElement(i), i);
        }
    }

    onUpdate(callback) {
        this[checkDestroyed]();

        let listener = this[innerArray].onUpdate(this[dispatchUpdate].bind(this, callback));
        let removeFunction = listener.remove;
        let index = this[listeners].length;
        this[listeners].push(listener);
        listener.remove = () => {
            this[listeners].splice(index, 1);
            removeFunction();
        };
        return listener;
    }

    get modelData() {
        this[checkDestroyed]();

        let wrapper = {data: this[innerArray].slice()};
        let deep = deepData(wrapper, "modelData");
        return deep.data;
    }

    get cleanData() {
        this[checkDestroyed]();

        let wrapper = {data: this[innerArray].slice()};
        let deep = deepData(wrapper, "cleanData");
        return deep.data;
    }

    destroy() {
        if(this[destroyed]) return;

        this[propsListener].remove();
        this[listeners].forEach((listener)=>{
            listener.remove();
        });

        this[destroyed] = true;
    }
}