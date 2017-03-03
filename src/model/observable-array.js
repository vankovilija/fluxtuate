import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import deepData from "./deep-data"
import {arrayGetterMethods, arraySetterMethods} from "./array-methods"
import {primaryKey, elementResponsible, dataType} from "./_internals"
import {isFunction, isArray} from "lodash/lang"
import {destroy} from "../event-dispatcher/_internals"

const innerArray = Symbol("fluxtuateObservableArray_innerArray");
const sendUpdate = Symbol("fluxtuateObservableArray_sendUpdate");
const listeners = Symbol("fluxtuateObservableArray_listeners");
const arrayName = Symbol("fluxtuateObservableArray_arrayName");
const elementListeners = Symbol("fluxtuateObservableArray_elementListeners");
const arrayConverter = Symbol("fluxtuateObservableArray_arrayConvertor");
const arrayParent = Symbol("fluxtuateObservableArray_arrayParent");
const dataCache = Symbol("fluxtuateObservableArray_dataCache");
const cleanDataCache = Symbol("fluxtuateObservableArray_cleanDataCache");
const dataCacheValid = Symbol("fluxtuateObservableArray_dataCacheValid");
const cleanDataCacheValid = Symbol("fluxtuateObservableArray_cleanDataCacheValid");
const configureElementListeners = Symbol("fluxtuateObservableArray_configureElementListeners");
const updateTimeout = Symbol("fluxtuateObservableArray_updateTimeout");

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
            oArray[configureElementListeners]();
        }else{
            oArray = new ObservableArray(wrappedArray, name, parentName, arrayConverterFunction);
        }

        return oArray;
    }

    constructor(wrappedArray, name, parentName, arrayConverterFunction) {
        super();
        this[dataType] = "array";
        this[arrayConverter] = arrayConverterFunction;
        this[arrayParent] = parentName;
        this[arrayName] = name;
        this[innerArray] = wrappedArray;
        this[listeners] = [];
        this[elementListeners] = [];
        this[dataCacheValid] = false;
        this[cleanDataCacheValid] = false;
        this[configureElementListeners] = (oldData = []) => {
            if(oldData === this[innerArray]) return;

            let removedElementsCount = 0;
            oldData.forEach((elem, index)=>{
                if(this[innerArray].indexOf(elem) === -1) {
                    let lObject = this[elementListeners].splice(index - removedElementsCount, 1)[0];
                    removedElementsCount ++;

                    if(elem.destroy) {
                        elem.destroy();
                    }

                    if(lObject && lObject.listener) {
                        lObject.listener.remove();
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
                        if (isFunction(this[elementListeners][index].elem.destroy)) {
                            this[elementListeners][index].elem.destroy();
                        }
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
        return this[innerArray][id];
    }
    
    setElement(elementR, id, v) {
        let value = v;
        if(value && value.modelData) {
            value = value.modelData;
        }

        let oldData = this[innerArray];
        this[innerArray] = this[innerArray].slice();
        this[innerArray][id] = this[arrayConverter](value, this[arrayParent], `${this[arrayName]}[${id}]`);
        this[sendUpdate](elementR, oldData);
    }

    get length() {
        return this[innerArray].length;
    }

    setLength(elementR, value) {
        let oldArray = this[innerArray];
        this[innerArray] = this[innerArray].slice();
        this[innerArray].length = value;
        this[sendUpdate](elementR, oldArray);
    }

    onUpdate(callback) {
        let listener = this.addListener("update", (ev, payload)=>{
            callback(payload);
        });

        this[listeners].push(listener);
        return listener;
    }

    get modelData() {
        if(!this[dataCacheValid]) {
            let wrapper = {data: this[innerArray].slice()};
            let deep = deepData(wrapper, "modelData");
            this[dataCache] = deep.data;
            this[dataCacheValid] = true;
        }

        return this[dataCache];
    }

    get cleanData() {
        if(!this[cleanDataCacheValid]) {
            let wrapper = {data: this[innerArray].slice()};
            let deep = deepData(wrapper, "cleanData");
            this[cleanDataCache] = deep.data;
            this[cleanDataCacheValid] = true;
        }

        return this[cleanDataCache];
    }

    find(id){
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
        let oldArray = this[innerArray];
        this[innerArray] = [];
        this[sendUpdate](elementR, oldArray);
    }

    setValue(array, elementR) {
        if(!isArray(array)) {
            throw new Error("Can't set non array value to array property!");
        }
        let oldArray = this[innerArray];
        this[innerArray] = [];
        array.forEach((elem, index)=>{
            elem = this[arrayConverter](elem, this[arrayParent], `${this[arrayName]}[${index}]`);
            this[innerArray].push(elem);
        });

        this[sendUpdate](elementR, oldArray);
    }

    merge(elementR, secondArray) {
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
        this[elementListeners] = [];
        this[listeners] = [];

        this[dataCacheValid] = false;
        this[cleanDataCacheValid] = false;
        this[arrayConverter] = undefined;
        this[arrayParent] = "";
        this[arrayName] = "";
        this[innerArray] = [];

        this[destroy]();

        if(this[updateTimeout]) {
            clearTimeout(this[updateTimeout]);
            this[updateTimeout] = null;
        }

        oArrayCache.push(this);
    }
}