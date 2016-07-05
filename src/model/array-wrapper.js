import {context, updateable, modelConstructor, constructorProps} from "./_internals"
import ModelWrapper from "./model-wrapper"
import deepData from "./deep-data"

const innerArray = Symbol("fluxtuateArrayWrapper_innerArray");
const listeners = Symbol("fluxtuateArrayWrapper_listeners");
const destroyed = Symbol("fluxtuateArrayWrapper_destroyed");
const checkDestroyed = Symbol("fluxtuateArrayWrapper_checkDestroyed");
const dispatchUpdate = Symbol("fluxtuateArrayWrapper_dispatchUpdate");
const updateTimer = Symbol("fluxtuateArrayWrapper_updateTimer");
const arraySetterMethods = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift", "setElement", "setLength", "remove", "clear", "merge"];
const arrayGetterMethods = ["slice", "indexOf", "find", "compare"];

export default class ArrayWrapper {
    constructor(wrappedArray, holderContext) {
        this[innerArray] = wrappedArray;
        this[listeners] = [];
        this[modelConstructor] = ModelWrapper;
        this[context] = holderContext;
        this[updateable] = false;
        this[constructorProps] = [holderContext];
        this[destroyed] = false;

        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed array.");
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
        
        let self = this;

        this[Symbol.iterator] = () => {
            let index = 0;
            return {
                next() {
                    return {
                        done: index === target.length,
                        get(){
                            return self.getElement[index++]
                        },
                        set(value){
                            self.setElement(index, value);
                        }
                    }
                }
            }
        }
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
                return (Function.prototype.bind.apply(this[modelConstructor], [this, returnElement, ...this[constructorProps]]));
            }
        } else {
            return returnElement;
        }
    }

    get length() {
        this[checkDestroyed]();

        return this[innerArray].length;
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