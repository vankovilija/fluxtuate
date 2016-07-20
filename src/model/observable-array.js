import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
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
const dataCache = Symbol("fluxtuateObservableArray_dataCache");
const cleanDataCache = Symbol("fluxtuateObservableArray_cleanDataCache");
const dataCacheValid = Symbol("fluxtuateObservableArray_dataCacheValid");
const cleanDataCacheValid = Symbol("fluxtuateObservableArray_cleanDataCacheValid");
const configureElementListeners = Symbol("fluxtuateObservableArray_configureElementListeners");
const arraySetterMethods = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift"];
const arrayGetterMethods = ["slice", "indexOf", "map"];

export default class ObservableArray extends RetainEventDispatcher{
    constructor(wrappedArray, name, parentName, arrayConverterFunction) {
        super();
        this[arrayConverter] = arrayConverterFunction;
        this[arrayParent] = parentName;
        this[arrayName] = name;
        this[innerArray] = wrappedArray;
        this[listeners] = [];
        this[destroyed] = false;
        this[elementListeners] = [];
        this[dataCacheValid] = false;
        this[cleanDataCacheValid] = false;
        this[checkDestroyed] = ()=>{
            if(this[destroyed]){
                throw new Error("You are trying to access a destroyed array!");
            }
        };
        this[configureElementListeners] = (oldData) => {
            if(oldData === this[innerArray]) return;

            oldData.forEach((elem, index)=>{
                if(this[innerArray].indexOf(elem) === -1) {
                    let lObject = this[elementListeners].splice(index, 1)[0];

                    if(lObject.listener) {
                        lObject.listener.remove();
                    }

                    if(elem.destroy) {
                        elem.destroy();
                    }
                }
            });

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
        };

        this[sendUpdate] = (elementR, oldData)=>{
            this[dataCacheValid] = false;
            this[cleanDataCacheValid] = false;
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
                    let dataArray = this.modelData;
                    return dataArray[methodName].apply(dataArray, args);
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

        if(!this[dataCacheValid]) {
            let wrapper = {data: this[innerArray].slice()};
            let deep = deepData(wrapper, "modelData");
            this[dataCache] = deep.data;
            this[dataCacheValid] = true;
        }

        return this[dataCache];
    }

    get cleanData() {
        this[checkDestroyed]();

        if(!this[cleanDataCacheValid]) {
            let wrapper = {data: this[innerArray].slice()};
            let deep = deepData(wrapper, "cleanData");
            this[cleanDataCache] = deep.data;
            this[cleanDataCacheValid] = true;
        }

        return this[cleanDataCache];
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

    findIndex(model) {
        this[checkDestroyed]();

        for(let i = 0; i < this[innerArray].length; i++) {
            if(isFunction(this[innerArray][i].compare)) {
                if (this[innerArray][i].compare(model)) {
                    return i;
                }
            }else{
                if(model == this[innerArray][i]){
                    return i;
                }
            }
        }

        return -1;
    }

    remove(elementR, id) {
        this[checkDestroyed]();

        let oldArray = this[innerArray];
        this[innerArray] = this[innerArray].slice();

        let newArray = this[innerArray];
        let elem = this.find(id);
        if(elem) {
            newArray.splice(newArray.indexOf(elem), 1);
        }

        this[sendUpdate](elementR, oldArray);
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
        secondArray.forEach((elem, index)=>{
            elem = this[arrayConverter](elem, this[arrayParent], `${this[arrayName]}[${index}]`);
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
        
        this[innerArray].forEach((elem, index)=>{
            if(elem.compare) {
                if(!elem.compare(secondArray[index])) return false;
            }else{
                if(elem !== secondArray[index]) return false;
            }
        });
        return true;
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