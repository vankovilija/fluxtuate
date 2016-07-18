import Injector from "./injector"

function returnDependantClass(classDependencies, classObject){
    let dependenciesLength = classDependencies.length;
    let previousDependenciesLength = 0;
    if(classObject.totalDependencies){
        previousDependenciesLength = classObject.totalDependencies;
    }

    return class DependenciesClass extends classObject{
        constructor(...props) {
            super();
            if(props.length < classDependencies.length + previousDependenciesLength) {
                throw new Error(`You must provide the dependencies when constructing a new object of ${classObject}!! ${JSON.stringify(classDependencies)}`);
            }
            
            var injector = new Injector();
            classDependencies.forEach((prop, index)=>{
                injector.mapKey(prop).toValue(props[index + previousDependenciesLength]);
            });

            injector.inject(this);
        }

        static get totalDependencies() {
            return dependenciesLength + previousDependenciesLength;
        }
    }
}

export default function dependencies(...props) {
    return returnDependantClass.bind(this, props);
}