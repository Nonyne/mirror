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
        // 快捷创建
        var PromiseCreate = function(init, status, value) {
            var promise = new Promise(init);
            status && (promise['[[PromiseStatus]]'] = status);
            value && (promise['[[PromiseValue]]'] = value);
            return promise;
        };

        // 执行回调环节
        var PromiseExec = function(promise) {
            var value = promise['[[PromiseValue]]'];
            var status = promise['[[PromiseStatus]]'];
            promise['[[Process]]'].concat(promise['[[Monitor]]']).forEach(function(i) {
                i(status, value);
            });
            promise['[[Process]]'].forEach(function(i) {
                setTimeout(function() {
                    i.next(status, value);
                });
            });
            promise['[[Process]]'].length = promise['[[Monitor]]'].length = 0;
        };
        // 异步完成
        var PromiseComplete = function(status, value) {
            var me = this;
            if (me['[[PromiseStatus]]'] !== 'pending') {
                return;
            }
            //更改回调值
            me['[[PromiseValue]]'] = value;
            me['[[PromiseStatus]]'] = status;
            PromiseExec(me);
        };
        // then回调壳子
        var PromiseShell = function(status, value) {
            if (typeof this[status] === 'function') {
                return this.result = this[status](value);
            };
        };
        // next回调壳子
        var PromiseNext = function(callbacks, status, value) {
            if ('result' in this) {
                var result = this.result;
                if (result instanceof Promise) {
                    result.then(function(value) {
                        callbacks['resolved'](value);
                    }, function(value) {
                        callbacks['rejected'](value);
                    });
                } else {
                    callbacks['resolved'](result);
                }
                return;
            }
            callbacks[status](value);
        };

        // 监控模版
        var PromiseMonitorAll = function(queue, callbacks) {
            if (this.status !== 'pending') {
                return;
            }
            var status = 'resolved';
            var result = [];
            queue.every(function(i) {
                if (i['[[PromiseStatus]]'] == 'resolved') {
                    result.push(i['[[PromiseValue]]']);
                    return true;
                } else {
                    status = i['[[PromiseStatus]]'];
                    result = i['[[PromiseValue]]'];
                    return false;
                }
            });
            if (status !== 'pending') {
                callbacks[this.status = status](result);
            }
        };

        var PromiseMonitorRace = function(queue, callbacks) {
            var me = this;
            if (me.status !== 'pending') {
                return;
            }
            queue.some(function(i) {
                if (i['[[PromiseStatus]]'] !== 'pending') {
                    var status = i['[[PromiseStatus]]'];
                    var result = i['[[PromiseValue]]'];
                    callbacks[me.status = status](result);
                    return false;
                }
            });
        };

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
        // all
        Promise.all = function(queue) {
            var original = {
                status: 'pending'
            };
            var shell, promise = PromiseCreate(function(resolve, reject) {
                var callbacks = {
                    resolved: resolve,
                    rejected: reject
                };
                shell = PromiseMonitorAll.bind(original, queue, callbacks);
            });
            var result = queue.filter(function(i) {
                if (!(i instanceof Promise)) {
                    return false;
                }
                if (i['[[PromiseStatus]]'] === 'pending') {
                    return i['[[Monitor]]'].push(shell);
                }
            });
            !result.length && shell();
            return promise;
        };
        // race
        Promise.race = function(queue) {
            var original = {
                status: 'pending'
            };
            var shell, promise = PromiseCreate(function(resolve, reject) {
                var callbacks = {
                    resolved: resolve,
                    rejected: reject
                };
                shell = PromiseMonitorRace.bind(original, queue, callbacks);
                queue.every(function(i) {
                    if (!(i instanceof Promise)) {
                        return true;
                    }
                    if (i['[[PromiseStatus]]'] === 'pending') {
                        return i['[[Monitor]]'].push(shell);
                    } else {
                        callbacks[original.status = i['[[PromiseStatus]]']](i['[[PromiseValue]]']);
                        return false;
                    }
                });
            });
            return promise;
        };
        Promise.resolve = PromiseCreate.bind(Promise, null, 'resolved');
        Promise.reject = PromiseCreate.bind(Promise, null, 'rejected');

        Promise.prototype = {
            then: function(resolve, reject) {
                //if(this['[[Super]]'])
                // 原本的处理
                var me = this;
                var original = {
                    resolved: resolve,
                    rejected: reject
                };
                // 封装后的处理
                var shell, promise = PromiseCreate(function(resolve, reject) {
                    shell = PromiseShell.bind(original);
                    shell.next = PromiseNext.bind(original, {
                        resolved: resolve,
                        rejected: reject
                    });
                });

                me['[[Process]]'].push(shell);
                if (me['[[PromiseStatus]]'] != 'pending') {
                    PromiseExec(me);
                }
                return promise;
            },
            catch: function(reject) {
                return this.then(undefined, reject);
            }
        };
    }
}());