import getOwnKeys from "../utils/getOwnKeys"
import getOwnPropertyDescriptors from "../utils/getOwnPropertyDescriptors"
import {primaryKey, properties, elementResponsible} from "./_internals"
import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {destroy} from "../event-dispatcher/_internals"
import {isFunction, isObject, isArray, isDate} from "lodash/lang"
import reservedWords from "./reserved"

const data = Symbol("fluxtuateModel_data");
const calculatedFields = Symbol("fluxtuateModel_calculatedFields");
const dispatchUpdate = Symbol("fluxtuateModel_dispatchUpdate");
const configureDefaultValues = Symbol("fluxtuateModel_configureDefaultValues");
const isDefault = Symbol("fluxtuateModel_isDefault");

function processProp(prop, deepDataProperty) {
    if (prop !== null && !isDate(prop)
        && (typeof prop === "object" || typeof prop === "function")
        && !Object.isFrozen(prop)) {
        return deepData(prop, deepDataProperty);
    } else {
        return prop;
    }
}

function deepData(model, deepDataProperty) {
    let o = model;
    if (o[deepDataProperty]) {
        return o[deepDataProperty];
    }

    Object.getOwnPropertyNames(o).forEach(function (prop) {
        if (isArray(o[prop])) {
            let propArray = [];
            o[prop].forEach((propElem)=> {
                propArray.push(processProp(propElem, deepDataProperty));
            });
            o[prop] = propArray;
        } else {
            o[prop] = processProp(o[prop], deepDataProperty);
        }
    });

    Object.freeze(o);

    return o;
}


export default class Model extends RetainEventDispatcher {
    constructor(modelName) {
        super();
        this[data] = {};

        this[configureDefaultValues] = ()=> {
            for (let k in this[properties]) {
                if(this[this[properties][k].modelKey] !== undefined && Object.getOwnPropertyDescriptor(this, this[properties][k].modelKey).configurable) {
                    if(this[properties][k].defaultValue === undefined)
                        this[properties][k].defaultValue = this[properties][k].convert(this[this[properties][k].modelKey]);

                    let self = this;
                    Object.defineProperty(this, this[properties][k].modelKey, {
                        get() {
                            return self[data][k];
                        },
                        configurable: false
                    });
                }

                if (this[properties][k].defaultValue !== undefined && this[data][k] === undefined) {
                    this[data][k] = this[properties][k].defaultValue;
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
                    if (this[data][k])
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

        let descr = getOwnPropertyDescriptors(Object.getPrototypeOf(this));

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

    setValue(value, elementResponsible) {
        this.clear();
        this.update(value, elementResponsible);
    }

    update(updateData, elementResponsible) {
        if (updateData.cleanData) {
            updateData = updateData.cleanData;
        }else if(updateData.modelData) {
            updateData = updateData.modelData;
        }

        let keys = getOwnKeys(updateData);

        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];

            if(!this[properties][key])
                throw new Error(`Trying to set undefined property ${key} that is not defined in model!`);

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
                        this[data][key] = this[data][key].merge(potentialKeyValue);
                    } else {
                        this[data][key] = potentialKeyValue;
                    }
                }
            } else {
                this[data][key] = updateData[key];
            }

            if(Object.getOwnPropertyDescriptor(this, this[properties][key].modelKey).configurable) {
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

        this[dispatchUpdate](elementResponsible);
    }

    clear(elementResponsible) {
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
        this[destroy]();
        this[data] = {};
    }
}