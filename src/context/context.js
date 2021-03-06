import EventDispatcher from "../event-dispatcher"
import EventDispatcherWrapper from "../event-dispatcher/event-dispatcher-wrapper"
import chainTwoFunction from "../utils/chainFunctions"
import ContextModelWrapper from "../model/model-wrapper"
import ModelWrapper from "../model/model-wrapper"
import MediatorMap from "../mediator/mediator-map"
import MediatorModelWrapper from "../mediator/mediator-model-wrapper"
import MediatorEventDispatcherWrapper from "../mediator/mediator-event-dispatcher-wrapper"
import Store from "../model/store"
import CommandMap from "../command/command-map"
import CommandModelWrapper from "../command/command-model-wrapper"
import CommandEventDispatcherWrapper from "../command/command-event-dispatcher-wrapper"
import Injector from "../inject/context-injector"
import {
    applyContext,
    applyCommandContext,
    applyMediatorContext,
    applyGuardContext,
    contextMediatorCallback,
    store,
    mediators,
    contextDispatcher,
    destroy
} from "./_internals"
import {isFunction} from "lodash/lang"
import {autobind} from "core-decorators"
import {getInjectValue, globalValues, defaultValues, isPropertyInjection} from "../inject/_internals"
import {destroy as commandDestroy, pause as commandPause, resume as commandResume} from "../command/_internals"
import {destroy as mediatorDestroy, pause as mediatorPause, resume as mediatorResume} from "../mediator/_internals"
import {destroy as eventDestroy, pause as eventPause, resume as eventResume} from "../event-dispatcher/_internals"
import GUID from "../utils/guid"

const destroyed = Symbol("fluxtuateContext_destroyed");
const eventDispatcher = Symbol("fluxtuateContext_eventDispatcher");
const mediatorMap = Symbol("fluxtuateContext_mediatorMap");

const storeModels = Symbol("fluxtuateContext_storeModels");
const storeFunction = Symbol("fluxtuateContext_storeFunction");
const commandMap = Symbol("fluxtuateContext_commandMap");
const injector = Symbol("fluxtuateContext_injector");
const configuration = Symbol("fluxtuateContext_configuration");
const configurations = Symbol("fluxtuateContext_configurations");
const children = Symbol("fluxtuateContext_children");
const parent = Symbol("fluxtuateContext_parent");
const addParent = Symbol("fluxtuateContext_addParent");
const addParentValues = Symbol("fluxtuateContext_addParentValues");
const removeParent = Symbol("fluxtuateContext_removeParent");
const removeParentValues = Symbol("fluxtuateContext_removeParentValues");
const plugins = Symbol("fluxtuateContext_plugins");
const globalPlugins = Symbol("fluxtuateContext_globalPlugins");
const configured = Symbol("fluxtuateContext_configured");
const restart = Symbol("fluxtuateContext_restart");
const applyConfiguration = Symbol("fluxtuateContext_applyConfiguration");
const injectAsDefault = Symbol("fluxtuateContext_injectAsDefault");
const removeAsDefault = Symbol("fluxtuateContext_removeAsDefault");
const checkDestroyed = Symbol("fluxtuateContext_checkDestroyed");
const commandInjections = Symbol("fluxtuateContext_commandInjections");
const mediatorInjections = Symbol("fluxtuateContext_mediatorInjections");
const contextName = Symbol("fluxtuateContext_contextName");
const executeCommandCallback = Symbol("fluxtuateContext_executeCommandCallback");
const models = Symbol("fluxtuateContext_models");
const updateChildrenModelInstance = Symbol("fluxtuateContext_updateChildrenModelInstance");
const addModelKey = Symbol("fluxtuateContext_addModelCount");
const storeNames = Symbol("fluxtuateContext_storeNames");

const globalStore = new Store();

function getAllParentModels(context) {
    if(!context.parent) return {};
    return Object.assign(getAllParentModels(context.parent), context[models]);
}

@autobind
export default class Context {
    constructor() {
        this[store] = globalStore;
        this[destroyed] = false;
        this[contextName] = "";
        this[mediators] = [];
        this[contextDispatcher] = new EventDispatcher();
        this[models] = {};
        this[storeModels] = [];
        this[eventDispatcher] = new EventDispatcher();
        this[plugins] = [];
        this[globalPlugins] = [];
        this[children] = [];
        this[commandInjections] = {};
        this[mediatorInjections] = {};
        this[parent] = undefined;
        this[storeNames] = {};

        this[executeCommandCallback] = (event, command)=>{
            if(this.destroyed) return;

            this[contextDispatcher].dispatch(event.eventName, command);
        };

        this[mediatorMap] = new MediatorMap(this);
        let commandEventDispatcher = new CommandEventDispatcherWrapper(this[eventDispatcher], this, undefined);
        this[commandMap] = new CommandMap(commandEventDispatcher, this);
        this[injector] = new Injector(this, this[mediatorMap], this[commandMap]);

        this[commandMap].addListener("executeCommand", this[executeCommandCallback]);
        this[commandMap].addListener("completeCommand", this[executeCommandCallback]);

        Object.defineProperty(this, "commandMap", {
            get() {
                return this[commandMap];
            }
        });

        Object.defineProperty(this, "mediatorMap", {
            get() {
                return this[mediatorMap];
            }
        });

        Object.defineProperty(this, "contextName", {
            get() {
                return this[contextName];
            }
        });

        this[injectAsDefault] = (key, value, description, isGlobal = false, type = "value") => {
            if(type === "value") {
                this[injector].mapKey(key).toValue(value);
            }else if(type === "property") {
                this[injector].mapKey(key).toProperty(value.object, value.property);
            }else if(type === "command") {
                this[commandInjections][key] = value;
            }else if(type === "mediator") {
                this[mediatorInjections][key] = value;
            }
            this[injector][defaultValues][key] = description;

            if(isGlobal) {
                this[injector][globalValues].push(key);
            }
        };

        this[removeAsDefault] = (key) => {
            delete this[injector][defaultValues][key];
            this[injector].removeKey(key);
            let index = this[injector][globalValues].indexOf(key);
            if(index !== -1){
                this[injector][globalValues].splice(index, 1);
            }
        };

        this[applyContext] = (instance, ...injections) => {
            this[injector].inject(instance, ...injections);
            if(this[parent]){
                this[parent][applyContext](instance);
            }
        };

        this[applyMediatorContext] = (instance, ...injections) => {
            let modelInjections = {};

            for(let key in this[models]) {
                modelInjections[key] = new MediatorModelWrapper(this[models][key].modelInstance, this, instance);
            }

            let mediatorEventDispatcher = new MediatorEventDispatcherWrapper(this[eventDispatcher], this, instance);

            let removeInjections = ()=>{
                for(let key in modelInjections) {
                    modelInjections[key].destroy();
                }
                mediatorEventDispatcher.destroy();
            };

            if(instance.destroy) {
                instance.destroy = chainTwoFunction(instance.destroy, removeInjections);
            }else{
                instance.destroy = removeInjections;
            }

            this[injector].inject.apply(this[injector],
                [instance, modelInjections, this[mediatorInjections], {eventDispatcher: mediatorEventDispatcher}, ...injections]);
            if(this[parent]){
                this[parent][applyMediatorContext](instance, ...injections);
            }
        };

        this[applyGuardContext] = (instance, ...injections) => {
            let modelInjections = {};

            for(let key in this[models]) {
                modelInjections[key] = new ModelWrapper(this[models][key].modelInstance, this);
            }

            let removeInjections = ()=>{
                for(let key in modelInjections) {
                    modelInjections[key].destroy();
                }
            };

            if(instance.destroy) {
                instance.destroy = chainTwoFunction(instance.destroy, removeInjections);
            }else{
                instance.destroy = removeInjections;
            }

            this[injector].inject.apply(this[injector], [instance, modelInjections, this[mediatorInjections], this[commandInjections], ...injections]);
            if(this[parent]){
                this[parent][applyGuardContext](instance, ...injections);
            }
        };

        this[applyCommandContext] = (instance, ...injections) => {
            let modelInjections = {};
            
            for(let key in this[models]) {
                modelInjections[key] = new CommandModelWrapper(this[models][key].modelInstance, this, instance);
            }

            let commandEventDispatcher = new CommandEventDispatcherWrapper(this[eventDispatcher], this, instance);

            if(instance.then){
                instance.then(()=>{
                    for(let key in modelInjections) {
                        modelInjections[key].destroy();
                    }
                });

                commandEventDispatcher.destroy();
            }

            this[injector].inject.apply(this[injector],
                [instance, modelInjections, this[commandInjections], {eventDispatcher: commandEventDispatcher}, ...injections]);
            if(this[parent]){
                this[parent][applyCommandContext](instance, ...injections);
            }
        };

        this[checkDestroyed] = () => {
            if(this[destroyed]){
                throw new Error("You are accessing a destroyed context, this is not possible!");
            }
        };
        
        this[restart] = () => {
            this[contextDispatcher].dispatch("restarting");
            this[commandMap][commandResume]();
            this[mediatorMap][mediatorResume]();
            this[eventDispatcher][eventResume]();
            this[contextDispatcher].dispatch("restarted");
        };
        
        this[contextMediatorCallback] = (state, mediator, view, newProps) => {
            if(!this[contextDispatcher]) return;
            
            let isPrevented = false;
            switch(state){
                case "created":
                {
                    this[mediators].push(mediator);
                    let injections = {};
                    this[contextDispatcher].dispatch("mediator_created", {
                        preventDefault(){
                            isPrevented = true;
                        },
                        mapKey(key) {
                            return {
                                toValue(value) {
                                    injections[key] = value;
                                }
                            }
                        },
                        mediator: mediator,
                        view: view
                    });
                    if (isPrevented) return false;

                    return {injections: injections};
                }
                case "initialized": 
                {
                    this[contextDispatcher].dispatch("mediator_initialized", {
                        mediator: mediator,
                        view: view
                    });
                    break;
                }
                case "destroyed":
                {
                    let index = this[mediators].indexOf(mediator);
                    if(index !== -1) {
                        this[mediators].splice(index, 1);
                    }
                    this[contextDispatcher].dispatch("mediator_destroyed", {
                        mediator: mediator,
                        view: view
                    });
                    break;
                }
                case "updating":
                {
                    this[contextDispatcher].dispatch("mediator_updating", {
                        preventDefault(){
                            isPrevented = true;
                        },
                        mediator: mediator,
                        view: view,
                        props: newProps
                    });
                    return !isPrevented;
                }
                case "updated":
                {
                    this[contextDispatcher].dispatch("mediator_updated", {
                        mediator: mediator,
                        view: view
                    });
                    break;
                }
                case "mediated":
                {
                    this[contextDispatcher].dispatch("mediator_mediated", {
                        preventDefault(){
                            isPrevented = true;
                        },
                        mediator: mediator,
                        view: view,
                        mediationKey: newProps
                    });
                    return !isPrevented;
                }
            }
        };

        this[configuration] = [];
        this[configurations] = [];
        this[configured] = false;

        this[addModelKey] = (storeName, key) => {
            this[storeNames][storeName] = key;
            this.children.forEach(c=>{
                c[addModelKey](storeName, key);
            });
        };

        this[addParent] = (parentContext) => {
            if (parentContext) {
                this[parent] = parentContext;

                parentContext[eventDispatcher].addChild(this[eventDispatcher]);

                let storeKeys = Object.keys(parentContext[storeNames]);
                for(let i = 0; i < storeKeys.length; i++) {
                    this[addModelKey](storeKeys[i], parentContext[storeNames][storeKeys[i]]);
                }

                let values = parentContext[injector][globalValues].slice();
                let pgns = parentContext[globalPlugins].slice();
                let parentModels = getAllParentModels(parentContext);
                this[addParentValues](values, pgns, parentContext[injector][getInjectValue], parentContext[injector][defaultValues], parentModels);
            }
        };

        this[addParentValues]= (values, pgns, getFunction, defaultValues, parentModels) => {
            values.forEach(key=>{
                let value = getFunction(key);
                this[injectAsDefault](key, value, defaultValues[key], true, value[isPropertyInjection]?"property":"value");
            });

            pgns.forEach(plugin=> {
                if(this[globalPlugins].indexOf(plugin) !== -1) return;
                this.plugin(plugin);
            });

            let modelKeys = Object.keys(parentModels);

            modelKeys.forEach((key)=>{
                if(
                    this[models][key] !== undefined &&
                    this[models][key].modelInstance !== parentModels[key].modelInstance &&
                    this[models][key].wrapper._modelName === parentModels[key].wrapper._modelName
                ) {
                    this[storeFunction].removeModel(key);
                    this[storeFunction].addModel(key, parentModels[key].modelClass);
                    this[contextDispatcher].dispatch("changeModel", {
                        model: parentModels[key].modelInstance
                    });
                }
            });

            this.children.forEach(c=>{
                c[addParentValues](values, pgns, getFunction, defaultValues, parentModels);
            });
        };

        this[updateChildrenModelInstance] = (modelKey, modelObject) => {
            this.children.forEach(c=>{
                c[updateChildrenModelInstance](modelKey, modelObject);
            });

            if(modelObject === undefined || this[models][modelKey] === undefined) return;

            if(
                this[models][modelKey].modelInstance !== modelObject.modelInstance &&
                this[models][modelKey].wrapper._modelName === modelObject.wrapper._modelName
            ) {
                this[storeFunction].removeModel(modelKey);
                this[storeFunction].addModel(modelKey, modelObject.modelClass);
                this[contextDispatcher].dispatch("changeModel", {
                    model: modelObject.modelInstance
                });
            }
        };

        this[removeParent] = () => {
            if(!this[parent]) return;
            
            this[parent][eventDispatcher].removeChild(this[eventDispatcher]);

            let values = this[parent][injector][globalValues].slice();

            let pgns = this[parent][globalPlugins];

            this[removeParentValues](values, pgns);

            this[parent] = undefined;
        };

        this[removeParentValues] = (values, pgns) => {
            values.forEach(key=>{
                this[removeAsDefault](key);
            });

            pgns.forEach(plugin=> {
                this.removePlugin(plugin);
            });

            this.children.forEach(c=>{
                c[removeParentValues](values, pgns);
            });
        };

        let self = this;
        this[storeFunction] = {
            forceNewModel(storeName) {
                let storeNameKey = self[storeNames][storeName] !== undefined && self[storeNames][storeName] >= 0 ? self[storeNames][storeName] : -1;
                storeNameKey = GUID.generateGUID();
                self[addModelKey](storeName, storeNameKey);
            },
            addModel(storeName, modelClass) {
                let injectionKey = storeName,
                    description = `A key to get the ${storeName}`;

                let originalStoreName = storeName;
                if(self[storeModels].indexOf(storeName) !== -1) {
                    throw new Error(`Stores can only be registered once per context, you are trying to register the store ${storeName} twice!`)
                }

                if(self[storeNames][storeName]) {
                    storeName = `${storeName}_${self[storeNames][storeName]}`;
                }

                let model = self[store].mapModel(modelClass, self).toKey(storeName);
                self[contextDispatcher].dispatch("modelAdded", {context: self, model: model, modelKey: originalStoreName});
                self[injectAsDefault](injectionKey, {object: model, property: "modelInstance"}, description, false, "none");
                let contextModel = new ContextModelWrapper(model.modelInstance, self);
                self[models][injectionKey] = Object.assign({}, model, {wrapper: contextModel});

                self[storeModels].push(originalStoreName);

                self.children.forEach(c=>{
                    c[updateChildrenModelInstance](injectionKey, self[models][injectionKey]);
                });

                return contextModel;
            },
            useModel(storeName, injectionKey, description) {
                let originalStoreName = storeName;
                if(self[storeModels].indexOf(storeName) !== -1) {
                    throw new Error(`Stores can only be registered once per context, you are trying to register the store ${storeName} twice!`)
                }
                if(!description) {
                    description = `A key to get the ${storeName}`
                }

                if(!injectionKey) {
                    injectionKey = storeName;
                }

                if(self[storeNames][storeName]) {
                    storeName = `${storeName}_${self[storeNames][storeName]}`;
                }

                let model = self[store].useModel(storeName, self);
                if(!model) {
                    throw new Error(`The model ${injectionKey} is not mapped to the store, you need to add this model in a previous context before using it here!`);
                }
                self[contextDispatcher].dispatch("modelAdded", {context: self, model: model, modelKey: originalStoreName});
                self[injectAsDefault](injectionKey, {object: model, property: "modelInstance"}, description, false, "none");
                let contextModel = new ContextModelWrapper(model.modelInstance, self);
                self[models][injectionKey] = Object.assign({}, model, {wrapper: contextModel});

                self[storeModels].push(originalStoreName);

                return contextModel;
            },
            removeModel(storeName) {
                let originalStoreName = storeName;
                if(self[storeNames][storeName]) {
                    storeName = `${storeName}_${self[storeNames][storeName]}`;
                }

                let index = self[storeModels].indexOf(originalStoreName);
                if(index !== -1) {
                    self[storeModels].splice(index, 1);
                }

                self[contextDispatcher].dispatch("modelRemoved", {context: self, model: model, modelKey: originalStoreName});
                let model = self[store].unmapModelKey(storeName, self);
                if(!model) return;

                if(model.isDestroyed) {
                    self[addModelKey](originalStoreName, undefined);
                }
            },
            getModel(modelName) {
                if(!self[models][modelName]){
                    return;
                }

                return self[models][modelName].wrapper;
            }
        };

        this[applyConfiguration] = (Config)=>{
            let config = new Config();
            this[applyContext](
                config,
                this[mediatorInjections],
                this[commandInjections],
                {store: this[storeFunction]},
                this[parent]?{parentContext: this[parent]}:undefined,
                {eventDispatcher: new EventDispatcherWrapper(this[eventDispatcher], this)}
            );
            config.configure();
            this[configurations].push(config);
        };

        this[destroy] = () => {
            if(this[destroyed]) return;

            let originalChildren = this[children].slice();
            let l = originalChildren.length;
            while(--l > -1) {
                let c = originalChildren[l];
                if(isFunction(c[destroy]))
                    c[destroy]();
            }

            let confgs = this[configurations].slice();
            confgs.forEach(config=>{
                if(isFunction(config.destroy))
                    config.destroy();
            });

            let pgs = this[plugins].slice();
            pgs.forEach(plugin=>{
                if(isFunction(plugin.destroy))
                    plugin.destroy();
            });

            if(this[parent])
                this[parent].removeChild(this);

            while(this[storeModels].length > 0) {
                this[storeFunction].removeModel(this[storeModels].pop());
            }

            for(let key in this[models]){
                this[models][key].wrapper.destroy();
            }

            this[contextDispatcher].dispatch("destroying");
            this[commandMap][commandDestroy]();
            this[mediatorMap][mediatorDestroy]();
            this[eventDispatcher][eventDestroy]();

            this[commandMap] = undefined;
            this[mediatorMap] = undefined;
            this[eventDispatcher] = undefined;

            this[configured] = false;
            this[contextDispatcher].dispatch("destroyed");
            this[contextDispatcher][eventDestroy]();
            this[contextDispatcher] = undefined;

            this[plugins] = [];
            this[destroyed] = true;
            this[parent] = undefined;
        }
    }

    dispatch(eventName, eventPayload) {
        this[eventDispatcher].dispatch(eventName, eventPayload);
    }

    addChild(context) {
        this[checkDestroyed]();

        if(context === this) {
            throw new Error("Context can't be a child of its self!");
        }

        let isPrevented = false;
        this[contextDispatcher].dispatch("adding_child", {
            context: this,
            childContext: context,
            preventDefault() {
                isPrevented = true;
            }
        });

        if(isPrevented) return;

        if(context[parent]){
            throw new Error("Context is already a child of another context, you must remove the context before attempting to change its parent.");
        }

        this[children].push(context);
        context[addParent](this);

        this[contextDispatcher].dispatch("added_child", {
            context: this,
            childContext: context
        });
    }

    removeChild(context) {
        this[checkDestroyed]();

        if(context === this) {
            throw new Error("Context can't be a child of its self!");
        }

        let isPrevented = false;
        this[contextDispatcher].dispatch("removing_child", {
            context: this,
            childContext: context,
            preventDefault() {
                isPrevented = true;
            }
        });

        if(isPrevented) return;


        if(context[parent] !== this) {
            throw new Error("Context is not child of context!");
        }

        let index = this[children].indexOf(context);
        if(index === -1) return;

        this[children].splice(index, 1);
        context[removeParent]();

        this[contextDispatcher].dispatch("removed_child", {
            context: this,
            childContext: context
        });
    }

    setName(name) {
        this[contextName] = name;
        return this;
    }
    
    config(configurationClass) {
        this[checkDestroyed]();

        if(!isFunction(configurationClass.prototype.configure)){
            throw new Error("Configuration must contain a configure method!");
        }
        this[configuration].push(configurationClass);
        if(this[configured]){
            this[applyConfiguration](configurationClass);
        }
        return this;
    }

    removeConfig(Config) {
        this[checkDestroyed]();

        if(!isFunction(Config.prototype.configure)){
            throw new Error("Configurations must contain a configure method!");
        }

        let index = this[configuration].indexOf(Config);
        if(index === -1) return;

        let c = this[configurations][index];


        this[configuration].splice(index, 1);
        this[configurations].splice(index, 1);
        if(isFunction(c.destroy))
            c.destroy();
    }

    plugin(pluginClass, options = {}, global = true) {
        this[checkDestroyed]();

        if(!isFunction(pluginClass.prototype.initialize)){
            throw new Error("Plugins must contain a initialize method!");
        }
        let p = new pluginClass();
        this[applyContext](p, this[mediatorInjections], this[commandInjections], {options: options}, this[parent]?{parentContext: this[parent]}:undefined, {contextDispatcher: this[contextDispatcher]});
        this[plugins].push(p);
        p.initialize(this[injectAsDefault], this[removeAsDefault]);
        
        if(global) {
            this[globalPlugins].push(pluginClass);
        }
        
        return this;
    }

    removePlugin(pluginClass) {
        this[checkDestroyed]();

        if(!isFunction(pluginClass.prototype.initialize)){
            throw new Error("Plugins must contain a initialize method!");
        }

        let p;
        let index;
        for(let i = 0 ; i < this[plugins].length; i++){
            let pi = this[plugins][i];
            if(pi instanceof pluginClass){
                p = pi;
                index = i;
                break;
            }
        }
        
        if(!p) return;

        this[plugins].splice(index, 1);
        if(isFunction(p.destroy))
            p.destroy();

        let gi = this[globalPlugins].indexOf(pluginClass);
        if(gi !== -1)
            this[globalPlugins].splice(gi, 1);
    }

    start() {
        if(this[destroyed]){
            return;
        }

        !this[configured] && this[contextDispatcher].dispatch("starting");

        if(this[parent])
            this[parent].start();

        if(this[configured]){
            this[contextDispatcher].dispatch("started");
            return;
        }
        
        this[configured] = true;

        let configs = this[configuration];
        configs.forEach(this[applyConfiguration]);

        if(!this[contextName]){
            this[contextName] = GUID.generateGUID();
        }

        this[contextDispatcher].dispatch("started");
    }

    get isStarted() {
        return this[configured];
    }

    hasParent(parent) {
        let currentParent = this.parent;

        while(currentParent) {
            if(currentParent === parent){
                return true;
            }
            currentParent = currentParent.parent;
        }

        return false;
    }
    
    stop() {
        this[checkDestroyed]();

        this[contextDispatcher].dispatch("stopping");
        this[commandMap][commandPause](this);
        this[mediatorMap][mediatorPause](this);
        this[eventDispatcher][eventPause](this);
        this[contextDispatcher].dispatch("stopped");
    }

    get children() {
        return this[children].slice();
    }
    
    get parent() {
        return this[parent];
    }
    
    isChildOf(context) {
        if(this[destroyed]) return false;

        let parentContext = this[parent];
        
        while(parentContext){
            if(parentContext === context) return true;
            parentContext = parentContext[parent];
        }
        
        return false;
    }
    
    get destroyed() {
        return this[destroyed];
    }
    
    get dispatcher() {
        return this[eventDispatcher];
    }
    
    destroy() {
        this[destroy]();
    }
}