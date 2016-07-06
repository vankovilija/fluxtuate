import {context, updateable, modelConstructor, constructorProps} from "./_internals"
import ModelWrapper from "./model-wrapper"
import deepData from "./deep-data"

const innerArray = Symbol("fluxtuateArrayWrapper_innerArray");
const listeners = Symbol("fluxtuateArrayWrapper_listeners");
const destroyed = Symbol("fluxtuateArrayWrapper_destroyed");
const checkDestroyed = Symbol("fluxtuateArrayWrapper_checkDestroyed");
const dispatchUpdate = Symbol("fluxtuateArrayWrapper_dispatchUpdate");
const updateTimer = Symbol("fluxtuateArrayWrapper_updateTimer");
const defineArrayProperties = Symbol("fluxtuateArrayWrapper_defineArrayProperties");
const propertiesLength = Symbol("fluxtuateArrayWrapper_propertiesLength");
const arraySetterMethods = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift", "setElement", "remove", "clear", "merge"];
const arrayGetterMethods = ["slice", "indexOf", "forEach", "map", "find", "compare"];

export default class ArrayWrapper {
    constructor(wrappedArray, holderContext) {
        this[innerArray] = wrappedArray;
        this[listeners] = [];
        this[modelConstructor] = ModelWrapper;
        this[context] = holderContext;
        this[updateable] = false;
        this[constructorProps] = [holderContext];
        this[destroyed] = false;
        this[propertiesLength] = 0;

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
                        return this[innerArray].getElement(i);
                    },
                    set(value) {
                        this[innerArray].setElement(this, i, value);
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

                    return this[innerArray][methodName].apply(this[innerArray], [this, ...args]);
                },
                configurable: false
            })
        });
        arrayGetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    this[checkDestroyed]();

                    return this[innerArray][methodName].apply(this[innerArray], args);
                },
                configurable: false
            })
        });
        
        this[defineArrayProperties]();
    }

    get modelName() {
        this[checkDestroyed]();

        return this[innerArray].modelName;
    }

    getElement(index) {
        this[checkDestroyed]();

        let returnElement = this[innerArray][index];
        if(returnElement && isFunction(returnElement.onUpdate)){
            if(isArrayLike(returnElement)) {
                return new (Function.prototype.bind.apply(this.constructor, [this, returnElement, ...this[constructorProps]]));
            }else {
                return new (Function.prototype.bind.apply(this[modelConstructor], [this, returnElement, ...this[constructorProps]]));
            }
        } else {
            return returnElement;
        }
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
        this[listeners].forEach((listener)=>{
            listener.remove();
        });

        this[destroyed] = true;
    }
}