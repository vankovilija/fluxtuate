import chainFunctions from "../utils/chainFunctions"
import {isFunction} from "lodash/lang"
import {destroy, fluxtuateNameProperty, fluxtuateUpdateFunction, mediate} from "./_internals"
import {applyContext} from "../context/_internals"

const props = Symbol("props");
const mediator = Symbol("fluxtuateController_mediator");
const views = Symbol("fluxtuateController_views");
const createMediator = Symbol("fluxtuateController_createMediator");
const destroyMediator = Symbol("fluxtuateController_destroyMediator");
const context = Symbol("fluxtuateController__context");
import {mapRemoved, viewCreated, viewDestroyed} from "./_internals"
import {contextMediatorCallback} from "../context/_internals"

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
            
            mediatorClasses.forEach((mediatorClass)=>{
                this[createMediator](view, mediatorClass);
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

        this[createMediator] = (view, mediatorClass) => {
            let med = new mediatorClass();
            med.setProps = chainFunctions(updateMediatorProps.bind(med, this[context][contextMediatorCallback], view), view[view[fluxtuateUpdateFunction]], updatedProps.bind(med, this[context][contextMediatorCallback], view));
            med[props] = Object.assign({},view.props);


            Object.defineProperty(med, "props", {
                get () {
                    return med[props];
                }
            });

            let creationResult = this[context][contextMediatorCallback]("created", med, view);
            if(creationResult === false) return;
            
            this[context][applyContext](med, {view: view}, creationResult.injections);

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