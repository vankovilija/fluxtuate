import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import deepData from "./deep-data"
import {primaryKey, elementResponsible} from "./_internals"
import {isFunction} from "lodash/lang"
import {destroy} from "../event-dispatcher/_internals"

const innerArray = Symbol("fluxtuateObservableArray_innerArray");
const innerArrayIndex = Symbol("fluxtuateObservableArray_innerArrayIndex");
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
const updateTimeout = Symbol("fluxtuateObservableArray_updateTimeout");

const arraySetterMethods = ["pop", "push", "reverse", "shift", "sort", "splice", "unshift", "copyWithin", "fill"];
const arrayGetterMethods = ["slice", "indexOf", "lastIndexOf", "map", "reduce", "reduceRight", "filter", "concat", "includes", "join"];

const oArrayCache = [];

export default class ObservableArray extends RetainEventDispatcher{
    static getInstance(wrappedArray, name, parentName, arrayConverterFunction) {
        let oArray;
        if(oArrayCache.length > 0) {
            oArray = oArrayCache.shift();
            oArray[arrayConverter] = arrayConverterFunction;
            oArray[arrayParent] = parentName;
            oArray[arrayName] = name;
            oArray[innerArray] = wrappedArray;
            oArray[innerArrayIndex] = {};
            oArray[destroyed] = false;
            oArray[dataCacheValid] = false;
            oArray[cleanDataCacheValid] = false;
            oArray[configureElementListeners]();
        }else{
            oArray = new ObservableArray(wrappedArray, name, parentName, arrayConverterFunction);
        }

        return oArray;
    }

    constructor(wrappedArray, name, parentName, arrayConverterFunction) {
        super();
        this[arrayConverter] = arrayConverterFunction;
        this[arrayParent] = parentName;
        this[arrayName] = name;
        this[innerArray] = wrappedArray;
        this[innerArrayIndex] = {};
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
        this[configureElementListeners] = (oldData = []) => {
            if(oldData === this[innerArray]) return;

            let removedElementsCount = 0;
            oldData.forEach((elem, index)=>{
                if(this[innerArray].indexOf(elem) === -1) {
                    let lObject = this[elementListeners].splice(index - removedElementsCount, 1)[0];
                    removedElementsCount ++;

                    if(lObject.listener) {
                        lObject.listener.remove();
                    }

                    if(elem[primaryKey] && elem[elem[primaryKey]]) {
                        this[innerArrayIndex][elem[elem[primaryKey]]] = undefined;
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
                    if(this[elementListeners][index].elem) {
                        if (this[elementListeners][index].elem[primaryKey] && this[elementListeners][index].elem[this[elementListeners][index].elem[primaryKey]]) {
                            this[innerArrayIndex][this[elementListeners][index].elem[this[elementListeners][index].elem[primaryKey]]] = undefined;
                        }
                        if (isFunction(this[elementListeners][index].elem.destroy)) {
                            this[elementListeners][index].elem.destroy();
                        }
                    }
                    if(this[elementListeners][index].listener){
                        this[elementListeners][index].listener.remove();
                        this[elementListeners][index].listener = undefined;
                    }
                    if(elem[primaryKey] && elem[elem[primaryKey]]) {
                        this[innerArrayIndex][elem[elem[primaryKey]]] = elem;
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
            if(this[destroyed]) return;

            if(this[updateTimeout]) {
                clearTimeout(this[updateTimeout]);
                this[updateTimeout] = null;
            }

            this[updateTimeout] = setTimeout(()=>{
                this[dataCacheValid] = false;
                this[cleanDataCacheValid] = false;
                this[configureElementListeners](oldData);
                let payload = {
                    data: this.modelData, name: this.modelName
                };
                payload[elementResponsible] = elementR;
                this.dispatch("update", payload);
            }, 100);
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

        this[configureElementListeners]();
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
    
    setElement(elementR, id, v) {
        this[checkDestroyed]();

        let value = v;
        if(value.modelData) {
            value = value.modelData;
        }

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

        return this[innerArrayIndex][id];
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

        if(this[updateTimeout]) {
            clearTimeout(this[updateTimeout]);
            this[updateTimeout] = null;
        }

        this[listeners].forEach((listener)=>{
            listener.remove();
        });

        this.clear(this);

        this[elementListeners].forEach((elListener) => {
            if(elListener.listener){
                elListener.listener.remove();
            }
            if(elListener.elem && elListener.elem.destroy){
                elListener.elem.destroy();
            }
        });
        this[destroyed] = true;
        this[destroy]();
        oArrayCache.push(this);
    }
}