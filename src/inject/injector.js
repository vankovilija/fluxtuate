import {autobind} from "core-decorators"
import getOwnPropertyDescriptors from "../utils/getOwnPropertyDescriptors"
import {getInjectValue, globalValues, defaultValues, injectionKey, isPropertyInjection, injectionValueMap, applyInjectionSignature, getInjectionSignature} from "./_internals"
import {isObject} from "lodash/lang"

const reservedWords = ["view", "payload"];
const injectionPropertyMap = Symbol("fluxtuateInjector_injectionPropertyMap");
const injectionClassMap = Symbol("fluxtuateInjector_injectionClassMap");
const hasInjection = Symbol("fluxtuateInjector_hasInjection");

@autobind
export default class Injector {
    constructor(){
        this[injectionValueMap] = {};
        this[injectionPropertyMap] = {};
        this[injectionClassMap] = {};
        this[defaultValues] = {};
        this[globalValues] = [];
        
        this[getInjectValue] = (iKey, defaultInjection = {})=> {
            let value;
            
            if (this[injectionValueMap][iKey] !== undefined)
                value = this[injectionValueMap][iKey];
            else if (this[injectionPropertyMap][iKey] !== undefined)
                value = this[injectionPropertyMap][iKey];
            else if (this[injectionClassMap][iKey] !== undefined)
                value = this[injectionClassMap][iKey];
            else if (defaultInjection[iKey] !== undefined)
                value = defaultInjection[iKey];

            if(value[isPropertyInjection]){
                this.inject(value.object[value.property]);
            }else {
                this.inject(value);
            }
            
            return value;
        };

        this[applyInjectionSignature] = (instance, signature) => {
            instance[hasInjection] = signature;
        };

        this[getInjectionSignature] = (instance) => {
            return instance[hasInjection];
        };
    }

    hasInjection(iKey) {
        return this[injectionValueMap][iKey] !== undefined ||
            this[injectionPropertyMap][iKey] !== undefined ||
            this[injectionClassMap][iKey] !== undefined;
    }

    mapKey(key) {
        if(reservedWords.indexOf(key) !== -1) throw new Error(`"${key}" is a reserved word, use a different mapping for this value!`);
        if(Object.keys(this[defaultValues]).indexOf(key) !== -1) throw new Error(`"${key}" is a reserved value in the injector! ${this[defaultValues][key]}.`);
        if(this[injectionValueMap][key]) throw new Error(`The key ${key} is already injected to value: ${this[injectionValueMap][key]}`);
        if(this[injectionPropertyMap][key]) throw new Error(`The key ${key} is already injected to value: ${this[injectionPropertyMap][key]}`);
        var self = this;
        return {
            toValue(value) {
                if(self[injectionClassMap][key])
                    delete self[injectionClassMap][key];
                if(self[injectionPropertyMap][key])
                    delete self[injectionPropertyMap][key];

                self[injectionValueMap][key] = value;

                return self;
            },
            toProperty(object, property) {
                if(self[injectionValueMap][key])
                    delete self[injectionValueMap][key];
                if(self[injectionClassMap][key])
                    delete self[injectionClassMap][key];

                self[injectionPropertyMap][key] = {object, property};
                self[injectionPropertyMap][key][isPropertyInjection] = true;

                return self;
            },
            toClass(Class) {
                if(self[injectionClassMap][key]){
                    if(!(self[injectionClassMap][key] instanceof Class))
                        throw new Error(`You are trying to inject a new class on a existing injection of ${key}`);

                    return;
                }
                if(self[injectionValueMap][key])
                    delete self[injectionValueMap][key];
                if(self[injectionPropertyMap][key])
                    delete self[injectionPropertyMap][key];

                self[injectionClassMap][key] = new Class();

                return self;
            }
        }
    }
    
    removeKey(key) {
        if(reservedWords.indexOf(key) !== -1) throw new Error(`"${key}" is a reserved word and can't be removed!`);
        if(Object.keys(this[defaultValues]).indexOf(key) !== -1) throw new Error(`"${key}" is a reserved value in the context, and can't be removed! ${this[defaultValues][key]}.`);
        
        let keyMap;
        if(this[injectionValueMap][key]){
            keyMap = this[injectionValueMap];
        }else if(this[injectionPropertyMap][key]){
            keyMap = this[injectionPropertyMap];
        }else if(this[injectionClassMap][key]){
            keyMap = this[injectionClassMap];
        }
        
        if(!keyMap) return;
        
        delete keyMap[key];
    }

    inherit(injector) {
        for(let key in injector[injectionValueMap]){
            if(reservedWords.indexOf(key) !== -1)
                continue;

            this[injectionValueMap][key] = injector[injectionValueMap][key];
        }

        for(let key in injector[injectionPropertyMap]){
            if(reservedWords.indexOf(key) !== -1)
                continue;

            this[injectionPropertyMap][key] = injector[injectionPropertyMap][key];
        }

        for(let key in injector[injectionClassMap]){
            if(reservedWords.indexOf(key) !== -1)
                continue;

            this[injectionClassMap][key] = injector[injectionClassMap][key];
        }
    }

    inject (instance, ...injections) {
        let defaultInjection = {};

        injections.forEach((injection)=>{
            if(!injection) return;
            if(injection instanceof Injector) {
                let parentInjector = injection;
                injection = Object.assign({}, injection[injectionValueMap], injection[injectionPropertyMap], injection[injectionClassMap], {parentInjector: parentInjector});
            }

            if(!isObject(injection))
                throw new Error("Injection defaults can only be a object literal!");

            defaultInjection = Object.assign(defaultInjection, injection);
        });

        let possibleInjections = Object.assign({}, defaultInjection, this[injectionValueMap], this[injectionPropertyMap], this[injectionClassMap]);

        let injectionSignature = JSON.stringify(Object.keys(possibleInjections));

        if(this[getInjectionSignature](instance) === injectionSignature) return;

        let descriptorsInstance = instance;
        let descriptors = {};

        while(descriptorsInstance && descriptorsInstance !== Object.prototype) {
            let newDescriptors = getOwnPropertyDescriptors(descriptorsInstance);
            for(let key in newDescriptors) {
                if(key === "constructor" || key === "__proto__" || key === "prototype"){
                    continue;
                }

                if(!descriptors[key] || descriptors[key].configurable){
                    descriptors[key] = newDescriptors[key];
                }
            }

            if (descriptorsInstance.prototype) {
                descriptorsInstance = descriptorsInstance.prototype;
            } else if(descriptorsInstance.__proto__){
                descriptorsInstance = descriptorsInstance.__proto__;
            }else if (descriptorsInstance.constructor) {
                descriptorsInstance = descriptorsInstance.constructor.prototype;
            }else{
                descriptorsInstance = null;
            }
        }
        
        for(let key in descriptors) {
            let desc = descriptors[key];

            if(!desc || !desc.value) continue;

            let iKey = desc.value[injectionKey];

            if (typeof desc.value === "function" || !iKey || possibleInjections[iKey] === undefined) {
                continue;
            }

            if(!desc.configurable) continue;

            let value = this[getInjectValue](iKey, defaultInjection);

            Object.defineProperty(instance, key, {
                get(){
                    if(value[isPropertyInjection]){
                        return value.object[value.property];
                    }else {
                        return value;
                    }
                },
                enumerable: true,
                configurable: false
            });
        }

        this[applyInjectionSignature](instance, injectionSignature);

        return instance;
    }
}