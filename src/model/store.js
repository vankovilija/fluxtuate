import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {elementResponsible} from "./_internals"
import {destroy, eventMap} from "../event-dispatcher/_internals"
const models = Symbol("fluxtuateStore_models");
const modelsRetainCount = Symbol("fluxtuateStore_modelCount");

const dispatchUpdate = Symbol("fluxtuateStore_dispatchUpdate");
const dispatchTimer = Symbol("fluxtuateStore_dispatchTimer");

export default class Store extends RetainEventDispatcher{
    constructor() {
        super();
        this[models] = {};
        this[modelsRetainCount] = {};

        this[dispatchUpdate] = (elementR) => {
            let payload = {data: this.data, models: this.models};
            payload[elementResponsible] = elementR;
            this.dispatch("update", payload);
            this[dispatchTimer] = undefined;
        }
    }

    merge(store) {
        let modelKeys = Object.getOwnPropertyDescriptors(store[models]);
        for(let key in modelKeys){
            this[models][key] = store[models][key];
        }
    }

    onUpdate(callback) {
        return this.addListener("update", (ev, payload) => {
            callback(payload)
        });
    }

    mapModel(modelClass, context){
        let self = this;

        return {
            toKey(key) {
                if(self[models][key]){
                    if(self[models][key].modelClass !== modelClass){
                        throw new Error(`You are trying to swap the model key ${key} with a different model value, model keys are global and must be unique in the context-tree!`);
                    }
                    self[modelsRetainCount][key] ++;
                    return self[models][key];
                } 
                let model = {modelInstance: new modelClass(key), modelClass: modelClass};
                model.listener = model.modelInstance.onUpdate((payload)=>{
                    self[dispatchUpdate](payload[elementResponsible]);
                });
                self[modelsRetainCount][key] = 1;
                Object.defineProperty(self[models], key, {
                    get() {
                        return model;
                    },
                    configurable: true
                });

                self[dispatchUpdate](context);

                return model;
            }
        }
    }

    unmapModelKey(key) {
        if(!this[modelsRetainCount][key]) return;
        this[modelsRetainCount][key]--;
        if(this[modelsRetainCount][key] <= 0) {
            this[modelsRetainCount][key] = 0;
            if(this[models][key]) {
                if(this[models][key].modelInstance.destroy)
                    this[models][key].modelInstance.destroy();
            }
            delete this[models][key];
        }
    }

    get models() {
        let modelClasses = {};
        let modelKeys = Object.getOwnPropertyDescriptors(this[models]);
        for(let key in modelKeys){
            modelClasses[key] = this[models][key].modelClass;
        }
        return modelClasses;
    }

    get data() {
        let modelData = {};
        let modelKeys = Object.getOwnPropertyDescriptors(this[models]);
        for(let key in modelKeys){
            modelData[key] = this[models][key].modelInstance.modelData;
        }
        return modelData;
    }

    clearStore(responsibleElement) {
        let modelKeys = Object.getOwnPropertyDescriptors(this[models]);
        for(let key in modelKeys) {
            this[models][key].modelInstance.destroy();
            this[models][key].modelInstance = undefined;
        }

        this[models] = {};
        this[modelsRetainCount] = {};

        this[dispatchUpdate](responsibleElement || this);
    }

    setData(modelData) {
        for(let key in modelData){
            if(this[models][key]) {
                this[models][key].modelInstance.setValue(modelData[key]);
            }
        }
    }
    
    setStore(modelClasses, modelData = {}) {
        let eventMaps = {};
        let modelKeys = Object.getOwnPropertyDescriptors(this[models]);
        for(let key in modelKeys){
            if(modelClasses[key])
                eventMaps[key] = this[models][key].modelInstance[eventMap];
            else {
                this[models][key].modelInstance.clear();
                if(this[modelsRetainCount][key] <= 0){
                    this[modelsRetainCount][key] = 1;
                    this.unmapModelKey(key);
                }
            }
        }
        for(let key in modelClasses) {
            if(!this[models][key]) {
                let model = {};
                Object.defineProperty(this[models], key, {
                    get() {
                        return model;
                    },
                    configurable: true
                });
                this[modelsRetainCount][key] = 0;
            }
            
            this[models][key].modelClass = modelClasses[key];
            this[models][key].modelInstance = new modelClasses[key](key);
            setTimeout(()=>{
                this[models][key].modelInstance.update(modelData[key] || {})
            }, 0);
            
            if(eventMaps[key])
                this[models][key].modelInstance[eventMap] = eventMaps[key];
        }
    }

    destroy() {
        this[destroy]();
        this.clearStore();
    }
}