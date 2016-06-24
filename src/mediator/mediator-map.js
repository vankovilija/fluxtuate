import Delegator from "../delegator"
import Mediator from "./mediator"
import {destroy, pause, resume, mapRemoved, viewCreated, viewDestroyed, viewDelegator, fluxtuateView, fluxtuateNameProperty} from "./_internals"
import Controller from "./mediator-controller"

const mediatorMap = Symbol("fluxtuateMediatorMap__mediatorMap");
const controllerDelegator = Symbol("fluxtuateMediatorMap__controllerDelegator");
const controller = Symbol("fluxtuateMediatorMap__controller");
const isPuased = Symbol("fluxtuateMediatorMap__isPaused");

export default class MediatorMap {
    constructor(context) {
        this[isPuased] = false;
        this[controllerDelegator] = new Delegator();
        this[controller] = new Controller(context);

        this[controllerDelegator].attachDelegate(this[controller]);

        this[mediatorMap] = {};
        
        this[viewCreated] = (view, viewClass, creationContext) => {
            if(creationContext && creationContext !== context && !creationContext.isChildOf(context)) return;
            if(this[isPuased]) return;
            let viewClassName = viewClass[viewClass[fluxtuateNameProperty]];
            let {mediatorClasses} = this[mediatorMap][viewClassName];
            this[controllerDelegator].dispatch(viewCreated, view, viewClass, mediatorClasses);
        };
        
        this[viewDestroyed] = (view, viewClass, creationContext) => {
            if(creationContext && creationContext !== context && !creationContext.isChildOf(context)) return;
            let viewClassName = viewClass[viewClass[fluxtuateNameProperty]];
            if(!this[mediatorMap][viewClassName]) return;

            let {mediatorClasses} = this[mediatorMap][viewClassName];
            this[controllerDelegator].dispatch(viewDestroyed, view, viewClass, mediatorClasses);
        };

        this[pause] = () => {
            this[isPuased] = true;
        };

        this[resume] = () => {
            this[isPuased] = false;
        };
        
        this[destroy] = () => {
            for(let key in this[mediatorMap]) {
                let {viewClass, mediatorClasses} = this[mediatorMap][key];
                mediatorClasses = mediatorClasses.slice();
                mediatorClasses.forEach((mediator)=>{
                    this.unpamView(viewClass, mediator);
                });
                viewClass[viewDelegator].detachDelegate(this);
            }
            
            this[mediatorMap] = {};
        }
    }
    
    mapView (view, mediator) {
        if((mediator === Mediator) || !(mediator.prototype instanceof Mediator))
            throw new Error("Your mediators must inherit fluxtuates Mediator class!");

        if(!view[fluxtuateView]) {
            throw new Error("You must map a fluxtuate view in the mediator map!");
        }

        let viewClassName = view[view[fluxtuateNameProperty]];

        view[viewDelegator].attachDelegate(this);

        let mediatorClasses = [];
        if(this[mediatorMap][viewClassName]) {
            mediatorClasses = this[mediatorMap][viewClassName].mediatorClasses;
        }

        mediatorClasses.push(mediator);

        this[mediatorMap][viewClassName] = {viewClass: view, mediatorClasses: mediatorClasses};

        return view;
    }
    unpamView(view, mediator) {
        let viewClassName = view[view[fluxtuateNameProperty]];

        if(!this[mediatorMap][viewClassName]) return;

        let { mediatorClasses } = this[mediatorMap][viewClassName];

        let index = mediatorClasses.indexOf(mediator);

        if(index === -1) return;

        mediatorClasses.splice(index, 1);

        if(mediatorClasses.length === 0)
            view[viewDelegator].detachDelegate(this);

        this[controllerDelegator].dispatch(mapRemoved, view, mediator);

        return mediator;
    }
}