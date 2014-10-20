var define, require;
(function() {
    var moduleMap = {};
    var featureMap = {};
    var callbackMap = {};

    define = function(id, feature) {
        featureMap[require.alias(id)] = feature;
    };

    require = function(id) {
        id = require.alias(id);
        var module = moduleMap[id];
        if (module) {
            return module.exports
        }

        var feature = featureMap[id];
        module = moduleMap[id] = {
            exports: {}
        };

        var result = (typeof feature == 'function') ? feature.call(module, require, module.exports, module) : feature;
        if (result) {
            module.exports = result;
        }
        return module.exports;
    };
    require.alias = require.alias = function(id) {return id};
}());