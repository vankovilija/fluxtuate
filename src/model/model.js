import getOwnKeys from "../utils/getOwnKeys"
import forEachPrototype from "../utils/forEachPrototype"
import {primaryKey, properties, elementResponsible} from "./_internals"
import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {destroy} from "../event-dispatcher/_internals"
import {isFunction, isObject} from "lodash/lang"
import reservedWords from "./reserved"
import {autobind} from "core-decorators"
import deepData from "./deep-data"

const data = Symbol("fluxtuateModel_data");
const calculatedFields = Symbol("fluxtuateModel_calculatedFields");
const dispatchUpdate = Symbol("fluxtuateModel_dispatchUpdate");
const configureDefaultValues = Symbol("fluxtuateModel_configureDefaultValues");
const isDefault = Symbol("fluxtuateModel_isDefault");

@autobind
export default class Model extends RetainEventDispatcher {
    constructor(modelName) {
        super();
        this[data] = {};

        this[configureDefaultValues] = ()=> {
            for (let k in this[properties]) {
                let keyDescriptor = Object.getOwnPropertyDescriptor(this, this[properties][k].modelKey);
                if(keyDescriptor && keyDescriptor.configurable) {
                    let self = this;
                    Object.defineProperty(this, this[properties][k].modelKey, {
                        get() {
                            return self[data][k];
                        },
                        configurable: false
                    });
                    
                    if(this[this[properties][k].modelKey] !== undefined && this[properties][k].defaultValue === undefined)
                        this[properties][k].defaultValue = this[this[properties][k].modelKey];
                }

                if (this[properties][k].defaultValue !== undefined && this[data][k] === undefined) {
                    this[data][k] = this[properties][k].convert(this[properties][k].defaultValue);
                    if(this[data][k] && isFunction(this[data][k].addListener)){
                        this[properties][k].listener = this[data][k].addListener("update", (ev, payload)=>{
                            this[dispatchUpdate](payload[elementResponsible]);
                        }, 0, false);
                    }
                    this[properties][k][isDefault] = true;
                }
            }
        };

        setTimeout(this[configureDefaultValues], 0);

        Object.defineProperty(this, "modelData", {
            get() {
                let calcs = {};
                this[calculatedFields].forEach((k)=> {
                    calcs[k] = this[k];
                });
                let mData = {};
                for (let k in this[properties]) {
                    if (this[data][k] !== undefined)
                        mData[k] = this[data][k];
                    else {
                        mData[k] = this[properties][k].convert(this[properties][k].defaultValue);
                    }
                }

                return deepData(Object.assign(mData, calcs), "modelData");
            }
        });

        Object.defineProperty(this, "cleanData", {
            get() {
                let calcs = {};
                this[calculatedFields].forEach((k)=> {
                    calcs[k] = this[k];
                });
                let mData = {};
                for (let k in this[properties]) {
                    if (this[data][k] && !this[properties][k][isDefault])
                        mData[k] = this[data][k];
                }

                return deepData(Object.assign(mData, calcs), "cleanData");
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
            let payload = {data: this.modelData, name: this.modelName};
            payload[elementResponsible] = elementR;
            this.dispatch("update", payload);
        }
    }

    setKeyValue(key, value, elementR) {
        if(this[properties][key].listener){
            this[properties][key].listener.remove();
            this[properties][key].listener = undefined;
        }
        
        if (this[data][key] && isFunction(this[data][key].setValue)) {
            this[data][key].setValue(value, elementR);
        } else {
            this[data][key] = this[properties][key].convert(value, this.modelName, key);
        }

        if(this[data][key] && isFunction(this[data][key].addListener)){
            this[properties][key].listener = this[data][key].addListener("update", (ev, payload)=>{
                this[dispatchUpdate](payload[elementResponsible]);
            }, 0, false);
        }

        this[properties][key][isDefault] = false;

        this[dispatchUpdate](elementR);
    }

    setValue(value, elementResponsible) {
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

            if(!this[properties][key])
                continue;

            let modelKey = key;
            if (isObject(this[properties][key])) {
                let potentialKeyValue = updateData[key];
                if (this[data][key] && isFunction(this[data][key].update)) {
                    this[data][key].update(potentialKeyValue);
                } else {
                    if (isFunction(this[properties][key].convert))
                        potentialKeyValue = this[properties][key].convert(updateData[key], this.modelName, key);

                    modelKey = this[properties][key].modelKey;
                    if (this[data][key] && isFunction(this[data][key].merge) && isFunction(potentialKeyValue.merge)) {
                        this[data][key].merge(elementR, potentialKeyValue);
                    } else {
                        this[data][key] = potentialKeyValue;
                    }
                }
            } else {
                this[data][key] = updateData[key];
            }

            if(this[properties][key].listener){
                this[properties][key].listener.remove();
                this[properties][key].listener = undefined;
            }
            
            if(this[data][key] && isFunction(this[data][key].addListener)){
                this[properties][key].listener = this[data][key].addListener("update", (ev, payload)=>{
                    this[dispatchUpdate](payload[elementResponsible]);
                }, 0, false);
            }

            let keyDescriptor = Object.getOwnPropertyDescriptor(this, this[properties][key].modelKey);
            if(keyDescriptor && keyDescriptor.configurable) {
                let self = this;
                Object.defineProperty(this, modelKey, {
                    get() {
                        return self[data][key];
                    },
                    configurable: false
                });
            }

            this[properties][key][isDefault] = false;
        }

        this[dispatchUpdate](elementR);
    }

    clear(elementResponsible) {
        for(let key in this[properties]){
            if(this[properties][key] && this[properties][key].listener){
                this[properties][key].listener.remove();
                this[properties][key].listener = undefined;
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
        if (!(model instanceof this.prototype)) {
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