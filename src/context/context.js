import EventDispatcher from "../event-dispatcher"
import chainTwoFunction from "../utils/chainFunctions"
import MediatorMap from "../mediator/mediator-map"
import MediatorModelWrapper from "../mediator/mediator-model-wrapper"
import Store from "../model/store"
import CommandMap from "../command/command-map"
import CommandModelWrapper from "../command/command-model-wrapper"
import Injector from "../inject/injector"
import {applyContext, applyCommandContext, applyMediatorContext, contextMediatorCallback, store} from "./_internals"
import {isFunction} from "lodash/lang"

import {getInjectValue, globalValues, defaultValues, isPropertyInjection} from "../inject/_internals"
import {destroy as commandDestroy, pause as commandPause, resume as commandResume} from "../command/_internals"
import {destroy as mediatorDestroy, pause as mediatorPause, resume as mediatorResume} from "../mediator/_internals"
import {destroy as eventDestroy, pause as eventPause, resume as eventResume} from "../event-dispatcher/_internals"

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
const contextDispatcher = Symbol("fluxtuateContext_dispatcher");
const applyConfiguration = Symbol("fluxtuateContext_applyConfiguration");
const injectAsDefault = Symbol("fluxtuateContext_injectAsDefault");
const removeAsDefault = Symbol("fluxtuateContext_removeAsDefault");
const checkDestroyed = Symbol("fluxtuateContext_checkDestroyed");
const commandInjections = Symbol("fluxtuateContext_commandInjections");
const mediatorInjections = Symbol("fluxtuateContext_mediatorInjections");

const models = Symbol("fluxtuateContext_models");

export default class Context {
    constructor() {
        this[destroyed] = false;

        this[models] = {};
        this[storeModels] = [];
        this[eventDispatcher] = new EventDispatcher();
        this[plugins] = [];
        this[globalPlugins] = [];
        this[children] = [];
        this[commandInjections] = {};
        this[mediatorInjections] = {};
        this[parent] = undefined;

        this[mediatorMap] = new MediatorMap(this);
        this[commandMap] = new CommandMap(this[eventDispatcher], this);
        this[injector] = new Injector(this, this[eventDispatcher], this[mediatorMap], this[commandMap]);

        Object.defineProperty(this, "commandMap", {
            get() {
                return this[commandMap];
            }
        });

        Object.defineProperty(this, "mediatorMap", {
            get() {
                return this[commandMap];
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

        this[contextDispatcher] = new EventDispatcher();

        this[applyContext] = (instance, ...injections) => {
            this[injector].inject.apply(this[injector], [instance, ...injections]);
        };

        this[applyMediatorContext] = (instance, ...injections) => {
            let modelInjections = {};

            for(let key in this[models]) {
                modelInjections[key] = new MediatorModelWrapper(this[models][key].modelInstance, this, instance);
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

            this[applyContext].apply(this, [instance, modelInjections, this[mediatorInjections], ...injections]);
        };

        this[applyCommandContext] = (instance, ...injections) => {
            let modelInjections = {};
            
            for(let key in this[models]) {
                modelInjections[key] = new CommandModelWrapper(this[models][key].modelInstance, this, instance);
            }

            if(instance.then){
                instance.then(()=>{
                    for(let key in modelInjections) {
                        modelInjections[key].destroy();
                    }
                });
            }
            
            this[applyContext].apply(this, [instance, modelInjections, this[commandInjections], ...injections]);
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

        this[addParent] = (parentContext) => {
            if (parentContext) {
                parentContext[eventDispatcher].addChild(this[eventDispatcher]);

                let values = parentContext[injector][globalValues].slice();
                let pgns = parentContext[globalPlugins].slice();
                this[addParentValues](values, pgns, parentContext[injector][getInjectValue], parentContext[injector][defaultValues]);

                this[parent] = parentContext;
            }
        };

        this[addParentValues]= (values, pgns, getFunction, defaultValues) => {
            values.forEach(key=>{
                let value = getFunction(key);
                this[injectAsDefault](key, value, defaultValues[key], true, value[isPropertyInjection]?"property":"value");
            });

            pgns.forEach(plugin=> {
                if(this[globalPlugins].indexOf(plugin) !== -1) return;
                this.plugin(plugin);
            });

            this.children.forEach(c=>{
                c[addParentValues](values, pgns, getFunction, defaultValues);
            });
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

        this[storeFunction] = (modelClass, storeName, injectionKey, description) => {
            if(this[storeModels].indexOf(storeName) !== -1) {
                throw new Error(`Stores can only be registered once per context, you are trying to register the store ${storeName} twice!`)
            }
            if(!description) {
                description = `A key to get the ${storeName}`
            }

            if(!injectionKey) {
                injectionKey = storeName;
            }

            let model = this[store].mapModel(modelClass).toKey(storeName);
            this[injectAsDefault](injectionKey, {object: model, property: "modelInstance"}, description, false, "none");
            this[models][injectionKey] = model;

            this[storeModels].push(storeName);
        };

        this[applyConfiguration] = (Config)=>{
            let config = new Config();
            this[applyContext](config, {store: this[storeFunction]}, this[parent]?this[parent][injector]:undefined, this[parent]?{parentContext: this[parent]}:undefined);
            config.configure();
            this[configurations].push(config);
        };
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
        this[applyContext](p, {options: options}, this[parent]?this[parent][injector]:undefined, this[parent]?{parentContext: this[parent]}:undefined, {contextDispatcher: this[contextDispatcher]});
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
        this[checkDestroyed]();

        if(this[configured]) {
            this[restart]();
            return;
        }

        this[contextDispatcher].dispatch("starting");

        if(this[parent] && !this[parent][configured])
            this[parent].start();

        if(!this[parent]){
            this[store] = new Store();
        }else{
            this[store] = this[parent][store];
        }
        
        this[configured] = true;

        let configs = this[configuration];
        configs.forEach(this[applyConfiguration]);

        this[contextDispatcher].dispatch("started");
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
    
    destroy() {
        if(this[destroyed]) return;

        if(this[parent])
            this[parent].removeChild(this);

        let l = this[children].length;
        while(--l > -1) {
            let c = this[children][l];
            if(isFunction(c.destroy))
                c.destroy();
        }

        while(this[storeModels].length > 0) {
            this[store].unmapModelKey(this[storeModels].pop());
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

        this[plugins] = [];
        this[destroyed] = true;
        this[parent] = undefined;
    }
}