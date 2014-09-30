var Mirror = function() {
    var mirror = {};
    var $ = window['$'] = function(selector, context) {
        return mirror.init(selector, context);
    }

    mirror.init = function(selector, context) {
        var nodes;
        // 无参数对象
        if (!selector) {
            return proto();
        }
        // 已转换对象
        if (mirror.is(selector)) {
            return selector;
        }

        switch (mirror.type(selector)) {
            case 'function':
                return $(document).ready(selector);
            case 'array':
                nodes = compact(selector), selector = null;
                break;
            case 'object':
                nodes = [selector], selector = null;
                break;
            case 'string':
                selector = selector.trim();

                if (selector[0] == '<') {
                    nodes = mirror.fragment(selector)
                } else if (context !== undefined) {
                    return $(context).find(selector);
                } else {
                    // nodes =
                }
                break;
        }
        return proto(nodes, selector)

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
    }
    var fragment = function(html, name, properties) {
        var nodes, container;
        // 唯标记
        if (singleTagRE.test(html)) {
            nodes = $(document.createElement(RegExp.$1));
        }
        // 复合结构
        if (!elements) {
            name = name || (fragmentRE.test(html) && RegExp.$1);
            container = container[name in containers ? name : '*'];
            container.innerHTML = '' + html;
            nodes = $(slice.call(container.childNodes)).each(function(){
                container.removeChild(this);
            });
        }

        if ($.type(properties) == 'object') {
            each(properties, function(key, value){
                
            });
        }
    }

    // 对象原型
    var proto = function(elements, selector) {
        elements = elements || [];
        elements.__proto__ = $.fn;
        elements.selector = selector || '';
        return elements;
    }

    // 原型判断
    mirror.is = function(object) {
        return object instanceof proto;
    }

    return $;
}();