//properties
export const applyContext = Symbol("fluxtuateContext_applyContext");
export const applyCommandContext = Symbol("fluxtuateContext_applyContext");
export const applyMediatorContext = Symbol("fluxtuateContext_applyContext");
export const applyGuardContext = Symbol("fluxtuateContext_applyGuardContext");
export const store = Symbol("fluxtuateContext_store");
export const mediators = Symbol("fluxtuateContext_mediators");
export const contextDispatcher = Symbol("fluxtuateContext_dispatcher");

//callbacks
export const contextMediatorCallback = Symbol("fluxtuateContext_contextMediatorCallback");
export const contextCommandCallback = Symbol("fluxtuateContext_contextCommandCallback");