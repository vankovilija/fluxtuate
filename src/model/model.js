import getOwnKeys from "../utils/getOwnKeys"
import forEachPrototype from "../utils/forEachPrototype"
import {primaryKey, properties, elementResponsible, configureDefaultValues} from "./_internals"
import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {destroy} from "../event-dispatcher/_internals"
import {isFunction, isObject, cloneDeep} from "lodash/lang"
import reservedWords from "./reserved"
import {autobind} from "core-decorators"
import deepData from "./deep-data"

const data = Symbol("fluxtuateModel_data");
const calculatedFields = Symbol("fluxtuateModel_calculatedFields");
const dispatchUpdate = Symbol("fluxtuateModel_dispatchUpdate");
const isDefault = Symbol("fluxtuateModel_isDefault");
const propertiesCache = Symbol("fluxtuateModel_propertiesCache");
const dataCache = Symbol("fluxtuateModel_dataCache");
const cleanDataCache = Symbol("fluxtuateModel_cleanDataCache");
const dataCacheValid = Symbol("fluxtuateModel_cacheValid");
const cleanCacheValid = Symbol("fluxtuateModel_cleanCacheValid");

@autobind
export default class Model extends RetainEventDispatcher {
    constructor(modelName) {
        super();
        this[data] = {};
        this[dataCacheValid] = false;
        this[cleanCacheValid] = false;

        this[propertiesCache] = {};

        forEachPrototype(this, (proto)=>{
            if(Object.getOwnPropertySymbols(proto).indexOf(properties) !== -1)
                this[propertiesCache] = Object.assign(this[propertiesCache], cloneDeep(proto[properties]));
        }, Model);

        this[configureDefaultValues] = ()=> {
            let shouldUpdate = false;
            let props = this[propertiesCache];
            for (let k in props) {
                let keyDescriptor = Object.getOwnPropertyDescriptor(this, props[k].modelKey);
                if(keyDescriptor && keyDescriptor.configurable) {
                    if(this[props[k].modelKey] !== undefined && props[k].defaultValue === undefined)
                        props[k].defaultValue = this[props[k].modelKey];

                    let self = this;
                    Object.defineProperty(this, props[k].modelKey, {
                        get() {
                            return self[data][k];
                        },
                        configurable: false
                    });
                }

                if (props[k].defaultValue !== undefined && this[data][k] === undefined) {
                    this[data][k] = props[k].convert(props[k].defaultValue);
                    shouldUpdate = true;
                    if(this[data][k] && isFunction(this[data][k].addListener)){
                        props[k].listener = this[data][k].addListener("update", (ev, payload)=>{
                            this[dispatchUpdate](payload[elementResponsible]);
                        }, 0, false);
                    }
                    props[k][isDefault] = true;
                }
            }
            if(shouldUpdate){
                this[dispatchUpdate](this);
            }
        };

        setTimeout(this[configureDefaultValues], 0);

        Object.defineProperty(this, "modelData", {
            get() {
                if(!this[dataCacheValid]){
                    let calcs = {};
                    this[calculatedFields].forEach((k)=> {
                        calcs[k] = this[k];
                    });
                    let mData = {};
                    let props = this[propertiesCache];
                    for (let k in props) {
                        if (this[data][k] !== undefined) {
                            mData[k] = this[data][k];
                        } else {
                            mData[k] = props[k].convert(props[k].defaultValue);
                        }
                    }

                    this[dataCache] = deepData(Object.assign(mData, calcs), "modelData");
                    this[dataCacheValid] = true;
                }

                return this[dataCache];
            }
        });

        Object.defineProperty(this, "cleanData", {
            get() {
                if(!this[cleanCacheValid]) {
                    let calcs = {};
                    this[calculatedFields].forEach((k)=> {
                        calcs[k] = this[k];
                    });
                    let mData = {};
                    let props = this[propertiesCache];
                    for (let k in props) {
                        if (this[data][k] && !props[k][isDefault])
                            mData[k] = this[data][k];
                    }

                    this[cleanDataCache] = deepData(Object.assign(mData, calcs), "cleanData");
                    this[cleanCacheValid] = true;
                }

                return this[cleanDataCache];
            }
        });

        Object.defineProperty(this, "modelName", {
            get() {
                return modelName;
            }
        });

        this[calculatedFields] = [];

        let descr = {};
        forEachPrototype(this, (proto)=>{
            descr = Object.assign(descr, Object.getOwnPropertyDescriptors(proto));
        }, Model);

        Object.keys(descr).forEach((key)=> {
            if (reservedWords.indexOf(key) !== -1) return;

            if (descr[key].get) {
                this[calculatedFields].push(key);
            }
        });

        this[dispatchUpdate] = function (elementR) {
            this[cleanCacheValid] = false;
            this[dataCacheValid] = false;
            let payload = {data: this.modelData, name: this.modelName};
            payload[elementResponsible] = elementR;
            this.dispatch("update", payload);
        }
    }

    setKeyValue(modelKey, v, elementR) {
        let props = this[propertiesCache];
        let key;
        for(let k in props) {
            if(props.hasOwnProperty(k) && props[k].modelKey === modelKey){
                key = k;
                break;
            }
        }

        if(!key) return;

        let value = v;
        if(value.modelData) {
            value = value.modelData;
        }

        if(props[key].listener){
            props[key].listener.remove();
            props[key].listener = undefined;
        }
        
        if (this[data][key] && isFunction(this[data][key].setValue)) {
            this[data][key].setValue(value, elementR);
        } else {
            this[data][key] = props[key].convert(value, this.modelName, key);
        }

        if(this[data][key] && isFunction(this[data][key].addListener)){
            props[key].listener = this[data][key].addListener("update", (ev, payload)=>{
                this[dispatchUpdate](payload[elementResponsible]);
            }, 0, false);
        }

        props[key][isDefault] = false;

        this[dispatchUpdate](elementR);
    }

    setValue(v, elementResponsible) {
        let value = v;
        if(value.modelData) {
            value = value.modelData;
        }

        this.clear();
        this.update(value, elementResponsible);
    }

    update(updateData, elementR) {
        if (updateData.cleanData) {
            updateData = updateData.cleanData;
        }else if(updateData.modelData) {
            updateData = updateData.modelData;
        }

        let keys = getOwnKeys(updateData);

        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let props = this[propertiesCache];

            if(!props[key])
                continue;

            let modelKey = key;
            if (isObject(props[key])) {
                let potentialKeyValue = updateData[key];
                if (this[data][key] && isFunction(this[data][key].update)) {
                    this[data][key].update(potentialKeyValue);
                } else {
                    if (isFunction(props[key].convert))
                        potentialKeyValue = props[key].convert(updateData[key], this.modelName, key);

                    modelKey = props[key].modelKey;
                    if (this[data][key] && isFunction(this[data][key].merge) && isFunction(potentialKeyValue.merge)) {
                        this[data][key].merge(elementR, potentialKeyValue);
                    } else {
                        this[data][key] = potentialKeyValue;
                    }
                }
            } else {
                this[data][key] = updateData[key];
            }

            if(props[key].listener){
                props[key].listener.remove();
                props[key].listener = undefined;
            }
            
            if(this[data][key] && isFunction(this[data][key].addListener)){
                props[key].listener = this[data][key].addListener("update", (ev, payload)=>{
                    this[dispatchUpdate](payload[elementResponsible]);
                }, 0, false);
            }

            let keyDescriptor = Object.getOwnPropertyDescriptor(this, props[key].modelKey);
            if(keyDescriptor && keyDescriptor.configurable) {
                let self = this;
                Object.defineProperty(this, modelKey, {
                    get() {
                        return self[data][key];
                    },
                    configurable: false
                });
            }

            props[key][isDefault] = false;
        }

        this[dispatchUpdate](elementR);
    }

    clear(elementResponsible) {
        let props = this[propertiesCache];
        for(let key in props){
            if(props[key] && props[key].listener){
                props[key].listener.remove();
                props[key].listener = undefined;
            }
        }
        for(let key in this[data]){
            if(this[data][key] && this[data][key].destroy){
                this[data][key].destroy();
            }
        }
        this[data] = {};
        this[configureDefaultValues]();
        if(elementResponsible){
            this[dispatchUpdate](elementResponsible);
        }
    }

    compare(model) {
        if (!(model instanceof this.constructor)) {
            return false;
        }

        return this[this[primaryKey]] === model[model[primaryKey]];
    }

    onUpdate(callback) {
        return this.addListener("update", (ev, payload) => {
            callback(payload)
        });
    }

    destroy() {
        this.clear();
        this[destroy]();
    }
}