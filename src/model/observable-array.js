import EventDispatcher from "../event-dispatcher"
import deepData from "./deep-data"
import {primaryKey, elementResponsible} from "./_internals"
import {isFunction} from "lodash/lang"
import {destroy} from "../event-dispatcher/_internals"

const innerArray = Symbol("fluxtuateObservableArray_innerArray");
const sendUpdate = Symbol("fluxtuateObservableArray_sendUpdate");
const listeners = Symbol("fluxtuateObservableArray_listeners");
const arrayName = Symbol("fluxtuateObservableArray_arrayName");
const destroyed = Symbol("fluxtuateObservableArray_destroyed");
const checkDestroyed = Symbol("fluxtuateObservableArray_checkDestroyed");
const elementListeners = Symbol("fluxtuateObservableArray_elementListeners");
const arrayConverter = Symbol("fluxtuateObservableArray_arrayConvertor");
const arrayParent = Symbol("fluxtuateObservableArray_arrayParent");
const configureElementListeners = Symbol("fluxtuateObservableArray_configureElementListeners");
const arraySetterMethods = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift"];
const arrayGetterMethods = ["slice", "indexOf", "map"];

export default class ObservableArray extends EventDispatcher{
    constructor(wrappedArray, name, parentName, arrayConverterFunction) {
        super();
        this[arrayConverter] = arrayConverterFunction;
        this[arrayParent] = parentName;
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
        this[configureElementListeners] = (oldData) => {
            if(oldData === this[innerArray]) return;

            this[innerArray].forEach((elem, index)=>{
                if(oldData.indexOf(elem) !== -1) return;

                elem = this[arrayConverter](elem, this[arrayParent], `${this[arrayName]}[${index}]`);
                this[innerArray][index] = elem;

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
                    if(elem && isFunction(elem.addListener)) {
                        this[elementListeners][index].elem = elem;
                        this[elementListeners][index].listener = elem.addListener("update", (ev, payload)=>{
                            this[sendUpdate](payload[elementResponsible], this[innerArray]);
                        }, 0, false);
                    }else{
                        this[elementListeners][index].elem = undefined;
                    }
                }
            });

            while(this[innerArray].length < this[elementListeners].length) {
                let lObject = this[elementListeners].pop();

                if(lObject.listener) {
                    lObject.listener.remove();
                }

                if(lObject.elem && isFunction(lObject.elem.destroy)){
                    lObject.elem.destroy();
                }
            }

            oldData.forEach((elem)=>{
                if(this[innerArray].indexOf(elem) === -1) {
                    if(elem.destroy) {
                        elem.destroy();
                    }
                }
            });
        };

        this[sendUpdate] = (elementR, oldData)=>{
            this[configureElementListeners](oldData);
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

                    let oldData = this[innerArray];
                    this[innerArray] = this[innerArray].slice();
                    let returnValue = this[innerArray][methodName].apply(this[innerArray], args);
                    this[sendUpdate](elementR, oldData);
                    return returnValue;
                },
                configurable: false
            })
        });
        arrayGetterMethods.forEach((methodName)=>{
            Object.defineProperty(this, methodName, {
                value: (...args)=>{
                    return this.modelData[methodName].apply(this[innerArray], args);
                },
                configurable: false
            })
        });
    }

    forEach(callback) {
        if(!isFunction(callback)){
            throw new Error("You must supply a function to the forEach method of arrays!");
        }

        for(let i = 0; i < this[innerArray].length; i++) {
            callback(this.getElement(i), i);
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

        let oldData = this[innerArray];
        this[innerArray] = this[innerArray].slice();
        this[innerArray][id] = this[arrayConverter](value, this[arrayParent], `${this[arrayName]}[${id}]`);
        this[sendUpdate](elementR, oldData);
    }

    get length() {
        this[checkDestroyed]();

        return this[innerArray].length;
    }

    setLength(elementR, value) {
        this[checkDestroyed]();

        let oldArray = this[innerArray];
        this[innerArray] = this[innerArray].slice();
        this[innerArray].length = value;
        this[sendUpdate](elementR, oldArray);
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

        let oldArray = this[innerArray];
        this[innerArray] = this[innerArray].slice();

        let newArray = this[innerArray];
        let elem = newArray.find(id);
        if(elem) {
            newArray.splice(newArray.indexOf(elem), 1);
        }

        this[sendUpdate](elementR, oldArray);

        return newArray;
    }

    clear(elementR) {
        this[checkDestroyed]();

        let oldArray = this[innerArray];
        this[innerArray] = [];
        this[sendUpdate](elementR, oldArray);
    }

    merge(elementR, secondArray) {
        this[checkDestroyed]();

        let oldArray = this[innerArray];
        let newArray = this[innerArray].slice();
        secondArray.forEach((elem)=>{
            if(elem[primaryKey]) {
                let realElem = this.find(elem[elem[primaryKey]]);
                if(realElem) {
                    if(isFunction(realElem.update))
                        realElem.update(elem.cleanData, elementR);
                    else{
                        newArray.splice(newArray.indexOf(realElem), 1, elem);
                    }
                }else{
                    elem = this[arrayConverter](elem, this[arrayParent], `${this[arrayName]}[${newArray.length}]`);
                    newArray.push(elem);
                }
            }else{
                elem = this[arrayConverter](elem, this[arrayParent], `${this[arrayName]}[${newArray.length}]`);
                newArray.push(elem);
            }
        });

        this[innerArray] = newArray;

        this[sendUpdate](elementR, oldArray);
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
            if(elListener.elem.destroy){
                elListener.elem.destroy();
            }
        });
        this[destroyed] = true;
        this[destroy]();
    }
}