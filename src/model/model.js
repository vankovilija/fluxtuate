import getOwnKeys from "../utils/getOwnKeys"
import forEachPrototype from "../utils/forEachPrototype"
import {primaryKey, properties, elementResponsible, configureDefaultValues} from "./_internals"
import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {destroy} from "../event-dispatcher/_internals"
import {isFunction, isObject} from "lodash/lang"
import reservedWords from "./reserved"
import {autobind} from "core-decorators"
import deepData from "./deep-data"

const calculatedCache = Symbol("fluxtuateModel_calculatedCache");
const calculatedCacheValid = Symbol("fluxtuateModel_calculatedCacheValid");
const data = Symbol("fluxtuateModel_data");
const calculatedFields = Symbol("fluxtuateModel_calculatedFields");
const dispatchUpdate = Symbol("fluxtuateModel_dispatchUpdate");
const isDefault = Symbol("fluxtuateModel_isDefault");
const propertiesCache = Symbol("fluxtuateModel_propertiesCache");
const dataCache = Symbol("fluxtuateModel_dataCache");
const cleanDataCache = Symbol("fluxtuateModel_cleanDataCache");
const dataCacheValid = Symbol("fluxtuateModel_cacheValid");
const cleanCacheValid = Symbol("fluxtuateModel_cleanCacheValid");
const mName = Symbol("fluxtuateModel_mName");
const updateTimeout = Symbol("fluxtuateModel_updateTimeout");

const pCacheIndex = [];
const pCache = [];

function getPropertiesCache(model) {
    let proto = Object.getPrototypeOf(model);
    let pCacheI = pCacheIndex.indexOf(proto);
    let returnCache;
    if(pCacheI === -1) {
        returnCache = {};
        forEachPrototype(model, (proto)=>{
            if(Object.getOwnPropertySymbols(proto).indexOf(properties) !== -1)
                returnCache = Object.assign(returnCache, proto[properties]);
        }, Model);

        pCache.push(returnCache);
        pCacheIndex.push(proto);
    } else {
        returnCache = pCache[pCacheI];
    }

    let realReturnCache = {};
    let keys = Object.keys(returnCache);
    for(let i = 0; i < keys.length; i++) {
        realReturnCache[keys[i]] = Object.assign({}, returnCache[keys[i]]);
    }

    return realReturnCache;
}

const iCacheIndex = [];
const iCache = [];

function getCacheForType(modelType) {
    let iCacheI = iCacheIndex.indexOf(modelType);
    let modelCache;

    if(iCacheI === -1) {
        modelCache = [];
        iCacheIndex.push(modelType);
        iCache.push(modelCache);
    }else {
        modelCache = iCache[iCacheI];
    }

    return modelCache;
}

@autobind
export default class Model extends RetainEventDispatcher {
    static getInstance(modelType, modelName) {
        let cache = getCacheForType(modelType);
        let model;
        if(cache.length > 0) {
            model = cache.shift();
            model[dataCacheValid] = false;
            model[cleanCacheValid] = false;
            model[calculatedCacheValid] = false;
            model[mName] = modelName;
            model[configureDefaultValues]();
        } else {
            model = new modelType(modelName);
            let props = model[propertiesCache];
            for (let k in props) {
                if (model[props[k].modelKey] !== undefined && props[k].defaultValue === undefined)
                    props[k].defaultValue = model[props[k].modelKey];
            }
            model[configureDefaultValues]();
        }

        return model;
    }

    constructor(modelName) {
        super();
        this[mName] = modelName;
        this[data] = {};
        this[dataCacheValid] = false;
        this[cleanCacheValid] = false;
        this[calculatedCacheValid] = false;

        this[calculatedCache] = {};

        this[propertiesCache] = getPropertiesCache(this);

        this[configureDefaultValues] = ()=> {
            let shouldUpdate = false;
            let props = this[propertiesCache];
            for (let k in props) {
                let keyDescriptor = Object.getOwnPropertyDescriptor(this, props[k].modelKey);
                if(keyDescriptor && keyDescriptor.configurable) {
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

        Object.defineProperty(this, "modelData", {
            get() {
                if(!this[calculatedCacheValid]) {
                    this[calculatedFields].forEach((k) => {
                        this[calculatedCache][k] = this[k];
                    });
                    this[calculatedCacheValid] = true;
                    this[dataCacheValid] = false;
                    this[cleanCacheValid] = false;
                }
                if(!this[dataCacheValid]){
                    let calcs = this[calculatedCache];
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
                if(!this[calculatedCacheValid]) {
                    this[calculatedFields].forEach((k) => {
                        this[calculatedCache][k] = this[k];
                    });
                    this[calculatedCacheValid] = true;
                    this[dataCacheValid] = false;
                    this[cleanCacheValid] = false;
                }
                if(!this[cleanCacheValid]) {
                    let calcs = this[calculatedCache];
                    let mData = {};
                    let props = this[propertiesCache];
                    for (let k in props) {
                        if (this[data][k] !== undefined && !props[k][isDefault])
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
                return this[mName];
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
            if(this[updateTimeout]) {
                clearTimeout(this[updateTimeout]);
                this[updateTimeout] = null;
            }

            this[calculatedCacheValid] = false;
            this[cleanCacheValid] = false;
            this[dataCacheValid] = false;

            this[updateTimeout] = setTimeout(()=>{
                if(!this[calculatedCacheValid]) {
                    this[calculatedFields].forEach((k) => {
                        this[calculatedCache][k] = this[k];
                    });
                    this[calculatedCacheValid] = true;
                }

                let payload = {data: this.modelData, name: this.modelName};
                payload[elementResponsible] = elementR;

                this.dispatch("update", payload);

                this[updateTimeout] = null;
            }, 100);
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

        if(key === undefined) return;

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
            if(this[data][key] && isFunction(this[data][key].destroy)) {
                this[data][key].destroy();
            }
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

            if(props[key] === undefined)
                continue;

            let modelKey = key;
            if (isObject(props[key])) {
                let potentialKeyValue = updateData[key];
                if(potentialKeyValue && potentialKeyValue.modelData) {
                    potentialKeyValue = potentialKeyValue.modelData;
                }
                if (this[data][key] && isFunction(this[data][key].update)) {
                    this[data][key].update(potentialKeyValue);
                } else {
                    if (isFunction(props[key].convert)) {
                        potentialKeyValue = props[key].convert(potentialKeyValue, this.modelName, key);
                    }

                    modelKey = props[key].modelKey;
                    if (
                        this[data][key] !== undefined &&
                        isFunction(this[data][key].merge) &&
                        potentialKeyValue !== undefined &&
                        isFunction(potentialKeyValue.merge)
                    ) {
                        this[data][key].merge(elementR, potentialKeyValue);
                    } else if(potentialKeyValue !== undefined){
                        if(this[data][key] && isFunction(this[data][key].destroy)) {
                            this[data][key].destroy();
                        }
                        this[data][key] = potentialKeyValue;
                    }
                }
            } else {
                if(this[data][key] && isFunction(this[data][key].destroy)) {
                    this[data][key].destroy();
                }
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
        this.clear(this);
        this[destroy]();
        let cache = getCacheForType(Object.getPrototypeOf(this));
        cache.push(this);

        if(this[updateTimeout]) {
            clearTimeout(this[updateTimeout]);
            this[updateTimeout] = null;
        }
    }
}