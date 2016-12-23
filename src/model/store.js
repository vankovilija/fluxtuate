import RetainEventDispatcher from "../event-dispatcher/retain-event-dispatcher"
import {elementResponsible} from "./_internals"
import {destroy, eventMap} from "../event-dispatcher/_internals"
import ModelWrapper from "./model-wrapper"
import {isString} from "lodash/lang"

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
            if(modelKeys.hasOwnProperty(key))
                this[models][key] = store[models][key];
        }
    }

    onUpdate(callback) {
        return this.addListener("update", (ev, payload) => {
            callback(payload)
        });
    }

    getModel(key, context) {
        if(!isString(key)) throw new Error("You must provide a key to get a model!");

        if(!context) {
            throw new Error(`Context must be provided to get model ${key}`);
        }

        let modelsList = this[models][key];
        if(!modelsList) return;

        let l = modelsList.length;

        for(let i = 0; i < l; i++) {
            if(modelsList[i].context === context || context.hasParent(modelsList[i].context)) {
                return modelsList[i];
            }
        }
    }

    mapModel(modelClass, context){
        let self = this;

        return {
            toKey(key) {
                let model = self.getModel(key, context);
                if(model){
                    if(model.modelClass !== modelClass){
                        throw new Error(`You are trying to swap the model key ${key} with a different model value, model keys are global and must be unique in the context-tree!`);
                    }
                    model.retainCount ++;
                    return model;
                }
                let mi = new modelClass(key);
                model = {modelInstance: mi, storeWrapper: new ModelWrapper(mi), modelClass: modelClass, context, retainCount: 1};
                model.listener = model.modelInstance.onUpdate((payload)=>{
                    self[dispatchUpdate](payload[elementResponsible]);
                });
                if(!self[models][key]) self[models][key] = [];
                self[models][key].push(model);

                self[dispatchUpdate](context);

                return model;
            }
        }
    }

    unmapModelKey(key, context) {
        let model = this.getModel(key, context);
        if(!model) return;
        model.retainCount--;
        if(model.retainCount <= 0) {
            model.retainCount = 0;
            if(model) {
                if(model.modelInstance.destroy)
                    model.modelInstance.destroy();
                if(model.storeWrapper.destroy)
                    model.storeWrapper.destroy();
            }
            let modelIndex = this[models][key].indexOf(model);
            this[models][key].splice(modelIndex, 1);
            if(this[models][key].length === 0) {
                delete this[models][key];
            }
        }
        return model;
    }

    get models() {
        let modelClasses = {};
        let modelKeys = Object.keys(this[models]);
        for(let i = 0; i < modelKeys.length; i ++){
            let key = modelKeys[i];
            modelClasses[key] = this[models][key].map((modelObject)=>modelObject.modelClass);
        }
        return modelClasses;
    }

    get data() {
        let modelData = {};
        let modelKeys = Object.keys(this[models]);
        for(let i = 0; i < modelKeys.length; i ++){
            let key = modelKeys[i];
            modelData[key] = this[models][key].map((modelObject)=>modelObject.storeWrapper.modelData);
        }
        return modelData;
    }

    clearStore(responsibleElement) {
        let modelKeys = Object.keys(this[models]);
        for(let i = 0; i < modelKeys.length; i++) {
            let key = modelKeys[i];
            let modelsList = this[models][key];
            for(let j = 0 ; i < modelsList.length; j++) {
                let model = modelsList[j];
                if (model.storeWrapper.destroy)
                    model.storeWrapper.destroy();

                if (model.modelInstance.destroy)
                    model.modelInstance.destroy();

                model.modelInstance = undefined;
            }
        }

        this[models] = {};
        this[modelsRetainCount] = {};

        this[dispatchUpdate](responsibleElement || this);
    }

    setData(modelData) {
        for(let key in modelData){
            if(modelData.hasOwnProperty(key)) {
                if (this[models][key]) {
                    for(let i = 0; i < modelData[key].length; i++) {
                        if(this[models][key][i])
                            this[models][key][i].modelInstance.setValue(modelData[key][i]);
                    }
                }
            }
        }
    }
    
    setStore(modelClasses, modelData = {}) {
        let eventMaps = {};
        let modelKeys = Object.keys(this[models]);
        for(let i = 0; i < modelKeys.length; i++){
            let key = modelKeys[i];
            for(let j = 0; j < this[models][key].length; j++) {
                let model = this[models][key][j];
                if (modelClasses[key]) {
                    if(!eventMaps[key]) eventMaps[key] = [];
                    eventMaps[key][i] = model.modelInstance[eventMap];
                } else {
                    model.modelInstance.clear();
                    if (model.retainCount <= 0) {
                        model.retainCount = 1;
                        this.unmapModelKey(key, model.context);
                    }
                }
            }
        }
        for(let key in modelClasses) {
            if(modelClasses.hasOwnProperty(key)) {
                if (!this[models][key]) {
                    this[models][key] = [];
                }
                for(let i = 0; i < modelClasses[key].length; i ++) {
                    this[models][key][i].modelClass = modelClasses[key];
                    this[models][key][i].modelInstance = new modelClasses[key](key);
                    setTimeout(function(key, i){
                        this[models][key][i].modelInstance.update(modelData[key] ? (modelData[key][i] || {}) : {})
                    }.bind(this, key, i), 0);

                    if (eventMaps[key] && eventMaps[key][i])
                        this[models][key][i].modelInstance[eventMap] = eventMaps[key][i];
                }
            }
        }
    }

    destroy() {
        this[destroy]();
        this.clearStore();
    }
}