import Injector from "./injector"

function returnGeneric(genericProperties, classObject){
    return class GenericsClass extends classObject{
        constructor(...props) {
            super();
            if(props.length !== genericProperties.length) {
                throw new Error(`You must provide the generics when constructing a new object of this class!! ${JSON.stringify(genericProperties)}`);
            }
            
            var injector = new Injector();
            genericProperties.forEach((prop, index)=>{
                injector.mapKey(prop).toValue(props[index]);
            });

            injector.inject(this);
        }
    }
}

export default function generics(...props) {
    return returnGeneric.bind(this, props);
}