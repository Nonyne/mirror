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