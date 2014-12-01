var Promise;
(function() {
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
            var me = this;
            var slice = [].slice
            var args = slice.call(arguments, 1);
            var nop = function() {};
            var bound = function() {
                return me.apply(this instanceof nop ? this : (context || {}),
                    args.concat(slice.call(arguments)));
            };
            nop.prototype = me.prototype;
            bound.prototype = new nop();
            return bound;
        }));
    }
    // Object.observe shim
    Object.observe = undefined;
    if (!Object.observe) {
        Object.defineProperties(Object, {
            observe: accessor(function(object, callback) {
                if (!object['[[callbacks]]']) {
                    Object.defineProperty(object, '[[callbacks]]', accessor([]));
                }
                typeof callback == 'function' && object['[[callbacks]]'].push(callback);
                return object;
            }),
            unobserve: accessor(function(object, callback) {
                var index, cbs = object['[[callbacks]]'];
                if (cbs) {
                    (index = cbs.indexOf(callback)) !== -1 && cbs.splice(index, 1);
                }
                return object;
            })
        });

        /*Object功能支持*/
        var changeConstructor = function(name, value) {
            if (this[name] !== value) {
                var change = {
                    type: 'updated',
                    name: name,
                    oldValue: this[name],
                    object: this
                };
                if (value === undefined) {
                    change.type = 'delted';
                    delete this[name];
                } else if (this[name] === undefined) {
                    change.type = 'new';
                    this[name] = value;
                } else {
                    this[name] = value;
                }
                return change;
            }
            return;
        };
        //编辑扩展
        Object.defineProperties(Object.prototype, {
            edit: accessor(function(name, value) {
                var me = this;
                var changes = [];
                switch (typeof name) {
                    case 'string':
                        var change = changeConstructor.call(me, name, value);
                        change && changes.push(change);
                        break;
                    case 'object':
                        var keys = Object.keys(name);
                        keys.forEach(function(i) {
                            var change = changeConstructor.call(me, i, name[i]);
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
var Mirror = function() {
    var emptyArray = [];
    var some = emptyArray.some;
    var every = emptyArray.every;
    var slice = emptyArray.slice;
    var concat = emptyArray.concat;
    var filter = emptyArray.filter;
    var methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'];
    // 紧密化数组
    function compact(array) {
            return filter.call(array, function(item) {
                return item !== null;
            });
        }
        // 扁平化数组
    function flatten(array) {
            return array.length > 0 ? concat.apply([], array) : array;
        }
        // 去除重复
    function uniq(array) {
            return filter.call(array, function(item, idx) {
                return array.indexOf(item) == idx
            });
        }
        // 混入对象
    function mix(target, source, deep) {
            var keys = Object.keys(source);
            keys.forEach(function(key) {
                var type = $.type(source[key]),
                    temp;
                switch (type) {
                    case 'undefined':
                        break;
                    case 'array':
                        temp = [];
                    case 'object':
                        temp = temp || {};
                        if (deep) {
                            mix(target[key] = temp, source[key], deep);
                            break;
                        }
                    default:
                        target[key] = source[key];
                }
            });
            return target;
        }
        // 函数化参数处理
    function fnArgument(context, fn, idx, payload) {
            return $.type(fn) === 'function' ? fn.call(context, idx, payload) : fn;
        }
        // 选择器参数过滤
    function filtered(nodes, selector) {
            return selector == null ? $(nodes) : $(nodes).filter(selector)
        }
        // 取子节点
    function children(node) {
            return 'children' in node ?
                slice.call(node.children) :
                $.map(node.childNodes, function(node) {
                    if (node.nodeType == 1) return node
                })
        }
        // 设置属性
    function setAttribute(node, name, value) {
            value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
        }
        // 样式设置
    function className(node, value) {
            var cls = node.className || '',
                svg = cls && cls.baseVal !== undefined

            if (value === undefined) {
                return svg ? cls.baseVal : cls
            }
            svg ? (cls.baseVal = value) : (node.className = value)
        }
        // 遍历处理节点
    function traverseNode(node, fun) {
        fun(node);
        slice.call(node.childNodes).forEach(function(i) {
            traverseNode(i, fun);
        });
    }

    var elementDisplay = {};

    function defaultDisplay(nodeName) {
        var element, display
        if (!elementDisplay[nodeName]) {
            element = document.createElement(nodeName)
            document.body.appendChild(element)
            display = getComputedStyle(element, '').getPropertyValue("display")
            element.parentNode.removeChild(element)
            display == "none" && (display = "block")
            elementDisplay[nodeName] = display
        }
        return elementDisplay[nodeName]
    }

    //CSS纯数字属性列表
    var cssNumber = {
        'column-count': 1,
        'columns': 1,
        'font-weight': 1,
        'line-height': 1,
        'opacity': 1,
        'z-index': 1,
        'zoom': 1
    };

    // CSS属性名替换 js to css
    function dasherize(str) {
            return str.replace(/::/g, '/')
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
                .replace(/([a-z\d])([A-Z])/g, '$1_$2')
                .replace(/_/g, '-')
                .toLowerCase()
        }
        // CSS属性名替换 css to js
    function camelize(str) {
            return str.replace(/-+(.)?/g, function(match, chr) {
                return chr ? chr.toUpperCase() : ''
            });
        }
        // CSS数值增加px
    function maybeAddPx(name, value) {
        return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
    }

    // 公用对象
    var $ = window['$'] = function(selector, context) {
        return mirror.init(selector, context);
    };

    // 方法集
    var readys = ['complete', 'loaded', 'interactive'];
    $.fn = {
        some: some,
        every: every,
        filter: filter,
        concat: concat,
        forEach: emptyArray.forEach,
        reduce: emptyArray.reduce,
        push: emptyArray.push,
        sort: emptyArray.sort,
        indexOf: emptyArray.indexOf,
        ready: function(fn) {
            // readyRE = /complete|loaded|interactive/,
            var readied = ['complete', 'loaded', 'interactive'].indexOf(document.readyState) > -1;
            if (readied && document.body) {
                fn($);
            } else {
                document.addEventListener('DOMContentLoaded', function() {
                    fn($)
                }, false);
            }
            return this;
        },
        map: function(fn) {
            return $($.map(this, function(node, index) {
                return fn.call(node, index, node);
            }))
        },
        slice: function() {
            return $(slice.apply(this, arguments));
        },
        eq: function(index) {
            return index === -1 ? this.slice(index) : this.slice(index, +index + 1);
        },
        get: function(index) {
            return index === undefined ? slice.call(this) : this[index >= 0 ? index : index + this.length];
        },
        toArray: function() {
            return this.get();
        },
        size: function() {
            return this.length;
        },
        is: function(selector) {
            return this.length > 0 && mirror.matches(this[0], selector);
        },
        not: function(selector) {
            var nodes = [];
            var type = $.type(selector);
            if (type === 'function' && selector.call !== undefined) {
                this.each(function(index) {
                    if (!selector.call(this, index)) {
                        nodes.push(this);
                    }
                });
            } else {
                var excludes;
                switch (type) {
                    case 'string':
                        excludes = this.filter(selector);
                        break;
                    case 'nodelist':
                        excludes = slice.call(selector);
                        break;
                    default:
                        excludes = $(selector);
                }
                this.forEach(function(node) {
                    if (excludes.indexOf(node) < 0) {
                        nodes.push(node);
                    }
                });
            }
            return nodes;
        },
        add: function(selector, context) {
            return $(uniq(this.concat($(selector, context))))
        },
        remove: function() {
            return this.each(function() {
                var parent = this.parentNode;
                parent && parent.removeChild(this);
            });
        },
        filter: function(selector) {
            if ($.type(selector) === 'function') {
                return this.not(selector);
            }
            return $(filter.call(this, function(node) {
                return mirror.matches(node, selector);
            }))
        },
        find: function(selector) {
            var result, me = this;
            switch ($.type(selector)) {
                case 'undefined':
                    result = [];
                    break;
                case 'object':
                    result = $(selector).filter(function() {
                        var node = this;
                        return some.call(me, function(parent) {
                            return $.contains(parent, node);
                        });
                    });
                    break;
                default:
                    if (this.length == 1) {
                        result = $(mirror.querySelectorAll(this[0], selector));
                    } else {
                        result = this.map(function() {
                            return mirror.querySelectorAll(this, selector);
                        });
                    }
            }
            return $(uniq(result));
        },
        closest: function(selector, context) {
            var node = this[0];
            while (node && !mirror.matches(node, selector)) {
                node = node.parentNode;
                if (node === context || !node.tagName) {
                    node = null;
                }
            }
            return $(node);
        },
        parents: function(selector) {
            var ancestors = [],
                nodes = this;
            while (nodes.length > 0) {
                nodes = $.map(nodes, function(node) {
                    if ((node = node.parentNode) && node.nodeType !== 9 && ancestors.indexOf(node) < 0) {
                        ancestors.push(node);
                        return node;
                    }
                });
            }
            return filtered(ancestors, selector);
        },
        //取属性数组
        pluck: function(property) {
            return $.map(this, function(el) {
                return el[property]
            });
        },
        parent: function(selector) {
            return filtered(uniq(this.pluck('parentNode')), selector)
        },
        children: function(selector) {
            return filtered(this.map(function() {
                return children(this)
            }), selector)
        },
        each: function(fn) {
            every.call(this, function(el, idx) {
                return fn.call(el, idx, el) !== false;
            });
            return this;
        },
        empty: function() {
            return this.each(function() {
                this.innerHTML = '';
            });
        },
        text: function(text) {
            return 0 in arguments ?
                this.each(function(idx) {
                    var newText = fnArgument(this, text, idx, this.textContent)
                    this.textContent = newText == null ? '' : '' + newText
                }) :
                (0 in this ? this[0].textContent : null)
        },
        html: function(html) {
            return 0 in arguments ? this.each(function(idx) {
                var originHtml = this.innerHTML;
                this.innerHTML = fnArgument(this, html, idx, originHtml);
            }) : (0 in this ? this[0].innerHTML : null);
        },
        attr: function(name, value) {
            var result;
            return (typeof name == 'string' && !(1 in arguments)) ?
                (!this.length || this[0].nodeType !== 1 ? undefined :
                    (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
                ) :
                this.each(function(idx) {
                    var me = this;
                    if (me.nodeType !== 1) {
                        return;
                    }
                    if ($.type(name) === 'object') {
                        $.each(name, function(key, val) {
                            setAttribute(me, key, val);
                        });
                    } else {
                        setAttribute(me, name, fnArgument(me, value, idx, me.getAttribute(name)));
                    }
                });
        },
        css: function(property, value) {
            var me = this;
            var type = $.type(property);
            if (me.length === 0) {
                return;
            }
            if (arguments.length < 2) {
                var node = me[0];
                var computedStyle = getComputedStyle(node, '');
                switch (type) {
                    case 'string':
                        return node.style[camelize(property)] || computedStyle.getPropertyValue(property);
                    case 'array':
                        var props = {}
                        $.each(property, function(index, prop) {
                            props[prop] = (node.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
                        })
                        return props
                }
            }

            var css = ''
            if (type == 'string') {
                if (!value && value !== 0) {
                    me.each(function() {
                        this.style.removeProperty(dasherize(property))
                    });
                } else {
                    css = dasherize(property) + ":" + maybeAddPx(property, value)
                }
            } else {
                $.each(property, function(key, value) {
                    if (!value && value !== 0) {
                        me.each(function() {
                            this.style.removeProperty(dasherize(key))
                        });
                    } else {
                        css += dasherize(key) + ':' + maybeAddPx(key, value) + ';'
                    }
                });
            }
            return me.each(function() {
                this.style.cssText += ';' + css
            });
        },
        hasClass: function(name) {
            if (!name) {
                return false;
            }
            return some.call(this, function(i) {
                return className(i).split(/\s+/g).indexOf(name) != -1;
            });
        },
        addClass: function(name) {
            if (!name) {
                return this;
            }
            return this.each(function(index) {
                if (!('className' in this)) {
                    return;
                }
                var cls = (cls = className(this)) === '' ? [] : cls.split(/\s+/g);
                fnArgument(this, name, index, cls).split(/\s+/g).forEach(function(i) {
                    if (cls.indexOf(i) == -1) {
                        cls.push(i);
                    }
                });
                className(this, cls.join(' '));
            });
        },
        removeClass: function(name) {
            return this.each(function(index) {
                if (!('className' in this)) {
                    return;
                }
                if (name === undefined) {
                    return (this.className = '');
                }
                var cls = (cls = className(this)) === '' ? [] : cls.split(/\s+/g);
                fnArgument(this, name, index, cls).split(/\s+/g).forEach(function(i) {
                    var idx = cls.indexOf(i);
                    if (idx != -1) {
                        cls.splice(idx, 1);
                    }
                });
                className(this, cls.join(' '));
            });
        },
        toggleClass: function(name, when) {
            if (!name) {
                return this;
            }
            return this.each(function(index) {
                var me = $(this);
                var cls = (cls = className(this)) === '' ? [] : cls.split(/\s+/g);
                fnArgument(this, name, index, cls).split(/\s+/g).forEach(function(i) {
                    if (when === undefined ? !me.hasClass(i) : when) {
                        me.addClass(i);
                    } else {
                        me.removeClass(i);
                    }
                });
            });
        },
        show: function() {
            return this.each(function() {
                var me = $(this);
                me.attr('hidden') && me.attr('hidden', null);
                me.css('display') == "none" && me.css('display', '');
                if (getComputedStyle(this, '').getPropertyValue("display") == "none") {
                    me.css('display', defaultDisplay(this.nodeName));
                }
            });
        },
        hide: function() {
            return this.attr('hidden', true);
        }
    };

    ['after', 'prepend', 'before', 'append'].forEach(function(attr, index) {
        var inside = index % 2 //=> prepend, append;
        $.fn[attr] = function() {
            var nodes = $.map(arguments, function(i, index) {
                return $(i);
            });
            var copy = this.length > 1;
            var parent, target;

            return this.each(function() {
                parent = inside ? this : this.parentNode;
                target = index == 0 ? this.nextSibling :
                    index == 1 ? this.firstChild :
                    index == 2 ? this : null;
                var parentInDocument = $.contains(document.documentElement, parent);

                nodes.forEach(function(node) {
                    if (copy) {
                        node = node.cloneNode(true);
                    } else if (!parent) {
                        return $(node).remove();
                    }

                    parent.insertBefore(node, target)
                    if (parentInDocument) {
                        traverseNode(node, function(el) {
                            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' && (!el.type || el.type === 'text/javascript') && !el.src) {
                                window['eval'].call(window, el.innerHTML);
                            }
                        });
                    }
                });

            });
        };
        // after    => insertAfter
        // prepend  => prependTo
        // before   => insertBefore
        // append   => appendTo
        $.fn[inside ? attr + 'To' : 'insert' + (index ? 'Before' : 'After')] = function(html) {
            $(html)[attr](this);
            return this;
        };
    });

    // 原型判断
    $.is = function(object) {
        return object instanceof mirror.proto;
    };

    // 类型判断
    $.type = function(target) {
        var result = typeof target;
        switch (result) {
            case 'object':
                if (target === null) {
                    return 'null';
                } else if (Node && target instanceof Node) {
                    switch (target.nodeType) {
                        case 3:
                            return 'text';
                        case 9:
                            return 'document';
                        case 1:
                            return 'node';
                    }
                } else {
                    return toString.call(target).replace(/^\[object (\w+)\]$/, '$1').toLowerCase();
                }
                break;
        }
        return result;
    };
    // 函数切片
    $.aop = function(fns, context) {
        if ($.type(fns) != 'array') {
            fns = [];
        }
        var aop = function() {
            var me = context || this;
            var args = slice.call(arguments, 0);
            fns.some(function(fn) {
                return $.type(fn) == 'function' && fn.apply(me, args) === false;
            });
        };
        aop[':callbacks'] = fns;
        return aop;
    };

    // 遍历对象
    $.each = function(target, fn) {
        if (target.some) {
            target.some(function(i, index) {
                return fn.call(i, index, i) === false;
            });
        } else {
            var keys = Object.keys(target);
            keys.some(function(i) {;
                return fn.call(target[i], i, target[i]) === false;
            });
        }
        return target;
    };
    // 映射对象
    $.map = function(target, fn) {
            var value, values = [];
            $.each(target, function(index, i) {
                var value = fn(i, index, target);
                if (value != null) {
                    values.push(value);
                }
            });
            return flatten(values);
        }
        // 扩展对象
    $.extend = function(target) {
        var deep, args = slice.call(arguments, 1);
        if (typeof target == 'boolean') {
            deep = target;
            target = args.shift();
        }
        args.forEach(function(arg) {
            mix(target, arg, deep);
        });
        return target;
    };

    // 是否包含
    $.contains = document.documentElement.contains ?
        function(parent, node) {
            return parent !== node && parent.contains(node)
        } :
        function(parent, node) {
            while (node && (node = node.parentNode))
                if (node === parent) return true
            return false
        }

    // HTML片段构造
    var fragmentRE = /^\s*<(\w+|!)[^>]*>/;
    var singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/;
    var table = document.createElement('table');
    var tableRow = document.createElement('tr');
    var containers = {
        'tr': document.createElement('tbody'),
        'tbody': table,
        'thead': table,
        'tfoot': table,
        'td': tableRow,
        'th': tableRow,
        '*': document.createElement('div')
    };

    // 私密对象
    var mirror = {
        // 对象原型
        proto: function(nodes, selector) {
            nodes = nodes || [];
            nodes.__proto__ = $.fn;
            nodes.selector = selector || '';
            return nodes;
        },
        // 初始化
        init: function(selector, context) {
            var nodes;
            // 无参数对象
            if (!selector) {
                return mirror.proto();
            }
            // 已转换对象
            if ($.is(selector)) {
                return selector;
            }

            switch ($.type(selector)) {
                case 'function':
                    return $(document).ready(selector);
                case 'array':
                    nodes = compact(selector), selector = null;
                    break;
                case 'nodelist':
                    nodes = slice.call(selector), selector = null;
                    break;
                case 'string':
                    selector = selector.trim();
                    if (selector[0] == '<') {
                        return mirror.fragment(selector, context);
                    } else if (context !== undefined) {
                        return $(context).find(selector);
                    } else {
                        nodes = mirror.querySelectorAll(document, selector);
                    }
                    break;
                default:
                    nodes = [selector], selector = null;
            }
            return mirror.proto(nodes, selector);
        },
        querySelectorAll: function(node, selector) {
            switch ($.type(node)) {
                case 'node':
                case 'document':
                    return slice.call(node.querySelectorAll(selector));
            }
            return [];
        },
        //片段构建
        fragment: function(html, properties) {
            var nodes, container;
            // 唯标记
            if (singleTagRE.test(html)) {
                nodes = $(document.createElement(RegExp.$1));
            }
            // 复合结构
            if (!nodes) {
                var name = fragmentRE.test(html) && RegExp.$1;
                container = containers[name in containers ? name : '*'];
                container.innerHTML = '' + html;
                nodes = $(slice.call(container.childNodes)).each(function() {
                    container.removeChild(this);
                });
            }

            if ($.type(properties) == 'object') {
                $.each(properties, function(key, value) {
                    if (methodAttributes.indexOf(key) > -1) {
                        nodes[key](value);
                    } else {
                        nodes.attr(key, value);
                    }
                });
            }

            return nodes;
        },
        // matches
        matches: function(node, selector) {
            if (!selector || !node || node.nodeType !== 1) {
                return false;
            }
            var matchFn = node.matches || node.webkitMatchesSelector || node.mozMatchesSelector || node.oMatchesSelector || node.msMatchesSelector || node.matchesSelector;
            if (matchFn) {
                return matchFn.call(node, selector);
            } else {
                var match, parent = node.parentNode,
                    temp = !parent;
                temp && (parent = tempParent).appendChild(node);
                match = ~mirror.querySelectorAll(parent, selector).indexOf(node)
                temp && tempParent.removeChild(node);
                return !!match;
            }
        }
    };
    /* mirror.proto.prototype = $.fn; */
    return $;
}();
;(function($) {
    var slice = Array.prototype.slice;
    var returnTrue = function() {
        return true
    };
    var returnFalse = function() {
        return false
    };
    // 句柄缓存
    var _mid = 1;
    function mid(target) {
        return target._mid || (target._mid = _mid++);
    }
    // 句柄模型
    function parse(event) {
        return {
            e: event
        };
    }
    // 句柄查询
    var handlers = window['handlers'] = {};
    function findHandlers(node, event, fn, selector) {
        var ev = parse(event);
        return (handlers[mid(node)] || []).filter(function(handler) {
            return (!ev.e || handler.e == ev.e) && (!fn || handler.fn === fn) && (!selector || handler.selector == selector);
        });
    }

    var focusinSupported = 'onfocusin' in window;
    var focus = {
        focus: 'focusin',
        blur: 'focusout'
    };
    var hover = {
        mouseenter: 'mouseover',
        mouseleave: 'mouseout'
    };
    var eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
    };

    function realEvent(type) {
        return hover[type] || (focusinSupported && focus[type]) || type;
    }

    function eventCapture(handler, captureSetting) {
        return handler.del && (!focusinSupported && (handler.e in focus)) || !!captureSetting;
    }

    function compatible(event, source) {
        if (source || !event.isDefaultPrevented) {
            source || (source = event)
            $.each(eventMethods, function(name, predicate) {
                var sourceMethod = source[name]
                event[name] = function() {
                    this[predicate] = returnTrue
                    return sourceMethod && sourceMethod.apply(source, arguments)
                }
                event[predicate] = returnFalse
            })

            if (source.defaultPrevented !== undefined ? source.defaultPrevented :
                'returnValue' in source ? source.returnValue === false :
                source.getPreventDefault && source.getPreventDefault())
                event.isDefaultPrevented = returnTrue
        }
        return event
    }
    // 添加事件句柄
    function addHandler(node, events, fn, data, selector, delegator, capture) {
        var id = mid(node);
        var handler = handlers[id] || (handlers[id] = []);
        events.split(/\s/).forEach(function(event) {
            if (event == 'ready') {
                return $(document).ready(fn);
            }
            var ev = parse(event);
            ev.fn = fn;
            ev.selector = selector;
            if (ev.e in hover) {
                fn = function() {
                    var related = e.relatedTarget;
                    if (!related || (related !== this && !$.contains(this, related))) {
                        return handler.fn.apply(this, arguments)
                    }
                }
            }
            // handler.del = delegator;
            var callback = delegator || fn;
            ev.proxy = function(e) {
                e = compatible(e);
                if (e.isImmediatePropagationStopped()) {
                    return;
                }
                e.data = data;
                var result = callback.apply(node, e._args == undefined ? [e] : [e].concat(e._args));
                if (result === false) {
                    e.preventDefault(), e.stopPropagation()
                }
                return result;
            }
            ev.i = handler.length;
            handler.push(ev);
            if ('addEventListener' in node) {
                node.addEventListener(realEvent(ev.e), ev.proxy, eventCapture(ev, capture))
            }
        });
    }
    // 移除事件句柄
    function removeHandler(node, events, fn, selector, capture) {
        var id = mid(node);
        (events || '').split(/\s/).forEach(function(event) {
            findHandlers(node, event, fn, selector).forEach(function(handler) {
                delete handlers[id][handler.i]
                if ('removeEventListener' in node) {
                    node.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture));
                }
            })
        })
    }

    // event proxy
    function createProxy(e) {
        var proxy = {
            originalEvent: event
        };
        Object.keys(e).forEach(function(i) {
            proxy[i] = e[i];
        });
        return proxy;
    };
    // extend method
    $.extend($.fn, {
        on: function(event, selector, data, fn, one) {
            var me = this;
            var autoRemove, delegator;
            var eventType = $.type(event);
            // 没有selector
            if ($.type(selector) !== 'string' && $.type(fn) !== 'function' && fn !== false) {
                fn = data, data = selector, selector = undefined;
            }
            // 没有data
            if ($.type(data) == 'function' || data === false) {
                fn = data, data = undefined;
            }
            // 停止冒泡
            if (fn === false) {
                fn = returnFalse;
            }
            // 增加事件
            return me.each(function(index, node) {
                // 自动移除
                if (one) {
                    autoRemove = function(e) {
                        removeHandler(node, e.type, fn);
                        return fn.apply(this, arguments);
                    }
                }
                // 委托
                if (selector) {
                    delegator = function(e) {
                        var ev, match = $(e.target).closest(selector, node).get(0);
                        if (match && match !== node) {
                            ev = $.extend(createProxy(e), {
                                currentTarget: match,
                                liveFired: node
                            });
                            return (autoRemove || fn).apply(match, [ev].concat(slice.call(arguments, 1)))
                        }
                    }
                }
                addHandler(node, event, fn, data, selector, delegator || autoRemove);
            });
        },
        off: function(event, selector, fn) {
            var me = this;
            var eventType = $.type(event);
            // 没有selector
            if ($.type(selector) !== 'string' && $.type(fn) !== 'function' && fn !== false) {
                fn = selector, selector = undefined;
            }
            // 停止冒泡
            if (fn === false) {
                fn = returnFalse;
            }
            // 移除事件
            return me.each(function() {
                removeHandler(this, event, fn, selector);
            });
        }
    });
}(Mirror));
;(function($) {
    $.ajax = function(settings) {
        // 配置合并
        settings = $.extend({
            type: 'GET',
            dataType: 'TEXT',
            url: location.href,
            async: true,
            data: {},
            context: window,
            timeout: 0
        }, settings);
        var url = settings.url;
        var type = settings.type.toUpperCase();
        var dataType = settings.dataType.toUpperCase();
        // Get请求处理
        if (type === 'GET') {
            // 参数处理
            if (typeof settings.data == 'object') {
                var query = url.indexOf('?');
                var paramStack = [];
                Object.keys(settings.data).forEach(function(i) {
                    paramStack.push(i + '=' + settings.data[i]);
                });
                delete settings.data;
                url += (query == -1 ? '?' : '&') + paramStack.join('&');
                var isJSONP = url.indexOf('?', url.indexOf('?')) != -1;
            }
            // JSONP处理
            if (dataType == 'JSONP' || isJSONP) {
                return $.getScript(url, settings.success, settings.error);
            }
        }

        // AJAX处理
        var promise = new Promise(function(resolve, reject) {
            var abortTimeout;
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                //请求完成
                if (xhr.readyState == 4) {
                    xhr.onreadystatechange = undefined;
                    clearTimeout(abortTimeout);
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || xhr.status == 0) {
                        var error = false;
                        var result = xhr.responseText;
                        try {
                            switch (dataType) {
                                case 'SCRIPT':
                                    (1, eval)(result);
                                    break;
                                case 'XML':
                                    result = xhr.responseXML
                                    break;
                                case 'JSON':
                                    result = JSON.parse(result);
                            }
                        } catch (e) {
                            error = e
                        }

                        if (error) {
                            reject({
                                error: 'parser',
                                status: xhr.status
                            });
                        } else {
                            resolve(result)
                        }
                    } else {
                        reject({
                            error: 'http',
                            status: xhr.status
                        });
                    }
                }
            };
            if (settings.timeout > 0) {
                abortTimeout = setTimeout(function() {
                    xhr.onreadystatechange = empty;
                    xhr.abort();
                    reject({
                        error: 'timeout',
                        status: 504
                    });
                }, settings.timeout);
            }
            xhr.open(settings.type, url, settings.async);
            if (settings.contentType || (settings.contentType !== false && settings.data && type != 'GET')) {
                xhr.setRequestHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded');
            }
            xhr.send(settings.data ? settings.data : null);
        });

        if (typeof settings.success === 'function') {
            promise.then(settings.success);
        }
        if (typeof settings.error === 'function') {
            promise.then(undefined, settings.error);
        }
        return promise;
    };

    var index = 0;
    $.getScript = function(url, done, fail) {
        // 替换回调函数
        var query = url.indexOf('?');
        var callbackName = 'jsonp' + index++;
        var replaceIndex = url.indexOf('?', query + 1);
        if (replaceIndex != -1) {
            url = url.substring(0, replaceIndex) + callbackName + url.substring(replaceIndex + 1);
        }
        // 创建异步操作
        var promise = new Promise(function(resolve, reject) {
            window[callbackName] = resolve;
            var head = document.head;
            var script = document.createElement('script');
            script.onload = script.onerror = function(e) {
                if (e.type == 'load') {
                    if (replaceIndex == -1) {
                        resolve(e);
                    }
                } else {
                    reject(e);
                }
                script.onload = script.onerror = null;
                delete window[callbackName];
                head.removeChild(script);
            }
            script.type = 'text/javascript';
            script.src = url;
            head.appendChild(script);
        });

        if (typeof done === 'function') {
            promise.then(done);
        }
        if (typeof fail === 'function') {
            promise.then(undefined, fail);
        }
        return promise;
    };

    $.getJSON = function(url, params, done, fail) {
        if ($.type(params) === 'function' && fail === undefined) {
            fail = done;
            done = params;
            params = undefined;
        }

        return $.ajax({
            url: url,
            dataType: 'json',
            data: params,
            success: done,
            error: fail
        });
    };
}(Mirror));
;(function($) {

    var stylesheets = {};

    var css = function(name){
        this.name = name;
        this.stylesheet = $('<style></style>').appendTo('head');
    }
    css.prototype = {
        append: function(style){
            this.stylesheet.append(document.createTextNode(style));
            return this;
        },
        write: function(style){
            this.stylesheet.html(style);
            return this;
        },
        disable: function(value){
            this.stylesheet.get(0).disabled = value === undefined || !!value;
            return this;
        },
        remove: function(){
            this.stylesheet.remove();
            delete stylesheets[this.name];
        }
    }

    $.css = function(name) {
        name = name || 'default';
        return stylesheets[name] || (stylesheets[name] = new css(name));
    };

}(Mirror));