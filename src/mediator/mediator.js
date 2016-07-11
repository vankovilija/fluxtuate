import {destroy, boundModels, autoDispatches} from "./_internals"
import {isFunction} from "lodash/lang"
const destroyed = Symbol("fluxtuateMediator_destroyed");
const updateMediatorPropsFromModel = Symbol("fluxtuateMediator_updateMediatorPropsFromModel");
const modelUpdateListeners = Symbol("fluxtuateMediator_modelUpdateListeners");
const linkedModels = Symbol("fluxtuateMediator_linkedModels");

let defaultModelReducer = (modelPayload) => {
    return modelPayload.data;
};

export default class Mediator {
    constructor(dispatchFunction) {
        this[destroyed] = false;
        this[modelUpdateListeners] = [];
        this[linkedModels] = [];
        this[destroy] = () => {
            while(this[modelUpdateListeners].length > 0){
                this[modelUpdateListeners][0].remove();
                this[modelUpdateListeners].shift();
            }

            this[destroyed] = true;
        };

        this[updateMediatorPropsFromModel] = (modelData) => {
            if(isFunction(this.setProps))
                this.setProps(modelData);
        };

        setTimeout(()=>{
            if(this[destroyed]) return;
            
            if(this[boundModels]) {
                this[boundModels].forEach((boundModel)=>{
                    if(this[boundModel.key]){
                        this.linkModel(this[boundModel.key], boundModel.bindFunction.bind(this));
                    }
                });
            }
            if(this[autoDispatches]) {
                this[autoDispatches].forEach((autoDispatch)=>{
                    let autoDispatchFunction;
                    if(isFunction(this[autoDispatch.key])){
                        autoDispatchFunction = this[autoDispatch.key];
                    }else{
                        autoDispatchFunction = (descriptorPayload)=>descriptorPayload;
                    }

                    Object.defineProperty(this, autoDispatch.key, {
                        value: (...args) => {
                            let returnValue = autoDispatchFunction.apply(this, args);
                            dispatchFunction(autoDispatch.dispatchKey, returnValue);
                            return returnValue;
                        },
                        configurable: true,
                        writable: false
                    });
                });
            }
            if(isFunction(this.destroy)){
                let dest = this.destroy;
                this.destroy = () => {
                    if(this[destroyed]) return;

                    dest.apply(this);
                }
            }
        }, 0);
    }

    linkModel(model, modelReducer = defaultModelReducer) {
        this.unlinkModel(model);
        if(isFunction(model.onUpdate)){
            this[modelUpdateListeners].push(model.onUpdate((modelPayload)=>{
                this[updateMediatorPropsFromModel](modelReducer(modelPayload));
            }));
            this[linkedModels].push(model);
        }
    }

    unlinkModel(model) {
        let index = this[linkedModels].indexOf(model);
        if(index !== -1) {
            this[modelUpdateListeners][index].remove();
            this[modelUpdateListeners].splice(index, 1);
            this[linkedModels].splice(index, 1);
        }
    }

    get destroyed() {
        return this[destroyed]
    }
}