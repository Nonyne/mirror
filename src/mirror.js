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