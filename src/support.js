var Promise = undefined;
(function() {
    'use strict';
    //属性访问特性
    var attributes = {
        writable: false,
        enumerable: false,
        configurable: false
    };
    //属性访问器
    var accessor = function(value, attrs) {
        var result = Object.create(attrs || attributes);
        result.value = value;
        return result;
    };

    // Function.prototype.bind shim 
    if (!Function.prototype.bind) {
        Object.defineProperty(Function.prototype, 'bind', accessor(function(context) {
            var slice = [].slice,
                args = slice.call(arguments, 1),
                self = this,
                nop = function() {},
                bound = function() {
                    return self.apply(this instanceof nop ? this : (context || {}),
                        args.concat(slice.call(arguments)));
                };
            nop.prototype = self.prototype;
            bound.prototype = new nop();
            return bound;
        }));
    }
    // Object.observe shim 
    if (!Object.observe) {
        Object.defineProperty(Object, 'observe', accessor(function(object, callback) {
            if (!object['[[callbacks]]']) {
                var settings = accessor([]);
                Object.defineProperty(object, '[[callbacks]]', (settings.writable = true, settings));
            }
            typeof callback == 'function' && object['[[callbacks]]'].push(callback);
            return object;
        }));

        /*Object功能支持*/
        var changeConstructor = function(object, name, value) {
            if (object[name] != value) {
                var change = {
                    type: 'updated',
                    name: name,
                    oldValue: object[name],
                    object: object
                };
                if (object[name] == null) {
                    change.type = 'new';
                }
                if (value == null) {
                    change.type = 'delted';
                    delete object[name];
                    return change;
                }
                object[name] = value;
                return change;
            }
            return null;
        }

        Object.defineProperties(Object.prototype, {
            edit: accessor(function(name, value) {
                var me = this;
                var changes = [];
                switch (typeof name) {
                    case 'string':
                        var change = changeConstructor(me, name, value);
                        change && changes.push(change);
                        break;
                    case 'object':
                        var keys = Object.keys(name);
                        keys.forEach(function(i) {
                            var change = changeConstructor(me, i, name[i]);
                            change && changes.push(change);
                        });
                }
                if (changes.length && me['[[callbacks]]']) {
                    me['[[callbacks]]'].forEach(function(callback) {
                        callback.call(me, changes);
                    });
                }
                return this;
            })
        });
    } else {
        Object.defineProperties(Object.prototype, {
            edit: accessor(function(name, value) {
                var me = this;
                switch (typeof name) {
                    case 'string':
                        this[name] = value;
                        break;
                    case 'object':
                        var keys = Object.keys(name);
                        keys.forEach(function(i) {
                            this[i] = name[i];
                        });
                }
                return this;
            })
        });
    }

    // Promise shim
    if (typeof Promise === 'undefined') {
        // 执行回调函数
        var PromiseExec = function(promise) {
            var value = promise['[[PromiseValue]]'];
            var status = promise['[[PromiseStatus]]'];
            promise['[[Process]]'].concat(promise['[[Monitor]]']).forEach(function(i) {
                i(status, value);
            });
            promise['[[Process]]'].length = promise['[[Monitor]]'].length = 0;
        };
        // 异步完成
        var PromiseComplete = function(status, value) {
            if (this['[[PromiseStatus]]'] !== 'pending') {
                return;
            }
            //更改回调值
            this['[[PromiseValue]]'] = value;
            this['[[PromiseStatus]]'] = status;
            PromiseExec(this);
        };

        var PromiseShell = function(callbacks, status, value) {
            //若当前处理环节缺失，则向下传递(冒泡)
            if (typeof this[status] !== 'function') {
                return callbacks[status](value);
            };
            // 执行处理环节
            var result = this[status](value);
            // 若返回值是Promise对象则需要等待其完成后继续下一环节
            if (result instanceof Promise) {
                result.then(function(value) {
                    callbacks['resolved'](value);
                }, function(value) {
                    callbacks['rejected'](value);
                });
            } else {
                // 若是普通值则传递到下一环节
                callbacks['resolved'](result);
            }
        };

        // // 监控模版
        // var monitor = function(queue, status, value) {
        //     if (status.status !== 'pending') {
        //         return;
        //     } else {
        //         status.status = checkStatus.call(queue);
        //         switch (status.status) {
        //             case 'resolved':
        //                 status['resolved']();
        //             case 'rejected':
        //                 status['rejected']();
        //         }
        //     }
        // };
        // // 检查队列
        // var checkStatus = function() {
        //     var status = 'resolved';
        //     this.every(function(i) {
        //         if (i['[[PromiseStatus]]'] == 'resolved') {
        //             return true;
        //         } else {
        //             status = i['[[PromiseStatus]]'];
        //             return false;
        //         }
        //     });
        //     return status;
        // };

        // shim
        Promise = function(fn) {
            var me = this;
            var settings, attrs = Object.create(attributes);
            attrs.writable = true;
            settings = {
                '[[PromiseStatus]]': accessor('pending', attrs), //pending resolved rejected
                '[[PromiseValue]]': accessor(undefined, attrs),
                '[[Process]]': accessor([]),
                '[[Monitor]]': accessor([])
            };
            Object.defineProperties(me, settings);
            fn && fn(PromiseComplete.bind(this, 'resolved'), PromiseComplete.bind(this, 'rejected'));
        };

        Promise.all = function(queue) {
            var original = {
                status: 'pending'
            };
            var pkg, promise = new Promise(function(resolve, reject){
                pkg = function(status, value){
                    //if(original.status ===)
                };
                pkg = {
                    status: 'pending',
                    resolved: function(value){
                        if(this.status !== 'pending') {
                            return ;
                        } else {
                             this.status = checkStatus.call(queue);
                             switch(this.status) {

                             }
                        }
                        

                    },
                    rejected: function(value){

                    }
                };
            });
            queue.forEach(function(i){
                if (i instanceof Promise) {
                    if (i['[[PromiseStatus]]'] === 'pending') {
                        i['[[Monitor]]'].push(pkg);
                    }
                }
            });
            return promise;
        };

        Promise.prototype = {
            then: function(resolve, reject) {
                // 原本的处理
                var original = {
                    resolved: resolve,
                    rejected: reject
                };
                // 封装后的处理
                var pkg, promise = new Promise(function(resolve, reject) {
                    //回调集
                    var callbacks = {
                        resolved: resolve,
                        rejected: reject
                    };
                    pkg = PromiseShell.bind(original, callbacks);
                });

                this['[[Process]]'].push(pkg);
                if (this['[[PromiseStatus]]'] != 'pending') {
                    PromiseExec(this);
                }
                return promise;
            },
            catch: function(reject) {
                return this.then(undefined, reject);
            }
        };
    }
}());