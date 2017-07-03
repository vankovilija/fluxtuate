import chainFunctions from "../utils/chainFunctions"
import {isFunction} from "lodash/lang"
import {destroy, fluxtuateNameProperty, fluxtuateUpdateFunction, mediate, dispatchFunction, mediator as MediatorKey, context as MediatorContext} from "./_internals"
import {applyMediatorContext, applyGuardContext} from "../context/_internals"
import {approveGuard} from "../guard/_internals"
import Model from "../model"
import MediatorModelWrapper from "./mediator-model-wrapper"
import ModelWrapper from "../model/model-wrapper"
import {model} from "../model/_internals"
import {mapRemoved, viewCreated, viewDestroyed} from "./_internals"
import {contextMediatorCallback} from "../context/_internals"

const props = Symbol("props");
const mediator = Symbol("fluxtuateController_mediator");
const views = Symbol("fluxtuateController_views");
const createMediator = Symbol("fluxtuateController_createMediator");
const destroyMediator = Symbol("fluxtuateController_destroyMediator");
const context = Symbol("fluxtuateController__context");
const mediatorsOnView = Symbol("fluxtuateController__context");

function updateMediatorProps(callback, view, newProps) {
    if(callback("updating", this, view, newProps) === false) return false;
    this[props] = Object.assign(this[props], newProps);
}

function updatedProps(callback, view) {
    callback("updated", this, view);
}

export default class MediatorController {
    constructor (c){
        this[views] = {};
        this[context] = c;
        this[viewCreated] = (view, viewClass, mediatorClasses) => {
            if(view[mediator] && view[mediator].length > 0) return;

            view[mediator] = [];
            let self = this;
            view[mediate] = function(functionName, ...args) {
                let meds = view[mediator].slice();
                meds.forEach((med)=>{
                    if(self[context][contextMediatorCallback]("mediated", med, view, functionName) === false) return;
                    
                    if(isFunction(med[functionName])){
                        med[functionName].apply(med, args);
                    }
                });
            };
            
            mediatorClasses.forEach((mediator)=>{
                if(mediator.guards){
                    
                    let guard;
                    if(mediator.guardProperties) {
                        let convertedProperties = mediator.guardProperties.map((prop)=>{
                            if(prop instanceof ModelWrapper){
                                prop = prop[model];
                            }

                            if(prop instanceof Model){
                                return new ModelWrapper(prop, this[context]);
                            }

                            return prop;
                        });
                        guard = new (Function.prototype.bind.apply(mediator.guard, [this, ...convertedProperties]));
                    }else{
                        guard = new mediator.guard();
                    }

                    Object.defineProperty(guard, "props", {
                        get () {
                            return Object.assign({},view.props);
                        }
                    });

                    this[context][applyGuardContext](guard, {view: view});

                    if(!isFunction(guard[approveGuard])){
                        throw new Error(`Guards must have a approve function! ${guard}`);
                    }
                    guard[approveGuard]().then((isApproved)=> {
                        if (isFunction(guard.destroy))
                            guard.destroy();
                        if (!isApproved) return;

                        this[createMediator](view, mediator.mediatorClass, mediator.props);
                    });
                } else {
                    this[createMediator](view, mediator.mediatorClass, mediator.props);
                }
            });
            let viewsArray = this[views][viewClass[viewClass[fluxtuateNameProperty]]];
            if(!viewsArray) viewsArray = [];
            viewsArray.push(view);
            this[views][viewClass[viewClass[fluxtuateNameProperty]]] = viewsArray;
        };
        
        this[viewDestroyed] = (view, viewClass) => {
            let meds = view[mediator].slice();
            meds.forEach((med)=>{
                this[destroyMediator](view, med);
            });

            let viewsArray = this[views][viewClass[viewClass[fluxtuateNameProperty]]];
            if(viewsArray) {
                let index = viewsArray.indexOf(view);
                if(index !== -1) {
                    viewsArray.splice(index, 1);
                }
                this[views][viewClass[viewClass[fluxtuateNameProperty]]] = viewsArray;
            }
        };

        this[createMediator] = (view, mediatorClass, properties) => {
            if(view[mediatorsOnView] && view[mediatorsOnView].indexOf(mediatorClass) !== -1) {
                return;
            }
            let med;
            if(properties) {
                let injectedModels = [];
                let convertedProperties = properties.map((prop)=>{
                    if(prop instanceof ModelWrapper){
                        prop = prop[model];
                    }

                    if(prop instanceof Model){
                        let modelWrapper = new MediatorModelWrapper(prop, this[context]);
                        injectedModels.push(modelWrapper);
                        return modelWrapper;
                    }

                    return prop;
                });
                med = new (Function.prototype.bind.apply(mediatorClass, [this, ...convertedProperties]));
                injectedModels.forEach((modelWrapper)=>{
                    modelWrapper[MediatorKey] = med;
                });
            }else{
                med = new mediatorClass();
            }
            if(!view[mediatorsOnView]) {
                view[mediatorsOnView] = [];
            }
            view[mediatorsOnView].push(mediatorClass);
            med[dispatchFunction] = this[context].dispatch;
            med.setProps = chainFunctions(updateMediatorProps.bind(med, this[context][contextMediatorCallback], view), view[view[fluxtuateUpdateFunction]], updatedProps.bind(med, this[context][contextMediatorCallback], view));
            med[props] = Object.assign({},view.props);
            med[MediatorContext] = this[context];


            Object.defineProperty(med, "props", {
                get () {
                    return med[props];
                }
            });

            let creationResult = this[context][contextMediatorCallback]("created", med, view);
            if(creationResult === false) return;
            
            this[context][applyMediatorContext](med, {view: view}, creationResult.injections);

            if(isFunction(med.init)){
                med.init();
            }

            if(this[context][contextMediatorCallback]("initialized", med, view) === false) return;
            
            view[mediator].push(med);
        };
        
        this[destroyMediator] = (view, med) => {
            if(isFunction(med.destroy))
                med.destroy();

            this[context][contextMediatorCallback]("destroyed", med, view);

            let index = view[mediator].indexOf(med);

            if(index !== -1) {
                view[mediator].splice(index, 1);
            }
            
            med[destroy]();
        };
        
        this[mapRemoved] = (viewClass, mediatorClass) => {
            let foundViews = this[views][viewClass[viewClass[fluxtuateNameProperty]]];

            if(!foundViews) return;
            
            foundViews = foundViews.slice();

            foundViews.forEach((view)=>{
                let meds = view[mediator].slice();
                meds.forEach((med)=>{
                    if(med instanceof mediatorClass){
                        this[destroyMediator](view, med);
                    }
                });
            });
        }
    }
}