import EventDispatcher from "../event-dispatcher"
import deepData from "./deep-data"
import {primaryKey, elementResponsible} from "./_internals"
import {isFunction} from "lodash/lang"

const innerArray = Symbol("fluxtuateObservableArray_innerArray");
const sendUpdate = Symbol("fluxtuateObservableArray_sendUpdate");
const listeners = Symbol("fluxtuateObservableArray_listeners");
const arrayName = Symbol("fluxtuateObservableArray_arrayName");
const destroyed = Symbol("fluxtuateObservableArray_destroyed");
const checkDestroyed = Symbol("fluxtuateObservableArray_checkDestroyed");
const elementListeners = Symbol("fluxtuateObservableArray_elementListeners");
const configureElementListeners = Symbol("fluxtuateObservableArray_configureElementListeners");
const arraySetterMethods = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift"];
const arrayGetterMethods = ["slice", "indexOf"];

export default class ObservableArray extends EventDispatcher{
    constructor(wrappedArray, name) {
        super();
        this[arrayName] = name;
        this[innerArray] = wrappedArray;
        this[listeners] = [];
        this[destroyed] = false;
        this[elementListeners] = [];
        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed array!");
            }
        };
        this[configureElementListeners] = () => {
            this[innerArray].forEach((elem, index)=>{
                if(!this[elementListeners][index]){
                    this[elementListeners][index] = {};
                }

                if(this[elementListeners][index].elem !== elem) {
                    if(this[elementListeners][index].elem && isFunction(this[elementListeners][index].elem.destroy)){
                        this[elementListeners][index].elem.destroy();
                    }
                    if(this[elementListeners][index].listener){
                        this[elementListeners][index].listener.remove();
                        this[elementListeners][index].listener = undefined;
                    }
                    if(elem && isFunction(elem.onUpdate)) {
                        this[elementListeners][index].elem = elem;
                        this[elementListeners][index].listener = elem.onUpdate((payload)=>{
                            this[sendUpdate](payload[elementResponsible]);
                        });
                    }else{
                        this[elementListeners][index].elem = undefined;
                    }
                }
            });

            while(this[innerArray].length < this[elementListeners].length) {
                this[elementListeners].pop();
            }
        };

        this[sendUpdate] = (elementR)=>{
            this[configureElementListeners]();
            let payload = {
                data: this.modelData, name: this.modelName
            };
            payload[elementResponsible] = elementR;
            this.dispatch("update", payload);
        };
        arraySetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (elementR, ...args)=>{
                    this[checkDestroyed]();

                    let returnValue = this[innerArray][methodName].apply(this[innerArray], args);
                    this[sendUpdate](elementR);
                    return returnValue;
                },
                configurable: false
            })
        });
        arrayGetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
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
        return this[arrayName];
    }
    
    getElement(id) {
        this[checkDestroyed]();

        return this[innerArray][id];
    }
    
    setElement(elementR, id, value) {
        this[checkDestroyed]();

        this[innerArray][id] = value;
        this[sendUpdate](elementR);
    }

    get length() {
        this[checkDestroyed]();

        return this[innerArray].length;
    }

    setLength(elementR, value) {
        this[checkDestroyed]();

        this[innerArray].length = value;
        this[sendUpdate](elementR);
    }

    onUpdate(callback) {
        this[checkDestroyed]();

        let listener = this.addListener("update", (ev, payload)=>{
            callback(payload);
        });

        this[listeners].push(listener);
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

    find(id){
        this[checkDestroyed]();

        for(let i = 0; i < this[innerArray].length; i++) {
            let v = this[innerArray][i];
            if(v[primaryKey]){
                if(v[v[primaryKey]] == id)
                    return v;
            }else if(v.id){
                if(v.id == id)
                    return v;
            }
        }
        return undefined;
    }

    remove(elementR, id) {
        this[checkDestroyed]();

        let newArray = this[innerArray];
        let elem = newArray.find(id);
        if(elem) {
            newArray.splice(newArray.indexOf(elem), 1);
        }

        this[sendUpdate](elementR);

        return newArray;
    }

    clear(elementR) {
        this[checkDestroyed]();

        this[innerArray] = [];
        this[sendUpdate](elementR);
    }

    merge(elementR, secondArray) {
        this[checkDestroyed]();

        let newArray = this[innerArray];
        secondArray.forEach((elem)=>{
            if(elem[primaryKey]) {
                let realElem = newArray.find(elem[elem[primaryKey]]);
                if(realElem) {
                    if(isFunction(realElem.update))
                        realElem.update(elem.cleanData);
                    else{
                        newArray.splice(newArray.indexOf(realElem), 1, elem);
                    }
                }else{
                    newArray.push(elem);
                }
            }else{
                newArray.push(elem);
            }
        });

        this[sendUpdate](elementR);
    }

    compare(secondArray) {
        this[checkDestroyed]();

        if(this[innerArray].length !== secondArray.length) return false;

    }

    destroy() {
        if(this[destroyed]) return;

        this[listeners].forEach((listener)=>{
            listener.remove();
        });

        this[elementListeners].forEach((elListener) => {
            if(elListener.listener){
                elListener.listener.remove();
            }
        });
        this[destroyed] = true;
    }
}