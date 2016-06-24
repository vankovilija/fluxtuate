export default function invokeFunction(callback, args) {
    var i, code = "callback(";
    for (i=0; i<args.length; i++) {
        if (i) { code += "," }
        code += "args[" + i + "]";
    }
    eval(code + ");");
}