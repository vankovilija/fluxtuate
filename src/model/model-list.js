import Model from "./model"

const models = Symbol("fluxtuateModelList_models");

export default class ModelList {
    constructor(childrenModelClass) {
        if((childrenModelClass === Model) || !(childrenModelClass.prototype instanceof Model)){
            throw new Error("You must provide a Model to be the base type of the ModelList!");
        }

        this[models] = [];
    }

    findModel(primaryKey) {
        for(let i = 0; i < this[models].length; i++){
            if(this[models][i].primaryKey === primaryKey){
                return this[models][i];
            }
        }
    }

    addModel(model){
        let existingModel = this.findModel(model.primaryKey);
        if(existingModel){
            this[models].splice(this[models].indexOf(existingModel), 1, model);
            return;
        }
        this[models].push(model);
    }

    removeModel(primaryKey) {
        let existingModel = this.findModel(primaryKey);
        if(existingModel){
            this[models].splice(this[models].indexOf(existingModel), 1);
        }
    }
}